/**
 * recurrenceOccurrenceRepository.js - Data access for RecurrenceOccurrence entity
 * Handles atomic occurrence creation and race conditions across multiple tabs.
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class RecurrenceOccurrenceRepository {
  async getAll() {
    return await databaseService.getAll(STORES.RECURRENCE_OCCURRENCES);
  }

  async getById(occurrenceId) {
    return await databaseService.getById(STORES.RECURRENCE_OCCURRENCES, occurrenceId);
  }

  async getByRuleId(ruleId) {
    return await databaseService.getByIndex(STORES.RECURRENCE_OCCURRENCES, 'recurrenceRuleId', ruleId);
  }

  async getByDate(dateStr) {
    return await databaseService.getByIndex(STORES.RECURRENCE_OCCURRENCES, 'originalDate', dateStr);
  }

  async add(occurrence) {
    return await databaseService.add(STORES.RECURRENCE_OCCURRENCES, occurrence);
  }

  async update(occurrence) {
    return await databaseService.update(STORES.RECURRENCE_OCCURRENCES, occurrence);
  }

  async delete(occurrenceId) {
    return await databaseService.delete(STORES.RECURRENCE_OCCURRENCES, occurrenceId);
  }

  /**
   * Atomic double-store method to ensure occurrence exists without creating duplicate activities
   * across multiple browser tabs.
   * Uses Promise wrapper, preventDefault() on ConstraintError, and transaction fallback.
   * @param {Object} rule
   * @param {string} date
   * @param {Function} createActivityCallback - Function that creates and returns new activity record
   * @param {IDBDatabase} [customDb=null] - Optional independent database connection for multi-tab testing
   * @returns {Promise<{ activityId: string, isCreated: boolean }>}
   */
  async ensureOccurrence(rule, date, createActivityCallback, customDb = null) {
    const db = customDb || await databaseService.initDatabase();
    const occurrenceId = `occ_${rule.id}_${date}`;

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.RECURRENCE_OCCURRENCES, STORES.ACTIVITIES], 'readwrite');
      const occStore = tx.objectStore(STORES.RECURRENCE_OCCURRENCES);
      const actStore = tx.objectStore(STORES.ACTIVITIES);

      const occurrenceRecord = {
        occurrenceId,
        recurrenceRuleId: rule.id,
        originalDate: date,
        generatedActivityId: null,
        isOverridden: false,
        isCancelled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      let isHandledViaConflict = false;
      const addOccReq = occStore.add(occurrenceRecord);

      // --- PHƯƠNG ÁN 1: Bắt lỗi ConstraintError tại request add() ---
      addOccReq.onerror = (event) => {
        if (event.target.error?.name === 'ConstraintError') {
          event.preventDefault();
          event.stopPropagation();
          isHandledViaConflict = true;

          // Đọc lại bản ghi có sẵn trong cùng transaction đang mở
          const getReq = occStore.get(occurrenceId);
          getReq.onsuccess = () => {
            const existingOcc = getReq.result;
            if (existingOcc && existingOcc.generatedActivityId) {
              resolve({ activityId: existingOcc.generatedActivityId, isCreated: false });
            } else {
              tx.abort();
            }
          };
          getReq.onerror = () => {
            tx.abort();
          };
        }
      };

      addOccReq.onsuccess = () => {
        // Tab này thắng cuộc đua -> tạo Activity tương ứng trong cùng transaction
        const newActivity = createActivityCallback(rule, date, occurrenceId);
        occurrenceRecord.generatedActivityId = newActivity.id;

        occStore.put(occurrenceRecord);
        actStore.add(newActivity);
      };

      tx.oncomplete = () => {
        if (!isHandledViaConflict && occurrenceRecord.generatedActivityId) {
          resolve({ activityId: occurrenceRecord.generatedActivityId, isCreated: true });
        }
      };

      // --- PHƯƠNG ÁN 2: Dự phòng khi transaction đã bị abort bởi ConstraintError ---
      tx.onabort = () => {
        if (isHandledViaConflict) return;

        if (tx.error?.name === 'ConstraintError' || addOccReq.error?.name === 'ConstraintError') {
          const readTx = db.transaction(STORES.RECURRENCE_OCCURRENCES, 'readonly');
          const readReq = readTx.objectStore(STORES.RECURRENCE_OCCURRENCES).get(occurrenceId);

          readReq.onsuccess = () => {
            const existingOcc = readReq.result;
            if (existingOcc && existingOcc.generatedActivityId) {
              resolve({ activityId: existingOcc.generatedActivityId, isCreated: false });
            } else {
              reject(new Error(`Không tìm thấy Occurrence đã tạo cho ${occurrenceId}`));
            }
          };

          readReq.onerror = () => {
            reject(readReq.error || new Error('Lỗi khi đọc Occurrence từ transaction mới'));
          };
        } else {
          reject(tx.error || new Error('Transaction bị abort bất thường'));
        }
      };

      tx.onerror = () => {
        if (!isHandledViaConflict && (!addOccReq.error || addOccReq.error.name !== 'ConstraintError')) {
          reject(tx.error || new Error('Transaction phát sinh lỗi'));
        }
      };
    });
  }
}

export const recurrenceOccurrenceRepository = new RecurrenceOccurrenceRepository();
