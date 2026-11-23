/**
 * DashboardPage.js - Personal Work Journal Overview
 * Real-time metrics, Today's Mini Timeline, 4-5 Star Activities,
 * Chart.js Time Distribution, Today's Notes and Goals Progress.
 */

import { statisticsService } from '../../services/statisticsService.js';
import { activityService } from '../../services/activityService.js';
import { noteService } from '../../services/noteService.js';
import { goalRepository } from '../../database/repositories/goalRepository.js';
import { getTodayDateString, formatVietnameseDate } from '../../utils/dateUtils.js';
import { formatDuration } from '../../utils/timeUtils.js';
import { CATEGORIES, STATUSES } from '../../utils/constants.js';
import { activityModal } from '../../components/ActivityModal.js';
import Chart from 'chart.js/auto';

export class DashboardPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
    this.chartInstance = null;
    this.boundOnDataChanged = null;
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Personal Dashboard</h1>
          <div class="page-subtitle" id="dash-date-text">
            Tổng quan hiệu suất công việc và học tập hôm nay
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" id="btn-dash-to-schedule">
            📅 Xem Daily Schedule
          </button>
          <button class="btn btn-primary" id="btn-dash-add">
            + Thêm hoạt động
          </button>
        </div>
      </div>

      <!-- High-level KPI Stats Grid -->
      <div class="stats-grid" id="dash-kpi-grid"></div>

      <!-- Main Dashboard Grid -->
      <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 24px; margin-bottom: 24px;">
        <!-- Left Column: Today's Schedule & Notes -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- A. Today's Schedule Mini Timeline -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>⏰ Lịch trình hôm nay</span>
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-view-full-schedule">Xem toàn bộ ➔</button>
            </div>
            <div id="dash-today-schedule-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
          </div>

          <!-- E. Today's Notes Snapshot -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>📖 Nhật ký hôm nay (Daily Note)</span>
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-view-notes">Mở sổ nhật ký ➔</button>
            </div>
            <div id="dash-today-note-preview" style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;"></div>
          </div>
        </div>

        <!-- Right Column: Charts & Priority Activities -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- D. Time Distribution Doughnut Chart -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>📊 Phân bổ thời gian</span>
              </div>
            </div>
            <div style="position: relative; height: 210px;">
              <canvas id="dash-time-chart"></canvas>
            </div>
          </div>

          <!-- B. Important Activities (4-5 stars) -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>⭐ Hoạt động quan trọng (4 - 5 sao)</span>
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-view-starred">Xem tất cả ➔</button>
            </div>
            <div id="dash-starred-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
          </div>

          <!-- F. Goals Progress -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <span>🎯 Mục tiêu cá nhân</span>
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-view-goals">Quản lý mục tiêu ➔</button>
            </div>
            <div id="dash-goals-list" style="display: flex; flex-direction: column; gap: 12px;"></div>
          </div>
        </div>
      </div>
    `;

    this.element = page;
    await this._loadDashboardData();
    this._attachEvents();

    this.boundOnDataChanged = () => this._loadDashboardData();
    window.addEventListener('journal:activity-changed', this.boundOnDataChanged);
    window.addEventListener('journal:dailynote-changed', this.boundOnDataChanged);

    return page;
  }

  async _loadDashboardData() {
    if (!this.element) return;
    const today = getTodayDateString();

    const stats = await statisticsService.getTodayDashboardStats();
    const todayActivities = await activityService.getActivitiesByDate(today);
    const starredActivities = await activityService.getStarredActivities(4);
    const dailyNote = await noteService.getDailyNote(today);
    const allGoals = await goalRepository.getAll();

    this._renderKPIs(stats);
    this._renderTodaySchedule(todayActivities);
    this._renderImportantActivities(starredActivities.slice(0, 4));
    this._renderDailyNotePreview(dailyNote);
    this._renderTimeChart(stats);
    this._renderGoalsProgress(allGoals, todayActivities);
  }

  _renderKPIs(stats) {
    const grid = this.element.querySelector('#dash-kpi-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background: #eff6ff; color: #2563eb;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <div>
          <div class="stat-value">${formatDuration(stats.totalDurationMinutes)}</div>
          <div class="stat-label">Tổng thời gian hôm nay</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #ecfdf5; color: #059669;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div>
          <div class="stat-value">${stats.completedCount} / ${stats.totalActivities}</div>
          <div class="stat-label">Đã hoàn thành (${stats.completionRate}%)</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #f5f3ff; color: #7c3aed;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        </div>
        <div>
          <div class="stat-value">${formatDuration(stats.workMinutes + stats.studyMinutes)}</div>
          <div class="stat-label">Làm việc & Học tập</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: #fffbeb; color: #d97706;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>
        <div>
          <div class="stat-value">${stats.fiveStarCount}</div>
          <div class="stat-label">Hoạt động 5 sao</div>
        </div>
      </div>
    `;
  }

  _renderTodaySchedule(activities) {
    const list = this.element.querySelector('#dash-today-schedule-list');
    if (!list) return;

    if (activities.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-size: 13px;">
          Chưa có hoạt động nào được lên lịch cho hôm nay.
          <br><button class="btn btn-secondary btn-sm" id="btn-empty-add-today" style="margin-top: 10px;">+ Thêm hoạt động ngay</button>
        </div>
      `;
      list.querySelector('#btn-empty-add-today')?.addEventListener('click', () => {
        activityModal.open({ defaultDate: getTodayDateString() });
      });
      return;
    }

    list.innerHTML = activities.map(a => {
      const cat = CATEGORIES[a.category] || CATEGORIES.Other;
      const status = STATUSES[a.status] || STATUSES.Planned;
      return `
        <div class="card" style="padding: 10px 14px; border-left: 3px solid ${cat.color}; cursor: pointer; display: flex; align-items: center; justify-content: space-between;" data-id="${a.id}">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">${a.startTime} - ${a.endTime}</span>
            <span style="font-size: 13px; font-weight: 500;">${a.title}</span>
            <span class="badge-category badge-cat-${a.category}" style="font-size: 10px; padding: 1px 6px;">${cat.label}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge-status badge-status-${a.status.replace(/\s+/g, '')}" style="font-size: 10px;">${status.label}</span>
            <span style="color: #f59e0b; font-size: 12px;">${'★'.repeat(a.stars || 0)}</span>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.card[data-id]').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.id;
        const act = activities.find(a => a.id === id);
        if (act) activityModal.open({ activity: act });
      };
    });
  }

  _renderImportantActivities(activities) {
    const list = this.element.querySelector('#dash-starred-list');
    if (!list) return;

    if (activities.length === 0) {
      list.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 12px;">Chưa có hoạt động 4-5 sao nào.</div>`;
      return;
    }

    list.innerHTML = activities.map(a => `
      <div style="padding: 8px 12px; background: #fafbfc; border: 1px solid var(--border-default); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
          <div style="font-size: 13px; font-weight: 500;">${a.title}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${formatVietnameseDate(a.date, false)} | ${a.startTime}</div>
        </div>
        <span style="color: #f59e0b; font-size: 13px; font-weight: bold;">${'★'.repeat(a.stars || 0)}</span>
      </div>
    `).join('');
  }

  _renderDailyNotePreview(note) {
    const preview = this.element.querySelector('#dash-today-note-preview');
    if (!preview) return;

    if (!note || (!note.whatDone && !note.achievements)) {
      preview.innerHTML = `
        <div style="padding: 14px; background: #f8fafc; border-radius: var(--radius-sm); text-align: center; color: var(--text-muted);">
          Chưa có nhật ký tổng kết cho hôm nay.
          <br><button class="btn btn-secondary btn-sm" id="btn-quick-journal" style="margin-top: 8px;">Viết nhật ký</button>
        </div>
      `;
      preview.querySelector('#btn-quick-journal')?.addEventListener('click', () => {
        if (this.onNavigate) this.onNavigate('notes');
      });
      return;
    }

    preview.innerHTML = `
      <div style="background: #fafbfc; border-radius: var(--radius-md); padding: 14px; border: 1px solid var(--border-default);">
        <div style="margin-bottom: 6px;">
          <strong style="color: var(--primary);">Hôm nay đã làm gì:</strong>
          <p style="margin: 2px 0 0 0; white-space: pre-wrap;">${note.whatDone || 'Chưa ghi'}</p>
        </div>
        ${note.achievements ? `
          <div style="margin-top: 8px;">
            <strong style="color: #059669;">Kết quả & thành tựu:</strong>
            <p style="margin: 2px 0 0 0;">${note.achievements}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderTimeChart(stats) {
    const canvas = this.element.querySelector('#dash-time-chart');
    if (!canvas) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const dataValues = [
      stats.workMinutes,
      stats.studyMinutes,
      stats.projectMinutes,
      stats.personalMinutes,
      stats.breakMinutes
    ];

    const hasData = dataValues.some(v => v > 0);

    this.chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Làm việc', 'Học tập', 'Dự án', 'Cá nhân', 'Nghỉ ngơi'],
        datasets: [{
          data: hasData ? dataValues : [1],
          backgroundColor: hasData
            ? ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777']
            : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              font: { size: 11 }
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  _renderGoalsProgress(goals, todayActivities) {
    const list = this.element.querySelector('#dash-goals-list');
    if (!list) return;

    if (goals.length === 0) {
      list.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px;">Chưa thiết lập mục tiêu nào.</div>`;
      return;
    }

    list.innerHTML = goals.slice(0, 3).map(g => {
      // Calculate actual hours for this goal's category today
      const matchedMins = todayActivities
        .filter(a => a.category === g.category)
        .reduce((acc, a) => acc + (a.actualDurationMinutes || a.durationMinutes || 0), 0);
      const actualHours = Math.round((matchedMins / 60) * 10) / 10;
      const targetHours = Number(g.targetHours) || 1;
      const percent = Math.min(100, Math.round((actualHours / targetHours) * 100));

      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span style="font-weight: 500;">${g.title}</span>
            <span style="color: var(--primary); font-weight: 600;">${actualHours}h / ${targetHours}h (${percent}%)</span>
          </div>
          <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
            <div style="width: ${percent}%; height: 100%; background: #2563eb; border-radius: 999px; transition: width 0.3s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  _attachEvents() {
    this.element.querySelector('#btn-dash-to-schedule').onclick = () => this.onNavigate('dailySchedule');
    this.element.querySelector('#btn-view-full-schedule').onclick = () => this.onNavigate('dailySchedule');
    this.element.querySelector('#btn-view-notes').onclick = () => this.onNavigate('notes');
    this.element.querySelector('#btn-view-starred').onclick = () => this.onNavigate('starred');
    this.element.querySelector('#btn-view-goals').onclick = () => this.onNavigate('goals');

    this.element.querySelector('#btn-dash-add').onclick = () => {
      activityModal.open({ defaultDate: getTodayDateString() });
    };
  }

  destroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
    if (this.boundOnDataChanged) {
      window.removeEventListener('journal:activity-changed', this.boundOnDataChanged);
      window.removeEventListener('journal:dailynote-changed', this.boundOnDataChanged);
    }
  }
}
