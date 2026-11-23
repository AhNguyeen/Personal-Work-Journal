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
