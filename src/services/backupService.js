/**
 * backupService.js - Export, Import and Safe Demo Data Generator
 * Full support for 10 Object Stores in Version 2.0.0
 */

import { databaseService } from '../database/databaseService.js';
import { STORES } from '../database/db.js';
import { getTodayDateString, addDays } from '../utils/dateUtils.js';

class BackupService {
  /**
   * Export all data to JSON and trigger browser download
   */
  async exportJSON() {
    const data = await databaseService.exportData();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const today = getTodayDateString();
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = url;
      a.download = `personal_work_journal_backup_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return data;
  }

  /**
   * Validate uploaded backup JSON
   * @param {string} jsonString
   */
  validateBackupFile(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { isValid: false, message: 'Nội dung file không phải JSON hợp lệ' };
      }

      if (!parsed.stores || typeof parsed.stores !== 'object') {
        return { isValid: false, message: 'File thiếu cấu trúc các Object Stores chuẩn' };
      }

      const stats = {};
      for (const storeName of Object.values(STORES)) {
        stats[storeName] = Array.isArray(parsed.stores[storeName]) ? parsed.stores[storeName].length : 0;
      }

      return {
        isValid: true,
        data: parsed,
        stats: {
          activitiesCount: stats.activities || 0,
          dailyNotesCount: stats.dailyNotes || 0,
          notesCount: stats.notes || 0,
          goalsCount: stats.goals || 0,
          projectsCount: stats.projects || 0,
          recurrenceRulesCount: stats.recurrenceRules || 0,
          recurrenceOccurrencesCount: stats.recurrenceOccurrences || 0,
          projectJournalEntriesCount: stats.projectJournalEntries || 0,
          timerSessionsCount: stats.timerSessions || 0,
          allStats: stats
        }
      };
    } catch (e) {
      return { isValid: false, message: 'Lỗi phân tích JSON: ' + e.message };
    }
  }

  /**
   * Import data with Replace or Merge
   */
  async importJSON(backupData, mode = 'replace') {
    return await databaseService.importData(backupData, mode);
  }

  /**
   * Populate rich sample/demo data for initial experience
   */
  async generateSampleDemoData() {
    const today = getTodayDateString();
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);

    const demoProjects = [
      {
        id: 'proj_demo_1',
        name: 'Personal Work Journal 2.0',
        description: 'Nâng cấp hệ thống quản lý lịch trình, thời gian và nhật ký cá nhân',
        category: 'Project',
        color: '#2563eb',
        icon: 'folder-kanban',
        startDate: yesterday,
        targetDate: addDays(today, 14),
        status: 'Active'
      },
      {
        id: 'proj_demo_2',
        name: 'Nghiên cứu Kỹ thuật Frontend Clean Architecture',
        description: 'Tài liệu và chuẩn thiết kế các hệ thống Frontend Offline-First',
        category: 'Study',
        color: '#7c3aed',
        icon: 'book-open',
        startDate: addDays(today, -5),
        targetDate: addDays(today, 10),
        status: 'Active'
      }
    ];

    const demoActivities = [
      {
        id: 'act_demo_1',
        title: 'Lập kế hoạch làm việc & Standup sáng',
        description: 'Xác định các mục tiêu ưu tiên trong ngày, đồng bộ tài liệu dự án',
        category: 'Work',
        date: today,
        startTime: '08:00',
        endTime: '08:45',
        breakMinutes: 0,
        durationMinutes: 45,
        actualDurationMinutes: 45,
        actualDurationSeconds: 2700,
        actualDurationSource: 'manual_verified',
        stars: 4,
        status: 'Completed',
        relatedNote: 'Bắt đầu tuần mới nhiều năng lượng',
        projectId: 'proj_demo_1'
      },
      {
        id: 'act_demo_2',
        title: 'Phát triển module Timeline và IndexedDB V2',
        description: 'Viết DatabaseService, Repositories, xử lý lưu trữ 10 stores offline',
        category: 'Project',
        date: today,
        startTime: '09:00',
        endTime: '11:30',
        breakMinutes: 10,
        durationMinutes: 140,
        actualDurationMinutes: 140,
        actualDurationSeconds: 8400,
        actualDurationSource: 'timer_verified',
        stars: 5,
        status: 'Completed',
        relatedNote: 'Hoàn thành tốt cấu trúc transactions',
        projectId: 'proj_demo_1'
      },
      {
        id: 'act_demo_3',
        title: 'Nghỉ trưa & Cà phê thư giãn',
        description: 'Ăn trưa lành mạnh và nghe podcast về UI/UX Design',
        category: 'Break',
        date: today,
        startTime: '11:45',
        endTime: '13:00',
        breakMinutes: 0,
        durationMinutes: 75,
        actualDurationMinutes: 75,
        actualDurationSeconds: 4500,
        actualDurationSource: 'manual_verified',
        stars: 3,
        status: 'Completed',
        relatedNote: '',
        projectId: null
      },
      {
        id: 'act_demo_4',
        title: 'Nghiên cứu Kiến trúc Clean Frontend & Web Vitals',
        description: 'Đọc tài liệu tối ưu hóa hiệu năng JavaScript và IndexedDB index caching',
        category: 'Study',
        date: today,
        startTime: '13:30',
        endTime: '15:30',
        breakMinutes: 15,
        durationMinutes: 105,
        actualDurationMinutes: 105,
        actualDurationSeconds: 6300,
        actualDurationSource: 'timer_verified',
        stars: 4,
        status: 'In Progress',
        relatedNote: 'Ghi chú thêm phần debounce autosave',
        projectId: 'proj_demo_2'
      },
      {
        id: 'act_demo_5',
        title: 'Review thiết kế & Thử nghiệm Stopwatch Timer',
        description: 'Kiểm tra hoạt động của Timer khi refresh tab và đóng trình duyệt',
        category: 'Project',
        date: today,
        startTime: '15:45',
        endTime: '17:30',
        breakMinutes: 0,
        durationMinutes: 105,
        actualDurationMinutes: 0,
        actualDurationSeconds: 0,
        actualDurationSource: 'unperformed',
        stars: 4,
        status: 'Planned',
        relatedNote: 'Cần kiểm tra trên nhiều thiết bị',
        projectId: 'proj_demo_1'
      }
    ];

    const demoDailyNote = {
      id: `daily_${today}`,
      date: today,
      title: `Nhật ký ngày ${today}`,
      content: `# Tổng kết ngày hôm nay\n\n- Tập trung phát triển nền tảng Database V2 với 10 Object Stores.\n- Xử lý cơ chế Atomic Single-Transaction Replace và chống tạo trùng đa tab.\n- Cảm thấy hiệu suất rất tốt!`,
      mood: 'Tích cực, tập trung',
      tags: ['Upgrade', 'V2', 'IndexedDB', 'Architecture']
    };

