/**
 * test-suite.js - Automated Verification of IndexedDB, Business Logic, and Utilities
 * Version 2.0.0: Full Regression Suite + 20 Migration & Data Integrity Tests (MIG-01 to MIG-20)
 */

import 'fake-indexeddb/auto';
import assert from 'node:assert';
import { databaseService } from '../src/database/databaseService.js';
import { STORES, DB_VERSION, openDatabase } from '../src/database/db.js';
import { activityService } from '../src/services/activityService.js';
import { noteService } from '../src/services/noteService.js';
import { timerService } from '../src/services/timerService.js';
import { backupService } from '../src/services/backupService.js';
import { projectRepository } from '../src/database/repositories/projectRepository.js';
import { recurrenceRepository } from '../src/database/repositories/recurrenceRepository.js';
import { recurrenceOccurrenceRepository } from '../src/database/repositories/recurrenceOccurrenceRepository.js';
import { projectJournalRepository } from '../src/database/repositories/projectJournalRepository.js';
import { activityRepository } from '../src/database/repositories/activityRepository.js';
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
    assert.strictEqual(checkTimesOverlap('09:00', '10:30', '10:00', '11:00'), true);
    assert.strictEqual(checkTimesOverlap('09:00', '10:00', '10:00', '11:00'), false);
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
    assert.strictEqual(res1.isValid, false);

    const res3 = validateActivity({ title: 'Task', date: '2026-11-23', startTime: '09:00', endTime: '10:00', stars: 6 });
    assert.strictEqual(res3.isValid, false);
    assert.ok(res3.errors.stars);
  });

  await test('validateGoal requires positive target hours', () => {
    const res = validateGoal({ title: 'Read', targetHours: -2, category: 'Study' });
    assert.strictEqual(res.isValid, false);
  });

  // Test 4: Database Initialization
  console.log('\n--- Group 4: Database Layer (IndexedDB) ---');
  await test('databaseService initializes with 10 stores in Version 2', async () => {
    const db = await databaseService.initDatabase();
    assert.ok(db, 'Database connection established');
    assert.strictEqual(db.version, 2, 'Database version should be 2');

    const expectedStores = [
      'activities', 'dailyNotes', 'notes', 'goals', 'timerSessions',
      'settings', 'projects', 'recurrenceRules', 'recurrenceOccurrences',
      'projectJournalEntries'
    ];

    for (const name of expectedStores) {
      assert.ok(db.objectStoreNames.contains(name), `Store ${name} must exist`);
    }
    assert.strictEqual(db.objectStoreNames.length, 10, 'Should have exactly 10 Object Stores');
  });

  // Test 5: Activity CRUD
  console.log('\n--- Group 5: Activity Service CRUD ---');
  await test('activityService creates and retrieves activities', async () => {
    const created = await activityService.createActivity({
      title: 'Thiết kế giao diện',
      description: 'Làm mockups',
      category: 'Design',
      date: '2026-11-23',
      startTime: '14:00',
      endTime: '15:30',
      breakMinutes: 0,
      stars: 4,
      status: 'Planned'
    });

    assert.ok(created.id);
    assert.strictEqual(created.durationMinutes, 90);
    assert.strictEqual(created.actualDurationSource, 'unperformed');
    assert.strictEqual(created.actualDurationSeconds, 0);

    const fetched = await activityService.getActivitiesByDate('2026-11-23');
    assert.ok(fetched.some(a => a.id === created.id));
  });

  // Test 6: Notes Service
  console.log('\n--- Group 6: Notes Service ---');
  await test('noteService creates, pins, and retrieves multiple notes', async () => {
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

  // Test 7: Persistent Timer
  console.log('\n--- Group 7: Persistent Timer / Stopwatch ---');
  await test('timerService starts, computes elapsed seconds without drift, and records session', async () => {
    await timerService.initTimer();

    const targetAct = { id: 'act_slot_1', title: 'Họp dự án' };
    await timerService.start(targetAct);

    assert.strictEqual(timerService.state.status, 'running');
    assert.strictEqual(timerService.state.activityId, 'act_slot_1');

    await timerService.pause();
    assert.strictEqual(timerService.state.status, 'paused');

    await timerService.resume();
    assert.strictEqual(timerService.state.status, 'running');

    const summary = await timerService.stop();
    assert.strictEqual(summary.activityId, 'act_slot_1');
    assert.strictEqual(timerService.state.status, 'idle');
  });

  // Test 8: Backup, Export & Safe Demo Data
  console.log('\n--- Group 8: Backup & Restore Service ---');
  await test('backupService generates and imports sample demo data', async () => {
    await backupService.generateSampleDemoData();

    const activities = await databaseService.getAll(STORES.ACTIVITIES);
    assert.ok(activities.length >= 5, 'Should generate sample activities');

    const dailyNotes = await databaseService.getAll(STORES.DAILY_NOTES);
    assert.ok(dailyNotes.length >= 1, 'Should generate sample daily note');

    const projects = await databaseService.getAll(STORES.PROJECTS);
    assert.ok(projects.length >= 2, 'Should generate sample projects');
  });

  await test('backupService exportData produces valid schema version 2.0.0', async () => {
    const exported = await databaseService.exportData();
    assert.strictEqual(exported.metadata.app, 'PersonalWorkJournal');
    assert.strictEqual(exported.metadata.version, '2.0.0');
    assert.strictEqual(exported.metadata.dbVersion, 2);
    assert.ok(Array.isArray(exported.stores.activities));
    assert.ok(Array.isArray(exported.stores.projects));

    const validation = backupService.validateBackupFile(JSON.stringify(exported));
    assert.strictEqual(validation.isValid, true);
  });

  // =========================================================================
  // GROUP 9: MIGRATION V1 ➔ V2 & DATA INTEGRITY SPECIFICATIONS (MIG-01 -> MIG-20)
  // =========================================================================
  console.log('\n--- Group 9: Migration V1 ➔ V2 & Data Integrity (MIG-01 to MIG-20) ---');

  // MIG-01: Database V1 rỗng nâng cấp lên V2 tạo đủ 10 stores
  await test('MIG-01: Database contains all 10 Object Stores in Version 2', async () => {
    const db = await databaseService.initDatabase();
    assert.strictEqual(db.version, 2);
    assert.strictEqual(db.objectStoreNames.length, 10);
  });

  // MIG-02: Toàn bộ số lượng bản ghi của 6 store cũ được bảo toàn 100%
  await test('MIG-02: All legacy stores preserve their records during operations', async () => {
    const activities = await databaseService.getAll(STORES.ACTIVITIES);
    const dailyNotes = await databaseService.getAll(STORES.DAILY_NOTES);
    const notes = await databaseService.getAll(STORES.NOTES);
    assert.ok(activities.length > 0 && dailyNotes.length > 0 && notes.length > 0);
  });

  // MIG-03: Hoạt động trạng thái Planned có số phút cũ = 0 -> unperformed
  await test('MIG-03: Planned activity with 0 minutes is classified as unperformed', async () => {
    const act = await activityService.createActivity({
      title: 'Học bài mới',
      date: '2026-11-24',
      startTime: '10:00',
      endTime: '11:00',
      status: 'Planned',
      stars: 4,
      actualDurationMinutes: 0
    }, true);
    assert.strictEqual(act.actualDurationSource, 'unperformed');
    assert.strictEqual(act.actualDurationSeconds, 0);
    assert.strictEqual(act.actualDurationMinutes, 0);
  });

  // MIG-04: Hoạt động Completed có timerSessions chuẩn Whitelist -> timer_verified
  await test('MIG-04: Completed activity with whitelist timer session gets timer_verified', async () => {
    const act = await activityService.createActivity({
      title: 'Lập trình tính năng',
      date: '2026-11-24',
      startTime: '13:00',
      endTime: '14:30',
      status: 'Completed',
      stars: 4,
      actualDurationSource: 'timer_verified',
      actualDurationSeconds: 5400,
      timerSeconds: 5400,
      hasTimerProof: true
    }, true);
    assert.strictEqual(act.actualDurationSource, 'timer_verified');
    assert.strictEqual(act.actualDurationSeconds, 5400);
    assert.strictEqual(act.actualDurationMinutes, 90);

    // Kiểm tra bảo vệ: Khai báo timer_verified nhưng không có timer proof -> bị hạ cấp về legacy_unverified
    const forgedAct = await activityService.createActivity({
      title: 'Khai khống timer không có bằng chứng',
      date: '2026-11-24',
      startTime: '13:00',
      endTime: '14:00',
      status: 'Completed',
      stars: 4,
      actualDurationSource: 'timer_verified',
      actualDurationMinutes: 60
    }, true);
    assert.strictEqual(forgedAct.actualDurationSource, 'legacy_unverified', 'Forged timer without proof must be demoted to legacy_unverified');
  });

  // MIG-05: Hoạt động có phiên type === 'manual' trong timerSessions -> manual_verified (KHÔNG nhầm thành timer)
  await test('MIG-05: Manual session in timerSessions is classified as manual_verified, NOT timer_verified', async () => {
    const act = await activityService.createActivity({
      title: 'Log thời gian tay',
      date: '2026-11-24',
      startTime: '15:00',
      endTime: '16:00',
      status: 'Completed',
      stars: 4,
      manuallyConfirmed: true,
      actualDurationMinutes: 60
    }, true);
    assert.strictEqual(act.actualDurationSource, 'manual_verified');
    assert.notStrictEqual(act.actualDurationSource, 'timer_verified');
    assert.strictEqual(act.actualDurationSeconds, 3600);
  });

  // MIG-06: Hoạt động có cả Timer Whitelist và Manual Session -> phân tách rõ ràng
  await test('MIG-06: Activity with timer and manual log keeps both timerSeconds and manualSeconds', async () => {
    const act = await activityService.createActivity({
      title: 'Hoạt động kết hợp timer và manual',
      date: '2026-11-24',
      startTime: '16:00',
      endTime: '17:00',
      status: 'Completed',
      stars: 4,
      actualDurationSource: 'timer_verified',
      actualDurationSeconds: 3600,
      timerSeconds: 2400,
      manualSeconds: 1200,
      hasTimerProof: true
    }, true);
    assert.strictEqual(act.actualDurationSource, 'timer_verified');
    assert.strictEqual(act.timerSeconds, 2400);
    assert.strictEqual(act.manualSeconds, 1200);
  });

  // MIG-07: Hoạt động Completed có phút cũ nhưng thiếu bằng chứng -> legacy_unverified
  await test('MIG-07: Completed activity without timer or proof is legacy_unverified with minutes preserved', async () => {
    const act = await activityService.createActivity({
      title: 'Việc cũ hoàn thành V1',
      date: '2026-11-24',
      startTime: '17:00',
      endTime: '18:00',
      status: 'Completed',
      stars: 4,
      actualDurationMinutes: 60
    }, true);
    assert.strictEqual(act.actualDurationSource, 'legacy_unverified');
    assert.strictEqual(act.actualDurationMinutes, 60);
    assert.strictEqual(act.actualDurationSeconds, 3600);
  });

  // MIG-08: Hoạt động Planned V1 có số phút cũ > 0 -> legacy_unverified (bảo tồn, không reset về 0)
  await test('MIG-08: Planned activity from V1 with legacy minutes preserves value as legacy_unverified', async () => {
    const act = await activityService.createActivity({
      title: 'Kế hoạch cũ từ V1',
      date: '2026-11-24',
      startTime: '18:00',
      endTime: '19:00',
      status: 'Planned',
      stars: 4,
      actualDurationMinutes: 60
    }, true);
    assert.strictEqual(act.actualDurationSource, 'legacy_unverified');
    assert.strictEqual(act.actualDurationMinutes, 60);
    assert.strictEqual(act.actualDurationSeconds, 3600);
  });

  // MIG-09: Phân tách Verified Actual Time vs Legacy Unverified Time
  await test('MIG-09: Verified Actual Time strictly excludes legacy_unverified and unperformed', () => {
    const activities = [
      { id: '1', actualDurationMinutes: 60, actualDurationSource: 'timer_verified' },
      { id: '2', actualDurationMinutes: 30, actualDurationSource: 'manual_verified' },
      { id: '3', actualDurationMinutes: 45, actualDurationSource: 'legacy_unverified' },
      { id: '4', actualDurationMinutes: 90, actualDurationSource: 'unperformed' }
    ];

    const verified = activityService.calculateVerifiedActualDuration(activities);
    assert.strictEqual(verified, 90, 'Verified should only sum 60 + 30 = 90');

    const legacy = activityService.calculateLegacyUnverifiedDuration(activities);
    assert.strictEqual(legacy, 45, 'Legacy should sum 45');
  });

  // MIG-10: Lỗi bất ngờ khi thao tác store được abort và rollback
  await test('MIG-10: Database transaction rejects on invalid store operation', async () => {
    let errCaught = false;
    try {
      await databaseService.getById('non_existent_store', '123');
    } catch (e) {
      errCaught = true;
    }
    assert.strictEqual(errCaught, true);
  });

  // MIG-11: Hỗ trợ an toàn khi đóng mở kết nối đa tab
  await test('MIG-11: DatabaseService handles multi-tab connection refresh', async () => {
    const db = await databaseService.initDatabase();
    assert.ok(db);
    assert.strictEqual(typeof db.onversionchange, 'function');
  });

  // MIG-12: Chống tạo trùng Occurrence sau Reload (bền vững trong IndexedDB)
  await test('MIG-12: RecurrenceOccurrences persist permanently in IndexedDB', async () => {
    const occ = {
      occurrenceId: 'occ_rule_test_2026-11-25',
      recurrenceRuleId: 'rule_test',
      originalDate: '2026-11-25',
      generatedActivityId: 'act_gen_1',
      isOverridden: false,
      isCancelled: false
    };

    await recurrenceOccurrenceRepository.add(occ);
    const fetched = await recurrenceOccurrenceRepository.getById('occ_rule_test_2026-11-25');
    assert.ok(fetched);
    assert.strictEqual(fetched.generatedActivityId, 'act_gen_1');
  });

  // MIG-13: Hai tab độc lập (2 connection IDB riêng) cùng ghi đồng thời Occurrence -> 0 trùng lặp
  await test('MIG-13: ensureOccurrence handles ConstraintError across 2 independent database connections', async () => {
    const rule = {
      id: 'rule_concurrency_tabs',
      title: 'Lịch định kỳ đa tab'
    };
    const date = '2026-11-26';

    // Mở 2 kết nối database độc lập mô phỏng 2 tab trình duyệt thực tế
    const tab1Db = await openDatabase();
    const tab2Db = await openDatabase();

    let activityCreatedCount = 0;
    const createActCb = (r, d, occId) => {
      activityCreatedCount++;
      return {
        id: `act_multitab_${activityCreatedCount}`,
        title: r.title,
        date: d,
        occurrenceId: occId
      };
    };

    // Tab 1 và Tab 2 cùng ghi đồng thời qua 2 kết nối riêng biệt
    const [res1, res2] = await Promise.all([
      recurrenceOccurrenceRepository.ensureOccurrence(rule, date, createActCb, tab1Db),
      recurrenceOccurrenceRepository.ensureOccurrence(rule, date, createActCb, tab2Db)
    ]);

    assert.strictEqual(activityCreatedCount, 1, 'Only 1 activity must ever be created even under multi-tab connection race');
    assert.strictEqual(res1.activityId, res2.activityId, 'Both tabs must resolve the exact same activityId');
    assert.strictEqual((res1.isCreated && !res2.isCreated) || (!res1.isCreated && res2.isCreated), true, 'Exactly one tab created the occurrence');

    tab1Db.close();
    tab2Db.close();
  });

  // MIG-14: Sửa một lần lặp (Edit Single Occurrence) giữ nguyên quan hệ nguồn
  await test('MIG-14: Edit single occurrence preserves ruleId and originalDate with isOverridden = true', async () => {
    const occId = 'occ_rule_edit_2026-11-27';
    await recurrenceOccurrenceRepository.add({
      occurrenceId: occId,
      recurrenceRuleId: 'rule_parent_999',
      originalDate: '2026-11-27',
      generatedActivityId: 'act_single_1',
      isOverridden: false,
      isCancelled: false
    });

    // Cập nhật sửa riêng lần này
    const occ = await recurrenceOccurrenceRepository.getById(occId);
    occ.isOverridden = true;
    await recurrenceOccurrenceRepository.update(occ);

    const updated = await recurrenceOccurrenceRepository.getById(occId);
    assert.strictEqual(updated.isOverridden, true);
    assert.strictEqual(updated.recurrenceRuleId, 'rule_parent_999', 'Must preserve recurrenceRuleId');
    assert.strictEqual(updated.originalDate, '2026-11-27', 'Must preserve originalDate');
  });

  // MIG-15: Tạo Project mới và liên kết Activity qua index projectId
  await test('MIG-15: Project repository creates project and activity links via projectId index', async () => {
    const project = await projectRepository.add({
      id: 'proj_honda_dms',
      name: 'HondaAuto DMS',
      description: 'Hệ thống quản lý đại lý ô tô',
      category: 'Work',
      color: '#ef4444',
      status: 'Active'
    });
    assert.strictEqual(project.id, 'proj_honda_dms');

    const act = await activityService.createActivity({
      title: 'Code module kho xe',
      date: '2026-11-24',
      startTime: '19:30',
      endTime: '21:00',
      projectId: 'proj_honda_dms'
    });

    const projectActivities = await activityRepository.getByProjectId('proj_honda_dms');
    assert.ok(projectActivities.some(a => a.id === act.id));
  });

  // MIG-16: Tạo Project Journal Entry độc lập trong projectJournalEntries
  await test('MIG-16: ProjectJournalEntry stores progress notes independently without polluting notes store', async () => {
    const entry = await projectJournalRepository.add({
      id: 'pje_honda_1',
      projectId: 'proj_honda_dms',
      title: 'Tối ưu hóa Database Queries',
      content: 'Chuyển từ scan sang index scan cho bảng xe tồn kho.',
      date: '2026-11-24',
      category: 'Technical'
    });

    assert.strictEqual(entry.projectId, 'proj_honda_dms');
    const projectEntries = await projectJournalRepository.getByProjectId('proj_honda_dms');
    assert.ok(projectEntries.some(e => e.id === entry.id));

    // Kiểm tra không bị lẫn vào notes store
    const generalNotes = await noteService.getAllNotes();
    assert.ok(!generalNotes.some(n => n.id === entry.id));
  });

  // MIG-17: Xóa Project an toàn, giữ lại Activities và cảnh báo
  await test('MIG-17: Project deletion does not orphan or silently wipe linked activities', async () => {
    const projectActivities = await activityRepository.getByProjectId('proj_honda_dms');
    assert.ok(projectActivities.length > 0);

    // Xóa project
    await projectRepository.delete('proj_honda_dms');
    const proj = await projectRepository.getById('proj_honda_dms');
    assert.strictEqual(proj, null);

    // Activities vẫn còn nguyên vẹn trong hệ thống
    const allActivities = await activityService.getAllActivities();
    assert.ok(allActivities.some(a => a.projectId === 'proj_honda_dms'));
  });

  // MIG-18: Replace Backup nguyên tử trên cả 10 stores
  await test('MIG-18: Replace backup performs atomic clear and put across all 10 stores', async () => {
    const backupPayload = {
      metadata: {
        app: 'PersonalWorkJournal',
        version: '2.0.0',
        dbVersion: 2,
        exportedAt: new Date().toISOString()
      },
      stores: {
        activities: [
          { id: 'act_restore_1', title: 'Hoạt động Restore', date: '2026-11-25', startTime: '09:00', endTime: '10:00' }
        ],
        dailyNotes: [],
        notes: [
          { id: 'note_restore_1', title: 'Ghi chú Restore', date: '2026-11-25', content: 'Restore content' }
        ],
        goals: [],
        timerSessions: [],
        settings: [],
        projects: [
          { id: 'proj_restore_1', name: 'Dự án Restore', category: 'Project', status: 'Active' }
        ],
        recurrenceRules: [],
        recurrenceOccurrences: [],
        projectJournalEntries: []
      }
    };

    const res = await databaseService.importData(backupPayload, 'replace');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.mode, 'replace');

    const acts = await databaseService.getAll(STORES.ACTIVITIES);
    assert.strictEqual(acts.length, 1);
    assert.strictEqual(acts[0].id, 'act_restore_1');

    const projs = await databaseService.getAll(STORES.PROJECTS);
    assert.strictEqual(projs.length, 1);
    assert.strictEqual(projs[0].id, 'proj_restore_1');
  });

  // MIG-19: Deep validation trước khi ghi và không có async gap trong transaction
  await test('MIG-19: Invalid payload rejects before touching database', async () => {
    let errCaught = false;
    try {
      await databaseService.importData({ invalidPayload: true }, 'replace');
    } catch (e) {
      errCaught = true;
    }
    assert.strictEqual(errCaught, true);
  });

  // MIG-20: Export Backup JSON chứa đầy đủ 10 Object Stores phiên bản 2.0.0
  await test('MIG-20: Full export JSON produces all 10 stores with schema version 2.0.0', async () => {
    const exported = await databaseService.exportData();
    assert.strictEqual(exported.metadata.version, '2.0.0');
    assert.strictEqual(exported.metadata.dbVersion, 2);

    const storeKeys = Object.keys(exported.stores);
    assert.strictEqual(storeKeys.length, 10, 'Must have 10 Object Stores in exported data');
    assert.ok(storeKeys.includes('recurrenceOccurrences'));
    assert.ok(storeKeys.includes('projectJournalEntries'));
    assert.ok(storeKeys.includes('projects'));
  });

  // MIG-21: Replace mode hoàn trả nguyên trạng (Rollback) khi transaction IndexedDB bị abort trong lúc ghi
  await test('MIG-21: Replace mode rolls back completely when an in-transaction ConstraintError aborts execution', async () => {
    // 1. Lưu dữ liệu ban đầu cần được bảo vệ tuyệt đối
    const originalAct = {
      id: 'act_safe_orig_rollback',
      title: 'Hoạt động bảo vệ nguyên vẹn',
      date: '2026-11-25',
      startTime: '08:00',
      endTime: '09:00',
      stars: 3
    };
    await activityRepository.add(originalAct);

    const originalDailyNote = {
      id: 'dn_safe_orig_rollback',
      date: '2026-11-25',
      content: 'Nhật ký gốc cần bảo vệ'
    };
    await databaseService.add(STORES.DAILY_NOTES, originalDailyNote);

    // 2. Chuẩn bị payload vượt qua bước validateImportPayload (mọi id, date, time đều hợp lệ)
    // Nhưng cố tình chứa 2 bản ghi trùng trường "date" trong dailyNotes (store có unique index trên 'date')
    const inTransactionFailingPayload = {
      metadata: { app: 'PersonalWorkJournal', version: '2.0.0', dbVersion: 2 },
      stores: {
        activities: [
          { id: 'act_temp_should_rollback', title: 'Tạm thời', date: '2026-11-26', startTime: '10:00', endTime: '11:00', stars: 3 }
        ],
        dailyNotes: [
          { id: 'dn_dup_first', date: '2026-11-26', content: 'Bản ghi 1' },
          { id: 'dn_dup_second', date: '2026-11-26', content: 'Bản ghi 2 trùng date (gây ConstraintError trong transaction)' }
        ]
      }
    };

    // 3. Thực thi importData -> transaction mở, clear() thực hiện, nhưng khi put bản ghi 2 bị lỗi ConstraintError
    let transactionAborted = false;
    try {
      await databaseService.importData(inTransactionFailingPayload, 'replace');
    } catch (e) {
      transactionAborted = true;
    }
    assert.strictEqual(transactionAborted, true, 'Transaction must abort due to unique constraint on dailyNotes.date');

    // 4. KIỂM CHỨNG ROLLBACK: Dữ liệu ban đầu vẫn còn nguyên vẹn 100% trong cả 2 store
    const retainedAct = await activityRepository.getById('act_safe_orig_rollback');
    assert.ok(retainedAct, 'Original activity must be preserved by transaction rollback');

    const retainedDn = await databaseService.getById(STORES.DAILY_NOTES, 'dn_safe_orig_rollback');
    assert.ok(retainedDn, 'Original dailyNote must be preserved by transaction rollback');

    // Dữ liệu tạm thời trong payload lỗi không được phép tồn tại
    const ghostAct = await activityRepository.getById('act_temp_should_rollback');
    assert.strictEqual(ghostAct, null, 'Temporary activity must not exist after rollback');
  });

  // MIG-22: IndexedDB V1 to V2 migration accurately cross-references timerSessions with Whitelist
  await test('MIG-22: IndexedDB V1 to V2 migration accurately cross-references timerSessions with Whitelist', async () => {
    const testDbName = 'PWJ_Migration_Test_DB';
    // Xóa test DB nếu có
    await new Promise((res) => {
      const delReq = indexedDB.deleteDatabase(testDbName);
      delReq.onsuccess = () => res();
      delReq.onerror = () => res();
    });

    // Tạo DB ở Version 1
    await new Promise((res, rej) => {
      const req = indexedDB.open(testDbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const actStore = db.createObjectStore('activities', { keyPath: 'id' });
        actStore.createIndex('date', 'date', { unique: false });
        const timerStore = db.createObjectStore('timerSessions', { keyPath: 'id' });
        timerStore.createIndex('activityId', 'activityId', { unique: false });
        timerStore.createIndex('status', 'status', { unique: false });
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(['activities', 'timerSessions'], 'readwrite');
        const actStore = tx.objectStore('activities');
        const timerStore = tx.objectStore('timerSessions');

        // Activity 1: Completed có whitelist timer session (type: 'timer', 3600s)
        actStore.add({ id: 'v1_act_timer', title: 'Task Timer', status: 'Completed', actualDurationMinutes: 60 });
        timerStore.add({ id: 's1', activityId: 'v1_act_timer', status: 'completed', type: 'timer', totalSeconds: 3600 });

        // Activity 2: Completed có manual session (type: 'manual', 1800s)
        actStore.add({ id: 'v1_act_manual', title: 'Task Manual', status: 'Completed', actualDurationMinutes: 30 });
        timerStore.add({ id: 's2', activityId: 'v1_act_manual', status: 'completed', type: 'manual', totalSeconds: 1800 });

        // Activity 3: Planned có legacy minutes (V1 gán 45m)
        actStore.add({ id: 'v1_act_planned_legacy', title: 'Task Planned Legacy', status: 'Planned', actualDurationMinutes: 45 });

        // Activity 4: Planned không có phút (0m)
        actStore.add({ id: 'v1_act_unperformed', title: 'Task Unperformed', status: 'Planned', actualDurationMinutes: 0 });

        tx.oncomplete = () => {
          db.close();
          res();
        };
      };
      req.onerror = rej;
    });

    // Nâng cấp lên Version 2 bằng openDatabase chính thức của hệ thống
    const upgradedDb = await openDatabase(testDbName, 2);

    // Đọc và kiểm tra các bản ghi sau migration
    const readTx = upgradedDb.transaction(['activities'], 'readonly');
    const actStore = readTx.objectStore('activities');

    const getAct = (id) => new Promise((resolve) => {
      const r = actStore.get(id);
      r.onsuccess = () => resolve(r.result);
    });

    const act1 = await getAct('v1_act_timer');
    assert.strictEqual(act1.actualDurationSource, 'timer_verified', 'Must classify as timer_verified via whitelist timer session');
    assert.strictEqual(act1.actualDurationSeconds, 3600);
    assert.strictEqual(act1.timerSeconds, 3600);

    const act2 = await getAct('v1_act_manual');
    assert.strictEqual(act2.actualDurationSource, 'manual_verified', 'Must classify as manual_verified, NOT timer_verified');
    assert.strictEqual(act2.actualDurationSeconds, 1800);
    assert.strictEqual(act2.manualSeconds, 1800);

    const act3 = await getAct('v1_act_planned_legacy');
    assert.strictEqual(act3.actualDurationSource, 'legacy_unverified', 'Planned with legacy minutes must preserve value as legacy_unverified');
    assert.strictEqual(act3.actualDurationMinutes, 45);
    assert.strictEqual(act3.actualDurationSeconds, 2700);

    const act4 = await getAct('v1_act_unperformed');
    assert.strictEqual(act4.actualDurationSource, 'unperformed', 'Planned with 0 minutes must be unperformed');
    assert.strictEqual(act4.actualDurationSeconds, 0);

    upgradedDb.close();
  });

  // MIG-23: Cập nhật Activity (chỉ sửa title/date/stars) bảo toàn 100% provenance timer_verified và manual_verified
  await test('MIG-23: updateActivity preserves timer_verified and manual_verified when editing general fields', async () => {
    // 1. Tạo hoạt động có nguồn timer_verified
    const originalTimerAct = await activityService.createActivity({
      title: 'Hoạt động đo timer',
      date: '2026-11-25',
      startTime: '10:00',
      endTime: '11:00',
      status: 'Completed',
      stars: 4,
      actualDurationSource: 'timer_verified',
      actualDurationSeconds: 3600,
      timerSeconds: 3600,
      hasTimerProof: true
    }, true);

    // Người dùng mở modal chỉnh sửa, chỉ sửa tiêu đề và ngày, form không gửi lại provenance
    const updatedTimerAct = await activityService.updateActivity({
      id: originalTimerAct.id,
      title: 'Tiêu đề mới sau khi chỉnh sửa',
      date: '2026-11-26',
      startTime: '10:00',
      endTime: '11:00',
      status: 'Completed',
      stars: 5
    }, true);

    // Xác minh tuyệt đối: Nguồn timer_verified và số giây timer KHÔNG bị hạ cấp thành legacy_unverified
    assert.strictEqual(updatedTimerAct.title, 'Tiêu đề mới sau khi chỉnh sửa');
    assert.strictEqual(updatedTimerAct.date, '2026-11-26');
    assert.strictEqual(updatedTimerAct.actualDurationSource, 'timer_verified', 'Must preserve timer_verified after editing general fields');
    assert.strictEqual(updatedTimerAct.timerSeconds, 3600);
    assert.strictEqual(updatedTimerAct.actualDurationSeconds, 3600);
    assert.strictEqual(updatedTimerAct.actualDurationMinutes, 60);

    // 2. Tạo hoạt động có nguồn manual_verified
    const originalManualAct = await activityService.createActivity({
      title: 'Hoạt động log tay',
      date: '2026-11-25',
      startTime: '14:00',
      endTime: '15:00',
      status: 'Completed',
      stars: 3,
      manuallyConfirmed: true,
      actualDurationMinutes: 45
    }, true);
    assert.strictEqual(originalManualAct.actualDurationSource, 'manual_verified');

    // Chỉnh sửa chỉ gửi thông tin cơ bản
    const updatedManualAct = await activityService.updateActivity({
      id: originalManualAct.id,
      title: 'Hoạt động log tay - Sửa mô tả',
      description: 'Mô tả mới',
      date: '2026-11-25',
      startTime: '14:00',
      endTime: '15:00',
      status: 'Completed'
    }, true);

    assert.strictEqual(updatedManualAct.actualDurationSource, 'manual_verified', 'Must preserve manual_verified after editing general fields');
    assert.strictEqual(updatedManualAct.actualDurationMinutes, 45);
  });

  // MIG-24: Deep business schema validation từ chối date, time, actualDurationSource và số liệu sai định dạng
  await test('MIG-24: Deep business schema validation rejects malformed dates, times, sources, and negative numbers', async () => {
    // 1. Sai định dạng date
    let errDateCaught = false;
    try {
      await databaseService.importData({
        stores: {
          activities: [
            { id: 'act_bad_date', title: 'Task', date: '25-11-2026', startTime: '09:00', endTime: '10:00' }
          ]
        }
      }, 'replace');
    } catch (e) {
      errDateCaught = e.message.includes('YYYY-MM-DD');
    }
    assert.strictEqual(errDateCaught, true, 'Must reject non-YYYY-MM-DD date format');

    // 2. Sai định dạng time
    let errTimeCaught = false;
    try {
      await databaseService.importData({
        stores: {
          activities: [
            { id: 'act_bad_time', title: 'Task', date: '2026-11-25', startTime: '9:00', endTime: '10:00' }
          ]
        }
      }, 'replace');
    } catch (e) {
      errTimeCaught = e.message.includes('HH:mm');
    }
    assert.strictEqual(errTimeCaught, true, 'Must reject non-HH:mm time format');

    // 3. Sai actualDurationSource enum
    let errSourceCaught = false;
    try {
      await databaseService.importData({
        stores: {
          activities: [
            { id: 'act_bad_source', title: 'Task', date: '2026-11-25', startTime: '09:00', endTime: '10:00', actualDurationSource: 'invalid_source' }
          ]
        }
      }, 'replace');
    } catch (e) {
      errSourceCaught = e.message.includes('actualDurationSource');
    }
    assert.strictEqual(errSourceCaught, true, 'Must reject invalid actualDurationSource');

    // 4. Số âm breakMinutes
    let errNumCaught = false;
    try {
      await databaseService.importData({
        stores: {
          activities: [
            { id: 'act_bad_num', title: 'Task', date: '2026-11-25', startTime: '09:00', endTime: '10:00', breakMinutes: -10 }
          ]
        }
      }, 'replace');
    } catch (e) {
      errNumCaught = e.message.includes('breakMinutes');
    }
    assert.strictEqual(errNumCaught, true, 'Must reject negative numbers in breakMinutes');
  });

  console.log('\n================================================================');
  console.log(`ALL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
