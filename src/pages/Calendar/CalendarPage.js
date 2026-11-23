/**
 * CalendarPage.js - Interactive Calendar View (Month / Week / Day)
 * Shows scheduled activities directly on dates with category badges,
 * side drawer for selected date, and seamless jump into Daily Schedule.
 */

import { activityService } from '../../services/activityService.js';
import { formatDateISO, formatVietnameseDate, getTodayDateString } from '../../utils/dateUtils.js';
import { CATEGORIES, STATUSES } from '../../utils/constants.js';
import { formatDuration } from '../../utils/timeUtils.js';
import { activityModal } from '../../components/ActivityModal.js';

export class CalendarPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth(); // 0-indexed
    this.selectedDate = getTodayDateString();
    this.allActivities = [];
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    this.allActivities = await activityService.getAllActivities();

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Calendar</h1>
          <div class="page-subtitle">Lịch hoạt động tháng và điều hướng ngày</div>
        </div>

        <button class="btn btn-primary" id="btn-cal-add">
          + Thêm hoạt động
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 2.8fr 1.2fr; gap: 24px;">
        <!-- Calendar Grid Card -->
        <div class="card" style="padding: 20px;">
          <!-- Calendar Month Navigation -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="btn-cal-prev">◀</button>
              <button class="btn btn-secondary btn-sm" id="btn-cal-today">Hôm nay</button>
              <button class="btn btn-secondary btn-sm" id="btn-cal-next">▶</button>
              <h2 id="cal-month-title" style="font-size: 17px; font-weight: 700; margin-left: 8px;"></h2>
            </div>
          </div>

          <!-- Weekday Headers -->
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: 600; font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">
            <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
          </div>

          <!-- Days Grid -->
          <div id="cal-days-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;"></div>
        </div>

        <!-- Selected Date Details Drawer -->
        <div class="card" style="display: flex; flex-direction: column;">
          <div class="card-header">
            <div>
              <div class="card-title" id="cal-selected-date-text">Chi tiết ngày</div>
              <div style="font-size: 12px; color: var(--text-muted);" id="cal-selected-date-sub"></div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-cal-open-timeline">Xem Timeline ➔</button>
          </div>

          <div id="cal-day-activities-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; max-height: 480px;"></div>

          <button class="btn btn-primary btn-sm" id="btn-cal-add-to-date" style="margin-top: 14px; width: 100%;">
            + Thêm hoạt động vào ngày này
          </button>
        </div>
      </div>
    `;

    this.element = page;
    this._renderCalendarMonth();
    this._renderSelectedDayDetails();
    this._attachEvents();
    return page;
  }

  _renderCalendarMonth() {
    const titleEl = this.element.querySelector('#cal-month-title');
    const gridEl = this.element.querySelector('#cal-days-grid');
    const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

    titleEl.textContent = `${months[this.currentMonth]}, ${this.currentYear}`;

    // Compute first day of month & days count
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday-based offset (0 = Mon, 6 = Sun)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const todayStr = getTodayDateString();

    // Index activities by date
    const actMap = {};
    for (const a of this.allActivities) {
      if (!actMap[a.date]) actMap[a.date] = [];
      actMap[a.date].push(a);
    }

    let cellsHTML = '';

    // Empty cells before month start
    for (let i = 0; i < startDayOfWeek; i++) {
      cellsHTML += `<div style="min-height: 80px; background: #fafbfc; border-radius: var(--radius-sm); opacity: 0.4;"></div>`;
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(this.currentYear, this.currentMonth, d);
      const dateStr = formatDateISO(dateObj);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === this.selectedDate;
      const dayActs = actMap[dateStr] || [];

      // Badges preview (max 2)
      const badgesHTML = dayActs.slice(0, 2).map(a => {
        const cat = CATEGORIES[a.category] || CATEGORIES.Other;
        return `
          <div style="font-size: 10px; background: ${cat.bg}; color: ${cat.color}; border: 1px solid ${cat.border}; border-radius: 3px; padding: 1px 4px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${a.startTime} ${a.title}
          </div>
        `;
      }).join('');

      const moreCount = dayActs.length > 2 ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">+${dayActs.length - 2} hoạt động khác</div>` : '';

      cellsHTML += `
        <div class="cal-day-cell" data-date="${dateStr}" style="
          min-height: 80px;
          padding: 6px;
          border-radius: var(--radius-sm);
          border: 1px solid ${isSelected ? 'var(--primary)' : isToday ? '#bfdbfe' : 'var(--border-default)'};
          background-color: ${isSelected ? '#eff6ff' : isToday ? '#f0fdf4' : 'var(--bg-surface)'};
          cursor: pointer;
          transition: border-color 0.15s ease;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: ${isToday || isSelected ? '700' : '500'}; color: ${isToday ? '#16a34a' : 'var(--text-main)'};">
              ${d}
            </span>
            ${dayActs.length > 0 ? `<span style="font-size: 10px; color: var(--primary); font-weight: 600;">${dayActs.length}</span>` : ''}
          </div>
          ${badgesHTML}
          ${moreCount}
        </div>
      `;
    }

    gridEl.innerHTML = cellsHTML;

    gridEl.querySelectorAll('.cal-day-cell').forEach(cell => {
      cell.onclick = () => {
        this.selectedDate = cell.dataset.date;
        this._renderCalendarMonth();
        this._renderSelectedDayDetails();
      };
    });
  }

  _renderSelectedDayDetails() {
    const titleEl = this.element.querySelector('#cal-selected-date-text');
    const subEl = this.element.querySelector('#cal-selected-date-sub');
    const listEl = this.element.querySelector('#cal-day-activities-list');

    titleEl.textContent = formatVietnameseDate(this.selectedDate, true);

    const dayActs = this.allActivities.filter(a => a.date === this.selectedDate);
    const totalMins = dayActs.reduce((acc, a) => acc + (a.actualDurationMinutes || a.durationMinutes || 0), 0);
    subEl.textContent = `${dayActs.length} hoạt động | ${formatDuration(totalMins)}`;

    if (dayActs.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-size: 13px;">
          Không có hoạt động nào trong ngày này.
        </div>
      `;
      return;
    }

    listEl.innerHTML = dayActs.map(a => {
      const cat = CATEGORIES[a.category] || CATEGORIES.Other;
      const status = STATUSES[a.status] || STATUSES.Planned;
      return `
        <div class="card" style="padding: 10px 12px; border-left: 3px solid ${cat.color}; cursor: pointer;" data-id="${a.id}">
          <div style="font-size: 13px; font-weight: 600;">${a.title}</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            <span>⏰ ${a.startTime} - ${a.endTime}</span>
            <span style="color: #f59e0b;">${'★'.repeat(a.stars || 0)}</span>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <span class="badge-category badge-cat-${a.category}" style="font-size: 10px;">${cat.label}</span>
            <span class="badge-status badge-status-${a.status.replace(/\s+/g, '')}" style="font-size: 10px;">${status.label}</span>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.card[data-id]').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.id;
        const act = dayActs.find(a => a.id === id);
        if (act) {
          activityModal.open({
            activity: act,
            onSaved: async () => {
              this.allActivities = await activityService.getAllActivities();
              this._renderCalendarMonth();
              this._renderSelectedDayDetails();
            }
          });
        }
      };
    });
  }

  _attachEvents() {
    this.element.querySelector('#btn-cal-prev').onclick = () => {
      this.currentMonth--;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      }
      this._renderCalendarMonth();
    };

    this.element.querySelector('#btn-cal-next').onclick = () => {
      this.currentMonth++;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
      this._renderCalendarMonth();
    };

    this.element.querySelector('#btn-cal-today').onclick = () => {
      const now = new Date();
      this.currentYear = now.getFullYear();
      this.currentMonth = now.getMonth();
      this.selectedDate = getTodayDateString();
      this._renderCalendarMonth();
      this._renderSelectedDayDetails();
    };

    this.element.querySelector('#btn-cal-open-timeline').onclick = () => {
      if (this.onNavigate) this.onNavigate('dailySchedule', { date: this.selectedDate });
    };

    this.element.querySelector('#btn-cal-add').onclick = () => {
      activityModal.open({
        defaultDate: this.selectedDate,
        onSaved: async () => {
          this.allActivities = await activityService.getAllActivities();
          this._renderCalendarMonth();
          this._renderSelectedDayDetails();
        }
      });
    };

    this.element.querySelector('#btn-cal-add-to-date').onclick = () => {
      activityModal.open({
        defaultDate: this.selectedDate,
        onSaved: async () => {
          this.allActivities = await activityService.getAllActivities();
          this._renderCalendarMonth();
          this._renderSelectedDayDetails();
        }
      });
    };
  }
}
