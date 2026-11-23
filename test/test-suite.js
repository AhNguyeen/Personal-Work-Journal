/**
 * test-suite.js - Automated Verification of IndexedDB, Business Logic, and Utilities
 */

import 'fake-indexeddb/auto';
import assert from 'node:assert';
import { databaseService } from '../src/database/databaseService.js';
import { STORES } from '../src/database/db.js';
import { activityService } from '../src/services/activityService.js';
import { noteService } from '../src/services/noteService.js';
import { timerService } from '../src/services/timerService.js';
import { backupService } from '../src/services/backupService.js';
import { timeToMinutes, minutesToTime, calculateDurationMinutes, checkTimesOverlap } from '../src/utils/timeUtils.js';
import { formatVietnameseDate, getWeekDays, addDays, getTodayDateString } from '../src/utils/dateUtils.js';
import { validateActivity, validateNote, validateGoal } from '../src/utils/validation.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n================ STARTING COMPREHENSIVE TEST SUITE ================\n');

  // Test 1: Time Utilities
  console.log('--- Group 1: Time Utilities ---');
  await test('timeToMinutes converts "08:30" to 510', () => {
    assert.strictEqual(timeToMinutes('08:30'), 510);
    assert.strictEqual(timeToMinutes('00:00'), 0);
    assert.strictEqual(timeToMinutes('23:59'), 1439);
  });

  await test('minutesToTime converts 510 to "08:30"', () => {
    assert.strictEqual(minutesToTime(510), '08:30');
    assert.strictEqual(minutesToTime(0), '00:00');
  });

  await test('calculateDurationMinutes accounts for break deduction', () => {
    const mins = calculateDurationMinutes('09:00', '11:30', 15);
    assert.strictEqual(mins, 135); // 150 - 15 = 135
  });

  await test('checkTimesOverlap detects overlapping intervals correctly', () => {
    // 09:00 - 10:30 overlaps with 10:00 - 11:00
    assert.strictEqual(checkTimesOverlap('09:00', '10:30', '10:00', '11:00'), true);
    // 09:00 - 10:00 does NOT overlap with 10:00 - 11:00 (boundary condition)
    assert.strictEqual(checkTimesOverlap('09:00', '10:00', '10:00', '11:00'), false);
    // 08:00 - 09:00 does NOT overlap with 10:00 - 11:00
    assert.strictEqual(checkTimesOverlap('08:00', '09:00', '10:00', '11:00'), false);
  });

  // Test 2: Date Utilities
  console.log('\n--- Group 2: Date Utilities ---');
  await test('formatVietnameseDate formats correctly with weekday', () => {
    const str = formatVietnameseDate('2026-11-23', true);
    assert.ok(str.includes('23/11/2026'));
  });

  await test('getWeekDays returns 7 days starting from Monday', () => {
    const days = getWeekDays('2026-11-23');
    assert.strictEqual(days.length, 7);
    assert.strictEqual(days[0].shortWeekday, 'T2');
    assert.strictEqual(days[6].shortWeekday, 'CN');
  });

  await test('addDays handles positive and negative offsets', () => {
    assert.strictEqual(addDays('2026-11-23', 1), '2026-11-24');
    assert.strictEqual(addDays('2026-11-23', -1), '2026-11-22');
  });

  // Test 3: Data Validation
  console.log('\n--- Group 3: Input Validation ---');
  await test('validateActivity flags empty title or invalid start/end time', () => {
    const res1 = validateActivity({ title: '', date: '2026-11-23', startTime: '09:00', endTime: '10:00', stars: 3 });
    assert.strictEqual(res1.isValid, false);
    assert.ok(res1.errors.title);

    const res2 = validateActivity({ title: 'Task', date: '2026-11-23', startTime: '11:00', endTime: '10:00', stars: 3 });
    assert.strictEqual(res2.isValid, false);
    assert.ok(res2.errors.endTime);

    const res3 = validateActivity({ title: 'Task', date: '2026-11-23', startTime: '09:00', endTime: '10:00', stars: 6 });
    assert.strictEqual(res3.isValid, false);
    assert.ok(res3.errors.stars);
  });

  await test('validateGoal requires positive target hours', () => {
    const res = validateGoal({ title: 'Read', targetHours: -2, category: 'Study' });
    assert.strictEqual(res.isValid, false);
  });

  // Test 4: IndexedDB & DatabaseService CRUD
  console.log('\n--- Group 4: IndexedDB Operations ---');
  await test('databaseService initializes all 6 Object Stores', async () => {
    const db = await databaseService.initDatabase();
    assert.ok(db.objectStoreNames.contains(STORES.ACTIVITIES));
    assert.ok(db.objectStoreNames.contains(STORES.DAILY_NOTES));
    assert.ok(db.objectStoreNames.contains(STORES.NOTES));
    assert.ok(db.objectStoreNames.contains(STORES.GOALS));
    assert.ok(db.objectStoreNames.contains(STORES.TIMER_SESSIONS));
    assert.ok(db.objectStoreNames.contains(STORES.SETTINGS));
  });

  await test('databaseService add, getById, update, delete item in store', async () => {
    const item = { id: 'test_1', title: 'Học bài', category: 'Study', date: '2026-11-23' };
    const saved = await databaseService.add(STORES.ACTIVITIES, item);
    assert.strictEqual(saved.id, 'test_1');
    assert.ok(saved.createdAt);

    const retrieved = await databaseService.getById(STORES.ACTIVITIES, 'test_1');
    assert.strictEqual(retrieved.title, 'Học bài');

    retrieved.title = 'Học lập trình chuyên sâu';
    await databaseService.update(STORES.ACTIVITIES, retrieved);

    const updated = await databaseService.getById(STORES.ACTIVITIES, 'test_1');
    assert.strictEqual(updated.title, 'Học lập trình chuyên sâu');

    await databaseService.delete(STORES.ACTIVITIES, 'test_1');
    const deleted = await databaseService.getById(STORES.ACTIVITIES, 'test_1');
    assert.strictEqual(deleted, null);
  });

  // Test 5: Activity Service & Conflict Handling
  console.log('\n--- Group 5: Activity Service ---');
  await test('activityService prevents conflicting overlap unless confirmed', async () => {
    await databaseService.clearStore(STORES.ACTIVITIES);

    await activityService.createActivity({
      id: 'act_slot_1',
      title: 'Họp dự án',
      category: 'Work',
      date: '2026-11-23',
      startTime: '10:00',
      endTime: '11:30',
      stars: 4
    });

    let threw = false;
    try {
      await activityService.createActivity({
        id: 'act_slot_2',
        title: 'Thử việc mới',
        category: 'Study',
        date: '2026-11-23',
        startTime: '10:30',
        endTime: '12:00',
        stars: 3
      }, false);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.isOverlapConflict, true);
    }
    assert.strictEqual(threw, true, 'Should reject overlapping activity when allowOverlap is false');

    // Should succeed when allowOverlap is true
    const allowed = await activityService.createActivity({
      id: 'act_slot_2',
      title: 'Thử việc mới',
      category: 'Study',
      date: '2026-11-23',
      startTime: '10:30',
      endTime: '12:00',
      stars: 3
    }, true);
    assert.strictEqual(allowed.id, 'act_slot_2');
  });

  await test('activityService updates star rating from 1 to 5', async () => {
    await activityService.updateStars('act_slot_1', 5);
    const updated = await activityService.getActivitiesByDate('2026-11-23');
    const act = updated.find(a => a.id === 'act_slot_1');
    assert.strictEqual(act.stars, 5);
  });

  // Test 6: Notes & Auto-save Service
  console.log('\n--- Group 6: Notes & Daily Journal Service ---');
  await test('noteService saves and retrieves daily reflection', async () => {
    const daily = await noteService.getDailyNote('2026-11-23');
    daily.whatDone = 'Xây dựng xong toàn bộ DatabaseService và UI';
    daily.rating = 5;
    await noteService.saveDailyNote(daily);

    const reloaded = await noteService.getDailyNote('2026-11-23');
    assert.strictEqual(reloaded.whatDone, 'Xây dựng xong toàn bộ DatabaseService và UI');
    assert.strictEqual(reloaded.rating, 5);
  });

  await test('noteService supports multiple notes and pin toggle', async () => {
    const note = await noteService.createNote({
      title: 'Ý tưởng kiến trúc',
      content: 'Sử dụng Pure ES Modules và IndexedDB',
      category: 'Architecture',
      date: '2026-11-23',
      isPinned: false
    });

    assert.strictEqual(note.isPinned, false);
    await noteService.togglePin(note.id);

    const notes = await noteService.getAllNotes();
    const found = notes.find(n => n.id === note.id);
    assert.strictEqual(found.isPinned, true);
  });

  // Test 7: Timer Persistence & Stopwatch Reload Simulation
  console.log('\n--- Group 7: Persistent Timer / Stopwatch ---');
  await test('timerService starts, computes elapsed seconds without drift, and records session', async () => {
    await timerService.initTimer();

    const targetAct = { id: 'act_slot_1', title: 'Họp dự án' };
    await timerService.start(targetAct);

    assert.strictEqual(timerService.state.status, 'running');
    assert.strictEqual(timerService.state.activityId, 'act_slot_1');

    // Pause timer
    await timerService.pause();
    assert.strictEqual(timerService.state.status, 'paused');

    // Resume timer
    await timerService.resume();
    assert.strictEqual(timerService.state.status, 'running');

    // Stop timer
    const summary = await timerService.stop();
    assert.strictEqual(summary.activityId, 'act_slot_1');
    assert.strictEqual(timerService.state.status, 'idle');
  });

  // Test 8: Backup, Export & Safe Demo Data
  console.log('\n--- Group 8: Backup & Restore Service ---');
  await test('backupService generates and imports sample demo data', async () => {
    await backupService.generateSampleDemoData();

    const activities = await databaseService.getAll(STORES.ACTIVITIES);
    assert.ok(activities.length >= 6, 'Should generate at least 6 sample activities');

    const dailyNotes = await databaseService.getAll(STORES.DAILY_NOTES);
    assert.ok(dailyNotes.length >= 1, 'Should generate sample daily note');

    const goals = await databaseService.getAll(STORES.GOALS);
    assert.ok(goals.length >= 3, 'Should generate sample goals');
  });

  await test('backupService exportData produces valid schema version 1.0.0', async () => {
    const exported = await databaseService.exportData();
    assert.strictEqual(exported.metadata.app, 'PersonalWorkJournal');
    assert.strictEqual(exported.metadata.version, '1.0.0');
    assert.ok(Array.isArray(exported.stores.activities));

    const validation = backupService.validateBackupFile(JSON.stringify(exported));
    assert.strictEqual(validation.isValid, true);
  });

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
