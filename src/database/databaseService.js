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
   * Deep validation of imported backup data
   * @param {Object} importedData
   * @throws {Error} if invalid
   */
  validateImportPayload(importedData) {
    if (!importedData || typeof importedData !== 'object') {
      throw new Error('Dữ liệu nhập không hợp lệ (không phải đối tượng JSON)');
    }
    if (!importedData.stores || typeof importedData.stores !== 'object') {
      throw new Error('Dữ liệu nhập thiếu thuộc tính stores');
    }

    // Kiểm tra từng store nếu có thì phải là mảng
    for (const [storeName, items] of Object.entries(importedData.stores)) {
      if (items !== undefined && !Array.isArray(items)) {
        throw new Error(`Dữ liệu của store "${storeName}" không phải là mảng`);
      }
    }
  }

  /**
   * Import data into IndexedDB
   * - In Replace mode: Runs deep validation, prepares memory arrays, and executes
   *   clear() and put() across ALL 10 Object Stores in a SINGLE ATOMIC READWRITE TRANSACTION
   *   without any async gap (no await/setTimeout inside transaction).
   * @param {Object} importedData
   * @param {'replace'|'merge'} mode
   * @returns {Promise<{success: boolean, stats: Object}>}
   */
  async importData(importedData, mode = 'replace') {
    // 1. Deep Validation trước khi chạm vào DB
    this.validateImportPayload(importedData);

    const db = await this.initDatabase();
    const allStoreNames = Object.values(STORES);

    if (mode === 'replace') {
      // 2. Chuẩn bị trước toàn bộ dữ liệu trong RAM (không có async gap trong transaction)
      const preparedData = {};
      const stats = {};
      for (const storeName of allStoreNames) {
        const rawItems = importedData.stores[storeName] || [];
        preparedData[storeName] = rawItems;
        stats[storeName] = rawItems.length;
      }

      // 3. Mở duy nhất 1 Single readwrite Transaction qua CẢ 10 OBJECT STORES
      return new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(allStoreNames, 'readwrite');

          tx.oncomplete = () => {
            resolve({ success: true, stats, mode: 'replace' });
          };

          tx.onerror = (e) => {
            console.error('Replace transaction error:', e.target.error);
            reject(e.target.error || new Error('Lỗi trong phiên giao dịch Replace'));
          };

          tx.onabort = (e) => {
            console.warn('Replace transaction aborted, rolling back all stores');
            reject(new Error('Giao dịch Replace bị hủy (Rollback thành công): ' + (e.target.error?.message || 'Aborted')));
          };

          // Thực hiện đồng bộ liên tục trong cùng một tick:
          // a. Clear cả 10 stores
          for (const storeName of allStoreNames) {
            const store = tx.objectStore(storeName);
            store.clear();
          }

          // b. Put toàn bộ bản ghi vào cả 10 stores
          for (const storeName of allStoreNames) {
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
