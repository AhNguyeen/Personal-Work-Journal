/**
 * databaseService.js - Centralized Database Service for IndexedDB operations
 * All CRUD transactions must go through this service.
 * Supports 10 Object Stores, Atomic Single-Transaction Replace, and Robust Error Handling.
 */

import { openDatabase, STORES, DB_NAME, DB_VERSION } from './db.js';

class DatabaseService {
  constructor() {
    this._db = null;
    this._initPromise = null;
  }

  /**
   * Initialize and cache database connection
   * @returns {Promise<IDBDatabase>}
   */
  async initDatabase() {
    if (this._db) return this._db;
    if (!this._initPromise) {
      this._initPromise = openDatabase()
        .then((db) => {
          this._db = db;
          this._db.onversionchange = () => {
            console.warn('Cơ sở dữ liệu đang nâng cấp ở tab khác, đóng kết nối tab hiện tại...');
            this._db.close();
            this._db = null;
            this._initPromise = null;
          };
          this._db.onclose = () => {
            this._db = null;
            this._initPromise = null;
          };
          return this._db;
        })
        .catch((err) => {
          // Reset _initPromise on error to avoid permanently caching a rejected promise
          this._initPromise = null;
          this._db = null;
          throw err;
        });
    }
    return this._initPromise;
  }

  /**
   * Helper to execute a transaction
   * @private
   */
  async _transaction(storeName, mode, callback) {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);

        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = (e) => reject(e.target.error || new Error('Transaction error'));
        tx.onabort = (e) => reject(new Error('Transaction aborted: ' + (e.target.error?.message || 'Aborted')));

        result = callback(store, tx);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Add a new item to an object store
   * @param {string} storeName
   * @param {Object} item
   * @returns {Promise<Object>} Added item with timestamps
   */
  async add(storeName, item) {
    const now = new Date().toISOString();
    const record = {
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now
    };

    await this._transaction(storeName, 'readwrite', (store) => {
      store.add(record);
    });
    return record;
  }

  /**
   * Get an item by ID / key
   * @param {string} storeName
   * @param {string|number} id
   * @returns {Promise<Object|null>}
   */
  async getById(storeName, id) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.initDatabase();
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Get all items from a store
   * @param {string} storeName
   * @returns {Promise<Array>}
   */
  async getAll(storeName) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.initDatabase();
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Query records by index name and value
   * @param {string} storeName
   * @param {string} indexName
   * @param {*} value
   * @returns {Promise<Array>}
   */
  async getByIndex(storeName, indexName, value) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await this.initDatabase();
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Update an existing record
   * @param {string} storeName
   * @param {Object} item
   * @returns {Promise<Object>}
   */
  async update(storeName, item) {
    const record = {
      ...item,
      updatedAt: new Date().toISOString()
    };

    await this._transaction(storeName, 'readwrite', (store) => {
      store.put(record);
    });
    return record;
  }

  /**
   * Delete an item by ID
   * @param {string} storeName
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async delete(storeName, id) {
    await this._transaction(storeName, 'readwrite', (store) => {
      store.delete(id);
    });
    return true;
  }

  /**
   * Delete multiple items by array of IDs
   * @param {string} storeName
   * @param {Array<string|number>} ids
   * @returns {Promise<number>} count deleted
   */
  async deleteMany(storeName, ids) {
    if (!ids || ids.length === 0) return 0;
    await this._transaction(storeName, 'readwrite', (store) => {
      for (const id of ids) {
        store.delete(id);
      }
    });
    return ids.length;
  }

  /**
   * Clear all records in a store
   * @param {string} storeName
   * @returns {Promise<boolean>}
   */
  async clearStore(storeName) {
    await this._transaction(storeName, 'readwrite', (store) => {
      store.clear();
    });
    return true;
  }

  /**
   * Export all data from all 10 stores to a unified JSON object
   * @returns {Promise<Object>}
   */
  async exportData() {
    const data = {
      metadata: {
        app: 'PersonalWorkJournal',
        version: '2.0.0',
        dbVersion: DB_VERSION,
        exportedAt: new Date().toISOString()
      },
      stores: {}
    };

    for (const key of Object.values(STORES)) {
      data.stores[key] = await this.getAll(key);
    }

    return data;
  }