    const demoNotes = [
      {
        id: 'note_demo_1',
        title: 'Kiến trúc Transaction IndexedDB ACID',
        content: 'Mọi thay đổi dữ liệu trong chế độ Replace đều gom vào 1 single readwrite transaction qua cả 10 stores. Không có async gap.',
        category: 'Technical',
        date: today,
        isPinned: true,
        tags: ['IndexedDB', 'Architecture']
      },
      {
        id: 'note_demo_2',
        title: 'Mô hình Recurrence Occurrence Idempotent',
        content: 'Khóa occurrenceId = occ_${ruleId}_${date}. Xử lý ConstraintError bằng preventDefault() hoặc fallback readonly transaction.',
        category: 'Ideas',
        date: today,
        isPinned: false,
        tags: ['Recurrence', 'Concurrency']
      }
    ];

    const demoGoals = [
      {
        id: 'goal_demo_1',
        title: 'Làm việc tập trung sâu tuần này',
        targetHours: 35,
        period: 'week',
        category: 'Work',
        status: 'Active',
        startDate: yesterday,
        endDate: addDays(today, 6)
      },
      {
        id: 'goal_demo_2',
        title: 'Đọc sách kỹ thuật & học công nghệ mới',
        targetHours: 8,
        period: 'week',
        category: 'Study',
        status: 'Active',
        startDate: yesterday,
        endDate: addDays(today, 6)
      }
    ];

    const demoJournalEntries = [
      {
        id: 'pje_demo_1',
        projectId: 'proj_demo_1',
        title: 'Khởi động Phase 1: Nền tảng Core System & Data Integrity',
        content: 'Đã hoàn thành thiết kế schema 10 stores, migration cursor và atomic replace.',
        date: today,
        category: 'Milestone',
        keyResults: 'Bảo toàn 100% dữ liệu cũ, không mất mát',
        challenges: 'Đồng bộ hóa tranh chấp tạo occurrence giữa 2 tab',
        nextSteps: 'Tiếp tục triển khai Phase 2: Advanced Time Management',
        linkedActivityIds: ['act_demo_2']
      }
    ];

    const demoData = {
      metadata: {
        app: 'PersonalWorkJournal',
        version: '2.0.0',
        dbVersion: 2,
        exportedAt: new Date().toISOString()
      },
      stores: {
        activities: demoActivities,
        dailyNotes: [demoDailyNote],
        notes: demoNotes,
        goals: demoGoals,
        timerSessions: [],
        settings: [],
        projects: demoProjects,
        recurrenceRules: [],
        recurrenceOccurrences: [],
        projectJournalEntries: demoJournalEntries
      }
    };

    return await databaseService.importData(demoData, 'replace');
  }
}

export const backupService = new BackupService();
