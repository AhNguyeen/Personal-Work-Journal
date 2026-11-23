/**
 * StatisticsPage.js - Analytical Insights & Visualizations using Chart.js
 * Filters: Today, 7 Days, This Week, This Month, 3 Months, Custom.
 * Export CSV / Print Reports.
 */

import { statisticsService } from '../../services/statisticsService.js';
import { exportService } from '../../services/exportService.js';
import { activityService } from '../../services/activityService.js';
import { formatDuration } from '../../utils/timeUtils.js';
import { formatVietnameseDate } from '../../utils/dateUtils.js';
import { CATEGORIES } from '../../utils/constants.js';
import Chart from 'chart.js/auto';

export class StatisticsPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
    this.period = '7days';
    this.charts = {};
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Statistics & Analytics</h1>
          <div class="page-subtitle">Thống kê phân bổ thời gian và đánh giá hiệu suất cá nhân</div>
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary btn-sm" id="btn-stats-export-csv">
            📥 Xuất file Excel (CSV)
          </button>
          <button class="btn btn-primary btn-sm" id="btn-stats-print">
            🖨 In / Xuất PDF
          </button>
        </div>
      </div>

      <!-- Time Filter Selector Card -->
      <div class="card" style="margin-bottom: 24px; padding: 14px 20px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">Khoảng thời gian:</span>
            <div class="timeline-view-modes" id="stats-period-group">
              <button class="timeline-view-btn ${this.period === 'today' ? 'active' : ''}" data-p="today">Hôm nay</button>
              <button class="timeline-view-btn ${this.period === '7days' ? 'active' : ''}" data-p="7days">7 ngày qua</button>
              <button class="timeline-view-btn ${this.period === 'thisweek' ? 'active' : ''}" data-p="thisweek">Tuần này</button>
              <button class="timeline-view-btn ${this.period === 'thismonth' ? 'active' : ''}" data-p="thismonth">Tháng này</button>
              <button class="timeline-view-btn ${this.period === '3months' ? 'active' : ''}" data-p="3months">3 tháng</button>
            </div>
          </div>

          <div id="stats-date-range-badge" style="font-size: 13px; font-weight: 600; color: var(--primary);"></div>
        </div>
      </div>

      <!-- Overview KPI Cards -->
      <div class="stats-grid" id="stats-kpi-grid"></div>

      <!-- Charts Row 1: Daily Trend & Category Doughnut -->
      <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 24px; margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">📈 Xu hướng thời gian theo ngày (Giờ)</div>
          </div>
          <div style="position: relative; height: 260px;">
            <canvas id="chart-daily-trend"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">🍩 Tỷ trọng danh mục hoạt động</div>
          </div>
          <div style="position: relative; height: 260px;">
            <canvas id="chart-category-doughnut"></canvas>
          </div>
        </div>
      </div>

      <!-- Charts Row 2: Star Ratings & Completion Ratio -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">⭐ Phân bố mức độ quan trọng (Đánh giá sao)</div>
          </div>
          <div style="position: relative; height: 220px;">
            <canvas id="chart-stars-bar"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">💡 Phân tích & Thông số hiệu suất</div>
          </div>
          <div id="stats-insights-box" style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;"></div>
        </div>
      </div>
    `;

    this.element = page;
    await this._loadAnalytics();
    this._attachEvents();
    return page;
  }

  async _loadAnalytics() {
    const data = await statisticsService.getAnalytics(this.period);

    // Update date range badge
    const badge = this.element.querySelector('#stats-date-range-badge');
    badge.textContent = `${formatVietnameseDate(data.startDateStr, false)} - ${formatVietnameseDate(data.endDateStr, false)}`;

    this._renderKPIs(data);
    this._renderDailyTrendChart(data);
    this._renderCategoryChart(data);
    this._renderStarsChart(data);
    this._renderInsights(data);
  }

  _renderKPIs(data) {
    const grid = this.element.querySelector('#stats-kpi-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background: #eff6ff; color: #2563eb;">⏱</div>
        <div>
          <div class="stat-value">${formatDuration(data.totalDurationMinutes)}</div>
          <div class="stat-label">Tổng thời lượng ghi nhận</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #ecfdf5; color: #059669;">✓</div>
        <div>
          <div class="stat-value">${data.completedCount} / ${data.totalActivities}</div>
          <div class="stat-label">Hoàn thành (${data.completionRate}%)</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #f5f3ff; color: #7c3aed;">🏆</div>
        <div>
          <div class="stat-value">${data.topCategory ? (CATEGORIES[data.topCategory]?.label || data.topCategory) : 'N/A'}</div>
          <div class="stat-label">Danh mục tập trung nhất</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #fffbeb; color: #d97706;">🔥</div>
        <div>
          <div class="stat-value">${data.peakDay ? formatVietnameseDate(data.peakDay, false) : 'N/A'}</div>
          <div class="stat-label">Ngày năng suất nhất (${formatDuration(data.peakDayMinutes)})</div>
        </div>
      </div>
    `;
  }

  _renderDailyTrendChart(data) {
    const canvas = this.element.querySelector('#chart-daily-trend');
    if (!canvas) return;
    if (this.charts.daily) this.charts.daily.destroy();

    const labels = Object.keys(data.dailyMinutesMap).sort();
    const hoursValues = labels.map(date => Math.round((data.dailyMinutesMap[date] / 60) * 10) / 10);

    this.charts.daily = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels.map(l => formatVietnameseDate(l, false)),
        datasets: [{
          label: 'Số giờ làm việc/học tập',
          data: hoursValues,
          backgroundColor: '#2563eb',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Giờ' } }
        }
      }
    });
  }

  _renderCategoryChart(data) {
    const canvas = this.element.querySelector('#chart-category-doughnut');
    if (!canvas) return;
    if (this.charts.category) this.charts.category.destroy();

    const categories = Object.keys(data.categoryMinutes);
    const labels = categories.map(c => CATEGORIES[c]?.label || c);
    const values = categories.map(c => Math.round(data.categoryMinutes[c] / 60 * 10) / 10);
    const colors = categories.map(c => CATEGORIES[c]?.color || '#94a3b8');

    this.charts.category = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12 } }
        },
        cutout: '65%'
      }
    });
  }

  _renderStarsChart(data) {
    const canvas = this.element.querySelector('#chart-stars-bar');
    if (!canvas) return;
    if (this.charts.stars) this.charts.stars.destroy();

    this.charts.stars = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['1 sao', '2 sao', '3 sao', '4 sao', '5 sao'],
        datasets: [{
          label: 'Số hoạt động',
          data: [data.starCounts[1], data.starCounts[2], data.starCounts[3], data.starCounts[4], data.starCounts[5]],
          backgroundColor: ['#94a3b8', '#64748b', '#3b82f6', '#f59e0b', '#ef4444'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  _renderInsights(data) {
    const box = this.element.querySelector('#stats-insights-box');
    if (!box) return;

    box.innerHTML = `
      <div style="background: #fafbfc; border-radius: var(--radius-md); padding: 12px 16px; border: 1px solid var(--border-default);">
        <strong>Phân loại thời gian:</strong>
        <div style="margin-top: 6px;">
          Làm việc: <strong>${formatDuration(data.categoryMinutes.Work)}</strong> |
          Học tập: <strong>${formatDuration(data.categoryMinutes.Study)}</strong> |
          Dự án: <strong>${formatDuration(data.categoryMinutes.Project)}</strong>
        </div>
      </div>

      <div style="background: #fafbfc; border-radius: var(--radius-md); padding: 12px 16px; border: 1px solid var(--border-default);">
        <strong>Đánh giá cân bằng:</strong>
        <div style="margin-top: 6px;">
          Nghỉ ngơi: <strong>${formatDuration(data.categoryMinutes.Break)}</strong> |
          Cá nhân: <strong>${formatDuration(data.categoryMinutes.Personal)}</strong>
        </div>
      </div>

      <div style="background: #eff6ff; border-radius: var(--radius-md); padding: 12px 16px; border: 1px solid #bfdbfe; color: #1e40af;">
        💡 <strong>Gợi ý:</strong> Bạn đạt tỷ lệ hoàn thành <strong>${data.completionRate}%</strong> trong chu kỳ này. Duy trì việc theo dõi lịch trình Timeline mỗi sáng để tối ưu năng suất làm việc!
      </div>
    `;
  }

  _attachEvents() {
    this.element.querySelectorAll('#stats-period-group button').forEach(btn => {
      btn.onclick = () => {
        this.element.querySelectorAll('#stats-period-group button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.period = btn.dataset.p;
        this._loadAnalytics();
      };
    });

    this.element.querySelector('#btn-stats-export-csv').onclick = async () => {
      const all = await activityService.getAllActivities();
      exportService.exportActivitiesCSV(all, `activities_${this.period}.csv`);
    };

    this.element.querySelector('#btn-stats-print').onclick = async () => {
      const all = await activityService.getAllActivities();
      const stats = await statisticsService.getTodayDashboardStats();
      exportService.printDailyReport({
        date: new Date(),
        activities: all.slice(0, 30),
        dailyNote: null,
        stats
      });
    };
  }

  destroy() {
    for (const key of Object.keys(this.charts)) {
      if (this.charts[key]) this.charts[key].destroy();
    }
  }
}