  /**
   * Deep validation of imported backup data with primary key verification
   * @param {Object} importedData
   * @param {'replace'|'merge'} mode
   * @throws {Error} if invalid
   */
  validateImportPayload(importedData, mode = 'replace') {
    if (!importedData || typeof importedData !== 'object') {
      throw new Error('Dữ liệu nhập không hợp lệ (không phải đối tượng JSON)');
    }
    if (!importedData.stores || typeof importedData.stores !== 'object') {
      throw new Error('Dữ liệu nhập thiếu thuộc tính stores');
    }

    const allStoreNames = Object.values(STORES);
    const storeKeys = Object.keys(importedData.stores).filter(s => allStoreNames.includes(s));

    if (storeKeys.length === 0) {
      throw new Error('Không tìm thấy Object Store hợp lệ nào trong dữ liệu nhập');
    }

    const STORE_PRIMARY_KEYS = {
      [STORES.ACTIVITIES]: 'id',
      [STORES.DAILY_NOTES]: 'id',
      [STORES.NOTES]: 'id',
      [STORES.GOALS]: 'id',
      [STORES.TIMER_SESSIONS]: 'id',
      [STORES.SETTINGS]: 'key',
      [STORES.PROJECTS]: 'id',
      [STORES.RECURRENCE_RULES]: 'id',
      [STORES.RECURRENCE_OCCURRENCES]: 'occurrenceId',
      [STORES.PROJECT_JOURNAL_ENTRIES]: 'id'
    };

    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    const TIME_REGEX = /^\d{2}:\d{2}$/;
    const VALID_PROVENANCE_SOURCES = new Set(['timer_verified', 'manual_verified', 'legacy_unverified', 'unperformed']);
    const VALID_ACTIVITY_STATUSES = new Set(['Planned', 'Completed', 'In Progress', 'Cancelled']);
    const VALID_TIMER_STATUSES = new Set(['running', 'paused', 'completed']);
    const VALID_TIMER_TYPES = new Set(['timer', 'pomodoro', 'manual']);
    const VALID_RECURRENCE_TYPES = new Set(['daily', 'weekly', 'weekdays', 'custom']);

    // Kiểm tra từng store và từng bản ghi
    for (const storeName of storeKeys) {
      const items = importedData.stores[storeName];
      if (items !== undefined && !Array.isArray(items)) {
        throw new Error(`Dữ liệu của store "${storeName}" không phải là mảng`);
      }

      const expectedKey = STORE_PRIMARY_KEYS[storeName] || 'id';
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== 'object') {
          throw new Error(`Bản ghi thứ ${i} trong store "${storeName}" không hợp lệ`);
        }
        const val = item[expectedKey];
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          throw new Error(`Bản ghi trong store "${storeName}" thiếu khóa chính "${expectedKey}"`);
        }

