/**
 * db.js - IndexedDB Configuration and Schema Initialization
 * Database: PersonalWorkJournalDB
 * Version: 2 (10 Object Stores with Full Backward Compatibility)
 */

export const DB_NAME = 'PersonalWorkJournalDB';
export const DB_VERSION = 2;

export const STORES = {
  ACTIVITIES: 'activities',
  DAILY_NOTES: 'dailyNotes',
  NOTES: 'notes',
  GOALS: 'goals',
  TIMER_SESSIONS: 'timerSessions',
  SETTINGS: 'settings',
  PROJECTS: 'projects',
  RECURRENCE_RULES: 'recurrenceRules',
  RECURRENCE_OCCURRENCES: 'recurrenceOccurrences',
  PROJECT_JOURNAL_ENTRIES: 'projectJournalEntries'
};

/**
 * Open and initialize IndexedDB with required Object Stores and Indexes
 * @param {string} [dbName=DB_NAME]
 * @param {number} [version=DB_VERSION]
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase(dbName = DB_NAME, version = DB_VERSION) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const tx = event.target.transaction;
      const oldVersion = event.oldVersion;

      // ==========================================
      // 1. TẠO HOẶC BẢO TOÀN 6 STORES TỪ VERSION 1
      // ==========================================

      // 1. Activities Store
      let activityStore;
      if (!db.objectStoreNames.contains(STORES.ACTIVITIES)) {
        activityStore = db.createObjectStore(STORES.ACTIVITIES, { keyPath: 'id' });
        activityStore.createIndex('date', 'date', { unique: false });
        activityStore.createIndex('category', 'category', { unique: false });
        activityStore.createIndex('status', 'status', { unique: false });
        activityStore.createIndex('stars', 'stars', { unique: false });
        activityStore.createIndex('createdAt', 'createdAt', { unique: false });
      } else {
        activityStore = tx.objectStore(STORES.ACTIVITIES);
      }

      // 2. Daily Notes Store (1 main daily journal per date)
      if (!db.objectStoreNames.contains(STORES.DAILY_NOTES)) {
        const dailyStore = db.createObjectStore(STORES.DAILY_NOTES, { keyPath: 'id' });
        dailyStore.createIndex('date', 'date', { unique: true });
        dailyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 3. Multiple Notes Store
      let noteStore;
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        noteStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
        noteStore.createIndex('date', 'date', { unique: false });
        noteStore.createIndex('category', 'category', { unique: false });
        noteStore.createIndex('isPinned', 'isPinned', { unique: false });
        noteStore.createIndex('createdAt', 'createdAt', { unique: false });
      } else {
        noteStore = tx.objectStore(STORES.NOTES);
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
      let timerStore;
      if (!db.objectStoreNames.contains(STORES.TIMER_SESSIONS)) {
        timerStore = db.createObjectStore(STORES.TIMER_SESSIONS, { keyPath: 'id' });
        timerStore.createIndex('activityId', 'activityId', { unique: false });
        timerStore.createIndex('status', 'status', { unique: false });
        timerStore.createIndex('startTime', 'startTime', { unique: false });
        timerStore.createIndex('createdAt', 'createdAt', { unique: false });
      } else {
        timerStore = tx.objectStore(STORES.TIMER_SESSIONS);
      }

      // 6. Settings Store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // ==========================================
      // 2. TẠO 4 STORES MỚI TRONG VERSION 2
      // ==========================================

      // 7. Projects Store
      if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
        const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
        projectStore.createIndex('status', 'status', { unique: false });
        projectStore.createIndex('category', 'category', { unique: false });
        projectStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 8. Recurrence Rules Store
      if (!db.objectStoreNames.contains(STORES.RECURRENCE_RULES)) {
        const recStore = db.createObjectStore(STORES.RECURRENCE_RULES, { keyPath: 'id' });
        recStore.createIndex('recurrenceType', 'recurrenceType', { unique: false });
        recStore.createIndex('startDate', 'startDate', { unique: false });
        recStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 9. Recurrence Occurrences Store (Khóa chính keyPath: occurrenceId, không tạo index trùng)
      if (!db.objectStoreNames.contains(STORES.RECURRENCE_OCCURRENCES)) {
        const occStore = db.createObjectStore(STORES.RECURRENCE_OCCURRENCES, { keyPath: 'occurrenceId' });
        occStore.createIndex('recurrenceRuleId', 'recurrenceRuleId', { unique: false });
        occStore.createIndex('originalDate', 'originalDate', { unique: false });
        occStore.createIndex('generatedActivityId', 'generatedActivityId', { unique: false });
        occStore.createIndex('isOverridden', 'isOverridden', { unique: false });
        occStore.createIndex('isCancelled', 'isCancelled', { unique: false });
        occStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 10. Project Journal Entries Store
      if (!db.objectStoreNames.contains(STORES.PROJECT_JOURNAL_ENTRIES)) {
        const pjeStore = db.createObjectStore(STORES.PROJECT_JOURNAL_ENTRIES, { keyPath: 'id' });
        pjeStore.createIndex('projectId', 'projectId', { unique: false });
        pjeStore.createIndex('date', 'date', { unique: false });
        pjeStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // ==========================================
      // 3. MỞ RỘNG INDEXES CHO CÁC STORE HIỆN CÓ
      // ==========================================
      if (oldVersion < 2) {
        if (!activityStore.indexNames.contains('projectId')) {
          activityStore.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!activityStore.indexNames.contains('recurrenceRuleId')) {
          activityStore.createIndex('recurrenceRuleId', 'recurrenceRuleId', { unique: false });
        }

        if (!noteStore.indexNames.contains('projectId')) {
          noteStore.createIndex('projectId', 'projectId', { unique: false });
        }

        if (!timerStore.indexNames.contains('projectId')) {
          timerStore.createIndex('projectId', 'projectId', { unique: false });
        }
        if (!timerStore.indexNames.contains('type')) {
          timerStore.createIndex('type', 'type', { unique: false });
        }

        // ==========================================================
        // 4. MIGRATION DỮ LIỆU CŨ: CROSS-REFERENCE TIMER SESSIONS & ACTUAL DURATION PROVENANCE
        // ==========================================================
        if (oldVersion > 0) {
          const migrateActivitiesWithTimerMap = (timerMap) => {
            const cursorRequest = activityStore.openCursor();
            cursorRequest.onsuccess = (e) => {
              const cursor = e.target.result;
              if (cursor) {
                const a = cursor.value;

                // Đảm bảo các trường mở rộng không bị undefined
                if (a.projectId === undefined) a.projectId = null;
                if (a.recurrenceRuleId === undefined) a.recurrenceRuleId = null;

                // Lấy đối soát dữ liệu timer sessions
                const timerEntry = timerMap ? timerMap.get(a.id) : null;
                const legacyMinutes = Number(a.actualDurationMinutes);
                const hasLegacyMinutes = !isNaN(legacyMinutes) && legacyMinutes > 0;
                const hasManualProof = a.manuallyConfirmed === true || a.manualEntry === true || a.source === 'manual';

                if (timerEntry && timerEntry.hasTimer) {
                  // Ưu tiên 1: timer_verified từ Whitelist timer sessions
                  a.actualDurationSource = 'timer_verified';
                  a.timerSeconds = timerEntry.timerSeconds;
                  a.manualSeconds = timerEntry.manualSeconds;
                  a.actualDurationSeconds = timerEntry.timerSeconds + timerEntry.manualSeconds;
                  a.actualDurationMinutes = Math.round(a.actualDurationSeconds / 60);
                } else if ((timerEntry && timerEntry.hasManual) || hasManualProof) {
                  // Ưu tiên 2: manual_verified từ manual session hoặc cờ xác nhận tay
                  a.actualDurationSource = 'manual_verified';
                  const manualSecs = (timerEntry && timerEntry.hasManual)
                    ? timerEntry.manualSeconds
                    : (hasLegacyMinutes ? legacyMinutes * 60 : 0);
                  a.timerSeconds = 0;
                  a.manualSeconds = manualSecs;
                  a.actualDurationSeconds = manualSecs;
                  a.actualDurationMinutes = Math.round(manualSecs / 60);
                } else if (hasLegacyMinutes) {
                  // Ưu tiên 3: legacy_unverified (bao gồm cả Planned và Completed có số phút cũ từ V1)
                  // TUYỆT ĐỐI KHÔNG XÓA HOẶC RESET VỀ 0 LÀM MẤT DỮ LIỆU LỊCH SỬ
                  a.actualDurationSource = 'legacy_unverified';
                  a.actualDurationMinutes = legacyMinutes;
                  a.actualDurationSeconds = legacyMinutes * 60;
                  a.timerSeconds = 0;
                  a.manualSeconds = 0;
                } else {
                  // Ưu tiên 4: unperformed (chưa thực hiện, thời gian = 0)
                  a.actualDurationSource = 'unperformed';
                  a.actualDurationMinutes = 0;
                  a.actualDurationSeconds = 0;
                  a.timerSeconds = 0;
                  a.manualSeconds = 0;
                }

                cursor.update(a);
                cursor.continue();
              }
            };
          };

          const timerRequest = timerStore.getAll();
          timerRequest.onsuccess = () => {
            const allSessions = timerRequest.result || [];
            const timerMap = new Map();

            for (const s of allSessions) {
              if (s && s.status === 'completed' && s.activityId) {
                const entry = timerMap.get(s.activityId) || {
                  timerSeconds: 0,
                  manualSeconds: 0,
                  hasTimer: false,
                  hasManual: false
                };
                const secs = Number(s.totalSeconds) || 0;
                const sType = s.type; // Whitelist check: 'timer' || 'pomodoro'
                if (sType === 'timer' || sType === 'pomodoro') {
                  if (secs > 0) {
                    entry.timerSeconds += secs;
                    entry.hasTimer = true;
                  }
                } else if (sType === 'manual') {
                  if (secs > 0) {
                    entry.manualSeconds += secs;
                    entry.hasManual = true;
                  }
                }
                timerMap.set(s.activityId, entry);
              }
            }

            migrateActivitiesWithTimerMap(timerMap);
          };

          timerRequest.onerror = () => {
            migrateActivitiesWithTimerMap(null);
          };
        }
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('Failed to open IndexedDB:', event.target.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      console.warn('IndexedDB upgrade blocked: vui lòng đóng các tab khác đang mở ứng dụng.');
    };
  });
}
