/**
 * db.js - IndexedDB Configuration and Schema Initialization
 * Database: PersonalWorkJournalDB
 */

export const DB_NAME = 'PersonalWorkJournalDB';
export const DB_VERSION = 1;

export const STORES = {
  ACTIVITIES: 'activities',
  DAILY_NOTES: 'dailyNotes',
  NOTES: 'notes',
  GOALS: 'goals',
  TIMER_SESSIONS: 'timerSessions',
  SETTINGS: 'settings'
};

/**
 * Open and initialize IndexedDB with required Object Stores and Indexes
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Activities Store
      if (!db.objectStoreNames.contains(STORES.ACTIVITIES)) {
        const activityStore = db.createObjectStore(STORES.ACTIVITIES, { keyPath: 'id' });
        activityStore.createIndex('date', 'date', { unique: false });
        activityStore.createIndex('category', 'category', { unique: false });
        activityStore.createIndex('status', 'status', { unique: false });
        activityStore.createIndex('stars', 'stars', { unique: false });
        activityStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 2. Daily Notes Store (1 main daily journal per date)
      if (!db.objectStoreNames.contains(STORES.DAILY_NOTES)) {
        const dailyStore = db.createObjectStore(STORES.DAILY_NOTES, { keyPath: 'id' });
        dailyStore.createIndex('date', 'date', { unique: true });
        dailyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 3. Multiple Notes Store
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const noteStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
        noteStore.createIndex('date', 'date', { unique: false });
        noteStore.createIndex('category', 'category', { unique: false });
        noteStore.createIndex('isPinned', 'isPinned', { unique: false });
        noteStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 4. Goals Store
      if (!db.objectStoreNames.contains(STORES.GOALS)) {
        const goalStore = db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
        goalStore.createIndex('category', 'category', { unique: false });
        goalStore.createIndex('period', 'period', { unique: false });
        goalStore.createIndex('status', 'status', { unique: false });
        goalStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 5. Timer Sessions Store
      if (!db.objectStoreNames.contains(STORES.TIMER_SESSIONS)) {
        const timerStore = db.createObjectStore(STORES.TIMER_SESSIONS, { keyPath: 'id' });
        timerStore.createIndex('activityId', 'activityId', { unique: false });
        timerStore.createIndex('status', 'status', { unique: false });
        timerStore.createIndex('startTime', 'startTime', { unique: false });
        timerStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 6. Settings Store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Failed to open IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}