        // ==========================================
        // BUSINESS & SCHEMA VALIDATION CHO TỪNG STORE
        // ==========================================
        if (storeName === STORES.ACTIVITIES) {
          if (!item.title || typeof item.title !== 'string' || item.title.trim() === '') {
            throw new Error(`Bản ghi hoạt động "${val}" thiếu tiêu đề (title)`);
          }
          if (!item.date || !DATE_REGEX.test(item.date)) {
            throw new Error(`Bản ghi hoạt động "${val}" có trường "date" không đúng định dạng YYYY-MM-DD: "${item.date}"`);
          }
          if (!item.startTime || !TIME_REGEX.test(item.startTime)) {
            throw new Error(`Bản ghi hoạt động "${val}" có trường "startTime" không đúng định dạng HH:mm: "${item.startTime}"`);
          }
          if (!item.endTime || !TIME_REGEX.test(item.endTime)) {
            throw new Error(`Bản ghi hoạt động "${val}" có trường "endTime" không đúng định dạng HH:mm: "${item.endTime}"`);
          }
          if (item.actualDurationSource !== undefined && !VALID_PROVENANCE_SOURCES.has(item.actualDurationSource)) {
            throw new Error(`Bản ghi hoạt động "${val}" có "actualDurationSource" không hợp lệ: "${item.actualDurationSource}"`);
          }
          if (item.status !== undefined && !VALID_ACTIVITY_STATUSES.has(item.status)) {
            throw new Error(`Bản ghi hoạt động "${val}" có trạng thái "status" không hợp lệ: "${item.status}"`);
          }
          if (item.stars !== undefined && (typeof item.stars !== 'number' || isNaN(item.stars) || item.stars < 1 || item.stars > 5)) {
            throw new Error(`Bản ghi hoạt động "${val}" có mức đánh giá "stars" không hợp lệ (phải từ 1 đến 5): "${item.stars}"`);
          }
          const numFields = ['breakMinutes', 'durationMinutes', 'actualDurationMinutes', 'actualDurationSeconds', 'timerSeconds', 'manualSeconds'];
          for (const nf of numFields) {
            if (item[nf] !== undefined && (typeof item[nf] !== 'number' || isNaN(item[nf]) || item[nf] < 0)) {
              throw new Error(`Bản ghi hoạt động "${val}" có trường số "${nf}" không hợp lệ: "${item[nf]}"`);
            }
          }
        } else if (storeName === STORES.DAILY_NOTES) {
          if (!item.date || !DATE_REGEX.test(item.date)) {
            throw new Error(`Bản ghi nhật ký ngày "${val}" có trường "date" không đúng định dạng YYYY-MM-DD: "${item.date}"`);
          }
        } else if (storeName === STORES.NOTES) {
          if (item.date !== undefined && !DATE_REGEX.test(item.date)) {
            throw new Error(`Bản ghi ghi chú "${val}" có trường "date" không đúng định dạng YYYY-MM-DD: "${item.date}"`);
          }
        } else if (storeName === STORES.TIMER_SESSIONS) {
          if (!item.activityId || typeof item.activityId !== 'string') {
            throw new Error(`Bản ghi phiên đếm giờ "${val}" thiếu activityId liên kết`);
          }
          if (item.status !== undefined && !VALID_TIMER_STATUSES.has(item.status)) {
            throw new Error(`Bản ghi phiên đếm giờ "${val}" có trạng thái không hợp lệ: "${item.status}"`);
          }
          if (item.type !== undefined && !VALID_TIMER_TYPES.has(item.type)) {
            throw new Error(`Bản ghi phiên đếm giờ "${val}" có loại "type" không hợp lệ: "${item.type}"`);
          }
          if (item.totalSeconds !== undefined && (typeof item.totalSeconds !== 'number' || isNaN(item.totalSeconds) || item.totalSeconds < 0)) {
            throw new Error(`Bản ghi phiên đếm giờ "${val}" có trường totalSeconds không hợp lệ: "${item.totalSeconds}"`);
          }
        } else if (storeName === STORES.PROJECTS) {
          if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
            throw new Error(`Bản ghi dự án "${val}" thiếu tên dự án (name)`);
          }
        } else if (storeName === STORES.RECURRENCE_RULES) {
          if (!item.startDate || !DATE_REGEX.test(item.startDate)) {
            throw new Error(`Bản ghi quy tắc định kỳ "${val}" có trường "startDate" không đúng định dạng YYYY-MM-DD: "${item.startDate}"`);
          }
          if (item.endDate !== undefined && item.endDate !== null && !DATE_REGEX.test(item.endDate)) {
            throw new Error(`Bản ghi quy tắc định kỳ "${val}" có trường "endDate" không đúng định dạng YYYY-MM-DD: "${item.endDate}"`);
          }
          if (item.recurrenceType !== undefined && !VALID_RECURRENCE_TYPES.has(item.recurrenceType)) {
            throw new Error(`Bản ghi quy tắc định kỳ "${val}" có recurrenceType không hợp lệ: "${item.recurrenceType}"`);
          }
        } else if (storeName === STORES.RECURRENCE_OCCURRENCES) {
          if (!item.recurrenceRuleId || typeof item.recurrenceRuleId !== 'string') {
            throw new Error(`Bản ghi lần lặp "${val}" thiếu recurrenceRuleId`);
          }
          if (!item.originalDate || !DATE_REGEX.test(item.originalDate)) {
            throw new Error(`Bản ghi lần lặp "${val}" có trường "originalDate" không đúng định dạng YYYY-MM-DD: "${item.originalDate}"`);
          }
        } else if (storeName === STORES.PROJECT_JOURNAL_ENTRIES) {
          if (!item.projectId || typeof item.projectId !== 'string') {
            throw new Error(`Bản ghi bài viết tiến độ "${val}" thiếu projectId`);
          }
          if (!item.date || !DATE_REGEX.test(item.date)) {
            throw new Error(`Bản ghi bài viết tiến độ "${val}" có trường "date" không đúng định dạng YYYY-MM-DD: "${item.date}"`);
          }
        }
      }
    }
  }

  /**
   * Import data into IndexedDB
   * - In Replace mode: Runs deep validation, prepares memory arrays, and executes
   *   clear() and put() across target stores in a SINGLE ATOMIC READWRITE TRANSACTION
   *   without any async gap (no await/setTimeout inside transaction).
   *   Preserves stores that are not part of the imported backup payload.
   * @param {Object} importedData
   * @param {'replace'|'merge'} mode
   * @returns {Promise<{success: boolean, stats: Object}>}
   */
  async importData(importedData, mode = 'replace') {
    // 1. Deep Validation trước khi chạm vào DB
    this.validateImportPayload(importedData, mode);

    const db = await this.initDatabase();
    const allStoreNames = Object.values(STORES);

    if (mode === 'replace') {
      // 2. Chỉ thay thế các store có trong payload (không âm thầm xóa các store không có trong payload)
      const storesToReplace = Object.keys(importedData.stores).filter(s => allStoreNames.includes(s));
      if (storesToReplace.length === 0) {
        throw new Error('Không có store hợp lệ để khôi phục');
      }

      // Chuẩn bị trước toàn bộ dữ liệu trong RAM (không có async gap trong transaction)
      const preparedData = {};
      const stats = {};
      for (const storeName of storesToReplace) {
        const rawItems = importedData.stores[storeName] || [];
        preparedData[storeName] = rawItems;
        stats[storeName] = rawItems.length;
      }

      // 3. Mở duy nhất 1 Single readwrite Transaction qua các target stores
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(storesToReplace, 'readwrite');

          tx.oncomplete = () => {
            resolve({ success: true, stats, mode: 'replace' });
          };

          tx.onerror = (e) => {
            console.error('Replace transaction error:', e.target?.error);
            reject(e.target?.error || new Error('Lỗi trong phiên giao dịch Replace'));
          };

          tx.onabort = (e) => {
            console.warn('Replace transaction aborted, rolling back stores');
            reject(new Error('Giao dịch Replace bị hủy (Rollback thành công): ' + (e.target?.error?.message || 'Aborted')));
          };

          // Thực hiện đồng bộ liên tục trong cùng một tick:
          // a. Clear target stores
          for (const storeName of storesToReplace) {
            const store = tx.objectStore(storeName);
            store.clear();
          }

          // b. Put toàn bộ bản ghi vào target stores
          for (const storeName of storesToReplace) {
            const store = tx.objectStore(storeName);
            const items = preparedData[storeName];
            for (let i = 0; i < items.length; i++) {
              store.put(items[i]);
            }
          }
        } catch (err) {
          reject(err);
        }
      });
    } else {
      // Mode 'merge': Chèn hoặc cập nhật
      const stats = {};
      for (const [storeName, items] of Object.entries(importedData.stores)) {
        if (!allStoreNames.includes(storeName) || !Array.isArray(items)) {
          continue;
        }

        let count = 0;
        await this._transaction(storeName, 'readwrite', (store) => {
          for (const item of items) {
            store.put(item);
            count++;
          }
        });
        stats[storeName] = count;
      }

      return { success: true, stats, mode: 'merge' };
    }
  }
}

export const databaseService = new DatabaseService();
