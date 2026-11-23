/**
 * DailySchedulePage.js - Core Schedule Screen featuring Day & Week Timelines
 */

import { Timeline } from '../../components/Timeline.js';
import { WeekTimeline } from '../../components/WeekTimeline.js';
import { activityService } from '../../services/activityService.js';
import { getTodayDateString, formatVietnameseDate, addDays } from '../../utils/dateUtils.js';
import { activityModal } from '../../components/ActivityModal.js';
import { formatDuration } from '../../utils/timeUtils.js';

export class DailySchedulePage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.currentDate = getTodayDateString();
    this.viewMode = 'day'; // 'day' | 'week'
    this.timeline = null;
    this.weekTimeline = null;
    this.element = null;
    this.boundOnActivityChanged = null;
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Daily Schedule</h1>
          <div class="page-subtitle" id="sched-subtitle">
            Lịch trình hoạt động theo thời gian thực tế (Timeline)
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <!-- Day / Week switch -->
          <div class="timeline-view-modes">
            <button class="timeline-view-btn ${this.viewMode === 'day' ? 'active' : ''}" id="btn-view-day">Ngày</button>
            <button class="timeline-view-btn ${this.viewMode === 'week' ? 'active' : ''}" id="btn-view-week">Tuần</button>
          </div>

          <button class="btn btn-primary" id="btn-sched-add">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Thêm hoạt động</span>
          </button>
        </div>
      </div>

      <div class="timeline-board">
        <!-- Date Navigation Bar -->
        <div class="timeline-nav-bar">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn btn-secondary btn-sm" id="btn-nav-prev" title="Ngày trước">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-nav-today">Hôm nay</button>
            <button class="btn btn-secondary btn-sm" id="btn-nav-next" title="Ngày sau">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>

            <span id="sched-current-date-text" style="font-size: 15px; font-weight: 600; margin-left: 8px;">
              ${formatVietnameseDate(this.currentDate)}
            </span>

            <input type="date" id="sched-date-picker" value="${this.currentDate}" style="border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 3px 8px; font-size: 12px; margin-left: 6px;" />
          </div>

          <div id="sched-day-summary" style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 16px;">
            <!-- Summary stats updated dynamically -->
          </div>
        </div>

        <!-- Timeline container slot -->
        <div id="timeline-slot"></div>
      </div>
    `;

    this.element = page;
    await this._initTimelines();
    this._attachEvents();

    // Listen to activity changes from other components
    this.boundOnActivityChanged = () => this.refresh();
    window.addEventListener('journal:activity-changed', this.boundOnActivityChanged);

    return page;
  }

  async _initTimelines() {
    const slot = this.element.querySelector('#timeline-slot');
    const dayActivities = await activityService.getActivitiesByDate(this.currentDate);
    const allActivities = await activityService.getAllActivities();

    this.timeline = new Timeline({
      date: this.currentDate,
      activities: dayActivities,
      onActivityChange: () => this.refresh()
    });

    this.weekTimeline = new WeekTimeline({
      currentDate: this.currentDate,
      activities: allActivities,
      onSelectDate: (date) => {
        this.currentDate = date;
        this.viewMode = 'day';
        this._updateView();
      },
      onAddActivity: (date) => {
        activityModal.open({
          defaultDate: date,
          onSaved: () => this.refresh()
        });
      }
    });

    slot.innerHTML = '';
    if (this.viewMode === 'day') {
      slot.appendChild(this.timeline.render());
      this.timeline.scrollToCurrentHour();
    } else {
      slot.appendChild(this.weekTimeline.render());
    }

    this._updateSummaryStats(dayActivities);
  }

  async refresh() {
    if (!this.element) return;
    const dayActivities = await activityService.getActivitiesByDate(this.currentDate);
    const allActivities = await activityService.getAllActivities();

    if (this.timeline) {
      this.timeline.setDate(this.currentDate);
      this.timeline.setActivities(dayActivities);
    }

    if (this.weekTimeline) {
      this.weekTimeline.setData(this.currentDate, allActivities);
    }

    this._updateSummaryStats(dayActivities);
  }

  _updateSummaryStats(activities) {
    const summaryEl = this.element.querySelector('#sched-day-summary');
    if (!summaryEl) return;

    const total = activities.length;
    const completed = activities.filter(a => a.status === 'Completed').length;
    const totalMinutes = activities.reduce((acc, a) => acc + (a.actualDurationMinutes || a.durationMinutes || 0), 0);

    summaryEl.innerHTML = `
      <span>Tổng: <strong>${total}</strong> hoạt động</span>
      <span>Đã xong: <strong style="color: #10b981;">${completed}/${total}</strong></span>
      <span>Tổng thời gian: <strong style="color: var(--primary);">${formatDuration(totalMinutes)}</strong></span>
    `;
  }

  _updateView() {
    const slot = this.element.querySelector('#timeline-slot');
    const dateText = this.element.querySelector('#sched-current-date-text');
    const datePicker = this.element.querySelector('#sched-date-picker');
    const dayBtn = this.element.querySelector('#btn-view-day');
    const weekBtn = this.element.querySelector('#btn-view-week');

    dateText.textContent = formatVietnameseDate(this.currentDate);
    datePicker.value = this.currentDate;

    dayBtn.classList.toggle('active', this.viewMode === 'day');
    weekBtn.classList.toggle('active', this.viewMode === 'week');

    slot.innerHTML = '';
    if (this.viewMode === 'day') {
      slot.appendChild(this.timeline.render());
      this.timeline.scrollToCurrentHour();
    } else {
      slot.appendChild(this.weekTimeline.render());
    }
    this.refresh();
  }

  _attachEvents() {
    const dayBtn = this.element.querySelector('#btn-view-day');
    const weekBtn = this.element.querySelector('#btn-view-week');
    const prevBtn = this.element.querySelector('#btn-nav-prev');
    const nextBtn = this.element.querySelector('#btn-nav-next');
    const todayBtn = this.element.querySelector('#btn-nav-today');
    const datePicker = this.element.querySelector('#sched-date-picker');
    const addBtn = this.element.querySelector('#btn-sched-add');

    dayBtn.onclick = () => {
      this.viewMode = 'day';
      this._updateView();
    };

    weekBtn.onclick = () => {
      this.viewMode = 'week';
      this._updateView();
    };

    prevBtn.onclick = () => {
      this.currentDate = addDays(this.currentDate, this.viewMode === 'day' ? -1 : -7);
      this._updateView();
    };

    nextBtn.onclick = () => {
      this.currentDate = addDays(this.currentDate, this.viewMode === 'day' ? 1 : 7);
      this._updateView();
    };

    todayBtn.onclick = () => {
      this.currentDate = getTodayDateString();
      this._updateView();
    };

    datePicker.onchange = (e) => {
      if (e.target.value) {
        this.currentDate = e.target.value;
        this._updateView();
      }
    };

    addBtn.onclick = () => {
      activityModal.open({
        defaultDate: this.currentDate,
        onSaved: () => this.refresh()
      });
    };
  }

  destroy() {
    if (this.boundOnActivityChanged) {
      window.removeEventListener('journal:activity-changed', this.boundOnActivityChanged);
    }
    if (this.timeline) {
      this.timeline.destroy();
    }
  }
}
