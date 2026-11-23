/**
 * databaseService.js - Centralized Database Service for IndexedDB operations
 * All CRUD transactions must go through this service.
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
      this._initPromise = openDatabase().then((db) => {
        this._db = db;
        this._db.onversionchange = () => {
          this._db.close();
          this._db = null;
        };
        return this._db;
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
        tx.onerror = (e) => reject(e.target.error);
        tx.onabort = (e) => reject(new Error('Transaction aborted: ' + e.target.error));

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
   * Export all data from all stores to a unified JSON object
   * @returns {Promise<Object>}
   */
  async exportData() {
    const data = {
      metadata: {
        app: 'PersonalWorkJournal',
        version: '1.0.0',
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
   * Import data into IndexedDB
   * @param {Object} importedData
   * @param {'replace'|'merge'} mode
   * @returns {Promise<{success: boolean, stats: Object}>}
   */
  async importData(importedData, mode = 'replace') {
    if (!importedData || !importedData.stores) {
      throw new Error('Dữ liệu nhập không đúng cấu trúc (thiếu thuộc tính stores)');
    }

    const stats = {};
    const db = await this.initDatabase();

    // Validate mode
    if (mode === 'replace') {
      // Clear all stores first
      for (const storeName of Object.values(STORES)) {
        await this.clearStore(storeName);
      }
    }

    // Insert imported items
    for (const [storeName, items] of Object.entries(importedData.stores)) {
      if (!Object.values(STORES).includes(storeName) || !Array.isArray(items)) {
        continue;
      }

      let count = 0;
      await this._transaction(storeName, 'readwrite', (store) => {
        for (const item of items) {
          if (mode === 'merge' && storeName !== STORES.SETTINGS) {
            // For merge, preserve or ensure unique ID if needed
            store.put(item);
          } else {
            store.put(item);
          }
          count++;
        }
      });
      stats[storeName] = count;
    }

    return { success: true, stats };
  }
}

export const databaseService = new DatabaseService();
