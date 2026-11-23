/**
 * exportService.js - Export to UTF-8 CSV and Print-friendly PDF report
 */

import { formatVietnameseDate } from '../utils/dateUtils.js';
import { formatDuration } from '../utils/timeUtils.js';
import { escapeHTML } from '../utils/formatters.js';

class ExportService {
  /**
   * Export activities to Excel-compatible UTF-8 CSV
   * @param {Array} activities
   * @param {string} filename
   */
  exportActivitiesCSV(activities, filename = 'activities.csv') {
    if (!activities || activities.length === 0) {
      throw new Error('Không có hoạt động nào để xuất file');
    }

    const headers = [
      'ID',
      'Ngày',
      'Giờ bắt đầu',
      'Giờ kết thúc',
      'Thời lượng dự kiến (phút)',
      'Thời gian thực tế (phút)',
      'Tên hoạt động',
      'Danh mục',
      'Trạng thái',
      'Đánh giá sao',
      'Mô tả'
    ];

    const rows = activities.map(a => [
      `"${a.id}"`,
      `"${a.date}"`,
      `"${a.startTime}"`,
      `"${a.endTime}"`,
      a.durationMinutes || 0,
      a.actualDurationMinutes || 0,
      `"${(a.title || '').replace(/"/g, '""')}"`,
      `"${a.category || ''}"`,
      `"${a.status || ''}"`,
      a.stars || 0,
      `"${(a.description || '').replace(/"/g, '""')}"`
    ]);

    // Prepend UTF-8 BOM so Excel opens Vietnamese characters correctly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate and open a print-ready formatted report view
   */
  printDailyReport({ date, activities, dailyNote, stats }) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Vui lòng cho phép popup để mở trang in báo cáo');
      return;
    }

    const dateTitle = formatVietnameseDate(date);
    const totalTimeStr = formatDuration(stats ? stats.totalDurationMinutes : 0);

    const activityRows = (activities || [])
      .map(
        a => `
        <tr>
          <td><strong>${escapeHTML(a.startTime)} - ${escapeHTML(a.endTime)}</strong></td>
          <td>${escapeHTML(a.title)}</td>
          <td><span class="badge">${escapeHTML(a.category)}</span></td>
          <td>${'★'.repeat(a.stars || 0)}</td>
          <td>${escapeHTML(a.status)}</td>
          <td>${formatDuration(a.actualDurationMinutes || a.durationMinutes)}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Báo cáo công việc & Nhật ký - ${dateTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 40px; margin: 0; line-height: 1.5; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
          h1 { margin: 0; color: #1e293b; font-size: 24px; }
          .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .summary-card .label { font-size: 12px; color: #64748b; }
          .summary-card .val { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 13px; }
          th { background: #f1f5f9; font-weight: 600; color: #475569; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-size: 11px; }
          .daily-note-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #f8fafc; margin-bottom: 24px; }
          .daily-note-box h3 { margin-top: 0; font-size: 15px; color: #2563eb; }
          .note-section { margin-bottom: 12px; }
          .note-section strong { display: block; font-size: 12px; color: #475569; margin-bottom: 4px; }
          .note-section p { margin: 0; font-size: 13px; white-space: pre-wrap; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>BÁO CÁO CÔNG VIỆC & NHẬT KÝ CÁ NHÂN</h1>
            <div class="subtitle">${dateTitle} | Personal Work Journal</div>
          </div>
          <div>
            <button class="no-print" onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;">In / Lưu PDF</button>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">Tổng hoạt động</div>
            <div class="val">${(activities || []).length}</div>
          </div>
          <div class="summary-card">
            <div class="label">Tổng thời gian</div>
            <div class="val">${totalTimeStr}</div>
          </div>
          <div class="summary-card">
            <div class="label">Đã hoàn thành</div>
            <div class="val">${stats ? stats.completedCount : 0}</div>
          </div>
          <div class="summary-card">
            <div class="label">Đánh giá ngày</div>
            <div class="val">${dailyNote && dailyNote.rating ? '★'.repeat(dailyNote.rating) : 'N/A'}</div>
          </div>
        </div>

        <h2>1. Lịch trình hoạt động chi tiết (Timeline)</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 130px;">Thời gian</th>
              <th>Tên hoạt động</th>
              <th style="width: 100px;">Danh mục</th>
              <th style="width: 90px;">Độ ưu tiên</th>
              <th style="width: 110px;">Trạng thái</th>
              <th style="width: 100px;">Thời lượng</th>
            </tr>
          </thead>
          <tbody>
            ${activityRows || '<tr><td colspan="6" style="text-align: center; color: #64748b;">Không có hoạt động nào trong ngày</td></tr>'}
          </tbody>
        </table>

        ${
          dailyNote && !dailyNote.isNew
            ? `
          <h2>2. Nhật ký công việc & Tự đánh giá (Daily Note)</h2>
          <div class="daily-note-box">
            <div class="note-section">
              <strong>Hôm nay đã làm gì?</strong>
              <p>${escapeHTML(dailyNote.whatDone) || 'Chưa ghi'}</p>
            </div>
            <div class="note-section">
              <strong>Những điều đã học được:</strong>
              <p>${escapeHTML(dailyNote.whatLearned) || 'Chưa ghi'}</p>
            </div>
            <div class="note-section">
              <strong>Kết quả & Thành tựu đạt được:</strong>
              <p>${escapeHTML(dailyNote.achievements) || 'Chưa ghi'}</p>
            </div>
            <div class="note-section">
              <strong>Khó khăn gặp phải:</strong>
              <p>${escapeHTML(dailyNote.obstacles) || 'Chưa ghi'}</p>
            </div>
            <div class="note-section">
              <strong>Kế hoạch ngày mai:</strong>
              <p>${escapeHTML(dailyNote.tomorrowPlan) || 'Chưa ghi'}</p>
            </div>
          </div>
        `
            : ''
        }

        <div style="margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center;">
          Xuất từ Personal Work Journal - Hệ thống quản lý lịch trình cá nhân & Timeline
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }
}

export const exportService = new ExportService();
