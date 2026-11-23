/**
 * backupService.js - Export, Import and Safe Demo Data Generator
 */

import { databaseService } from '../database/databaseService.js';
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
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal_work_journal_backup_${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

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

      const activitiesCount = Array.isArray(parsed.stores.activities) ? parsed.stores.activities.length : 0;
      const dailyNotesCount = Array.isArray(parsed.stores.dailyNotes) ? parsed.stores.dailyNotes.length : 0;
      const notesCount = Array.isArray(parsed.stores.notes) ? parsed.stores.notes.length : 0;
      const goalsCount = Array.isArray(parsed.stores.goals) ? parsed.stores.goals.length : 0;

      return {
        isValid: true,
        data: parsed,
        stats: {
          activitiesCount,
          dailyNotesCount,
          notesCount,
          goalsCount
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
        stars: 4,
        status: 'Completed',
        relatedNote: 'Bắt đầu tuần mới nhiều năng lượng'
      },
      {
        id: 'act_demo_2',
        title: 'Phát triển module Timeline và IndexedDB',
        description: 'Viết DatabaseService, Repositories, xử lý lưu trữ dữ liệu offline',
        category: 'Project',
        date: today,
        startTime: '09:00',
        endTime: '11:30',
        breakMinutes: 10,
        durationMinutes: 140,
        actualDurationMinutes: 140,
        stars: 5,
        status: 'Completed',
        relatedNote: 'Hoàn thành tốt cấu trúc transactions'
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
        stars: 3,
        status: 'Completed',
        relatedNote: ''
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
        stars: 4,
        status: 'In Progress',
        relatedNote: 'Ghi chú thêm phần debounce autosave'
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
        actualDurationMinutes: 90,
        stars: 5,
        status: 'Planned',
        relatedNote: ''
      },
      {
        id: 'act_demo_6',
        title: 'Chạy bộ thể thao & Rèn luyện sức khỏe',
        description: 'Chạy bộ 5km công viên gần nhà để tái tạo năng lượng',
        category: 'Personal',
        date: today,
        startTime: '18:00',
        endTime: '19:00',
        breakMinutes: 0,
        durationMinutes: 60,
        actualDurationMinutes: 60,
        stars: 4,
        status: 'Planned',
        relatedNote: ''
      },
      {
        id: 'act_demo_7',
        title: 'Tổng kết ngày hôm qua & Chuẩn bị tài liệu',
        description: 'Đánh giá các đầu mục công việc và hoàn tất các ghi chú',
        category: 'Work',
        date: yesterday,
        startTime: '09:00',
        endTime: '11:00',
        breakMinutes: 0,
        durationMinutes: 120,
        actualDurationMinutes: 120,
        stars: 3,
        status: 'Completed',
        relatedNote: ''
      },
      {
        id: 'act_demo_8',
        title: 'Học ngoại ngữ & Luyện nghe podcast',
        description: '30 phút luyện phát âm và từ vựng kỹ thuật',
        category: 'Study',
        date: yesterday,
        startTime: '14:00',
        endTime: '15:30',
        breakMinutes: 0,
        durationMinutes: 90,
        actualDurationMinutes: 90,
        stars: 4,
        status: 'Completed',
        relatedNote: ''
      }
    ];

    const demoDailyNote = {
      id: 'daily_demo_today',
      date: today,
      whatDone: '- Hoàn thành kế hoạch sáng và thiết kế cấu trúc Personal Work Journal.\n- Xây dựng lớp DatabaseService và Repositories quản lý dữ liệu trên IndexedDB.\n- Kiểm thử bộ đếm thời gian Timer và lưu trữ thời gian thực tế.',
      whatLearned: 'Kỹ thuật tính toán Timeline dựa trên phút từ 00:00 giúp giao diện trực quan và loại bỏ hoàn toàn mô hình Kanban không mong muốn.',
      achievements: 'Hệ thống vận hành trơn tru, lưu trữ hoàn toàn offline với IndexedDB và chuẩn bị sẵn sàng deploy GitHub Pages.',
      obstacles: 'Cần đảm bảo việc tính thời gian không bị trôi khi người dùng đóng trình duyệt.',
      unfinished: 'Kiểm thử thêm trên thiết bị di động và tối ưu responsive.',
      tomorrowPlan: '- Kiểm tra toàn bộ các luồng Backup / Restore JSON.\n- Hoàn thiện tài liệu README.',
      rating: 5
    };

    const demoNotes = [
      {
        id: 'note_demo_1',
        title: 'Ý tưởng tối ưu hóa trải nghiệm Timeline',
        content: '<p>Vạch chỉ giờ hiện tại (Current Time Indicator) màu đỏ giúp định vị nhanh công việc trong ngày. Tự động cuộn đến giờ hiện tại khi mở ứng dụng tạo cảm giác liền mạch như Sunsama hoặc Routine.</p>',
        category: 'Project',
        date: today,
        isPinned: true
      },
      {
        id: 'note_demo_2',
        title: 'Nguyên tắc thiết kế Modern Minimalist',
        content: '<p>Tập trung vào sự thoáng đãng, màu trắng kết hợp xanh dương hiện đại. Các thẻ bo tròn nhẹ (border-radius: 12px) và bóng đổ tinh tế giúp người dùng tập trung vào nội dung.</p>',
        category: 'General',
        date: today,
        isPinned: false
      }
    ];

    const demoGoals = [
      {
        id: 'goal_demo_1',
        title: 'Thời gian làm việc tập trung hàng ngày',
        category: 'Work',
        targetHours: 6,
        period: 'daily',
        status: 'In Progress'
      },
      {
        id: 'goal_demo_2',
        title: 'Thời gian học tập & Nâng cao kỹ năng',
        category: 'Study',
        targetHours: 2,
        period: 'daily',
        status: 'In Progress'
      },
      {
        id: 'goal_demo_3',
        title: 'Phát triển các dự án cá nhân tuần này',
        category: 'Project',
        targetHours: 15,
        period: 'weekly',
        status: 'In Progress'
      }
    ];

    const demoData = {
      metadata: {
        app: 'PersonalWorkJournal',
        version: '1.0.0',
        exportedAt: new Date().toISOString()
      },
      stores: {
        activities: demoActivities,
        dailyNotes: [demoDailyNote],
        notes: demoNotes,
        goals: demoGoals,
        timerSessions: [],
        settings: []
      }
    };

    return await databaseService.importData(demoData, 'replace');
  }
}

export const backupService = new BackupService();
