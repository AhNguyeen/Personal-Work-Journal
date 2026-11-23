/**
 * WeekTimeline.js - 7-day overview timeline showing daily totals,
 * mini activity cards, and quick jump into any day's timeline.
 */

import { getWeekDays } from '../utils/dateUtils.js';
import { formatDuration } from '../utils/timeUtils.js';
import { CATEGORIES } from '../utils/constants.js';

export class WeekTimeline {
  constructor({ currentDate, activities = [], onSelectDate, onAddActivity }) {
    this.currentDate = currentDate;
    this.activities = activities;
    this.onSelectDate = onSelectDate;
    this.onAddActivity = onAddActivity;
    this.element = null;
  }

  setData(currentDate, activities) {
    this.currentDate = currentDate;
    this.activities = activities;
    if (this.element) {
      this._renderGrid();
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'week-timeline-container';
    this.element = container;
    this._renderGrid();
    return container;
  }

  _renderGrid() {
    const days = getWeekDays(this.currentDate);

    // Group activities by date
    const actsByDate = {};
    for (const d of days) {
      actsByDate[d.dateStr] = [];
    }

    for (const act of this.activities) {
      if (actsByDate[act.date]) {
        actsByDate[act.date].push(act);
      }
    }

    let columnsHTML = '';
    for (const d of days) {
      const dayActs = actsByDate[d.dateStr] || [];
      const totalMins = dayActs.reduce((acc, a) => acc + (a.actualDurationMinutes || a.durationMinutes || 0), 0);
      const isSelected = d.dateStr === this.currentDate;

      const actCardsHTML = dayActs
        .map(a => {
          const cat = CATEGORIES[a.category] || CATEGORIES.Other;
          return `
            <div class="week-mini-act-card" data-act-id="${a.id}" style="border-left: 3px solid ${cat.color};">
              <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.title}</div>
              <div style="font-size: 10px; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 2px;">
                <span>${a.startTime} - ${a.endTime}</span>
                <span style="color: #f59e0b;">${'★'.repeat(a.stars || 0)}</span>
              </div>
            </div>
          `;
        })
        .join('');

      columnsHTML += `
        <div class="week-day-column ${d.isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${d.dateStr}">
          <div class="week-day-header">
            <div class="week-day-name">${d.weekday}</div>
            <div class="week-day-number">${d.dayNum}</div>
            <div class="week-day-total-time">${formatDuration(totalMins)}</div>
          </div>

          <div class="week-day-activities">
            ${actCardsHTML || `<div style="text-align: center; color: var(--text-muted); font-size: 11px; margin-top: 20px;">Không có hoạt động</div>`}
          </div>

          <button class="btn btn-secondary btn-sm btn-add-day-act" data-date="${d.dateStr}" style="margin-top: 12px; width: 100%; font-size: 11px; padding: 4px;">
            + Thêm
          </button>
        </div>
      `;
    }

    this.element.innerHTML = `
      <div class="week-timeline-grid">
        ${columnsHTML}
      </div>
    `;

    this._attachEvents();
  }

  _attachEvents() {
    this.element.querySelectorAll('.week-day-column').forEach(col => {
      col.onclick = (e) => {
        if (e.target.closest('.btn-add-day-act') || e.target.closest('.week-mini-act-card')) return;
        const date = col.dataset.date;
        if (this.onSelectDate) this.onSelectDate(date);
      };
    });

    this.element.querySelectorAll('.btn-add-day-act').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const date = btn.dataset.date;
        if (this.onAddActivity) this.onAddActivity(date);
      };
    });
  }
}
