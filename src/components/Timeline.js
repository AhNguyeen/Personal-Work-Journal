/**
 * Timeline.js - 24-hour Day Timeline with current-time needle,
 * proportional block positioning, conflict indicators, and auto-scroll.
 */

import { timeToMinutes, formatDuration } from '../utils/timeUtils.js';
import { CATEGORIES, STATUSES } from '../utils/constants.js';
import { activityModal } from './ActivityModal.js';
import { activityService } from '../services/activityService.js';
import { confirmModal } from './ConfirmModal.js';
import { timerService } from '../services/timerService.js';
import { isToday } from '../utils/dateUtils.js';
import { toast } from './Toast.js';

export class Timeline {
  constructor({ date, activities = [], onActivityChange }) {
    this.date = date;
    this.activities = activities;
    this.onActivityChange = onActivityChange;
    this.element = null;
    this.minuteInterval = null;
  }

  setActivities(activities) {
    this.activities = activities;
    if (this.element) {
      this._renderActivities();
    }
  }

  setDate(date) {
    this.date = date;
    if (this.element) {
      this._updateCurrentTimeMarker();
      this._renderActivities();
      if (isToday(this.date)) {
        this.scrollToCurrentHour();
      }
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'timeline-scroll-container';
    container.id = 'day-timeline-scroller';

    // Build 24 hours slots
    let slotsHTML = '';
    for (let h = 0; h < 24; h++) {
      const label = `${String(h).padStart(2, '0')}:00`;
      slotsHTML += `
        <div class="timeline-hour-slot" style="top: ${h * 60}px;">
          <span class="timeline-hour-label">${label}</span>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="timeline-track-grid" id="timeline-track-grid">
        ${slotsHTML}
        <!-- Current time marker line -->
        <div class="timeline-current-time-marker" id="timeline-needle" style="display: none;"></div>
        <!-- Activities layer -->
        <div id="timeline-activities-layer"></div>
      </div>
    `;

    this.element = container;
    this._updateCurrentTimeMarker();
    this._renderActivities();

    // Set auto-timer for current time needle
    this.minuteInterval = setInterval(() => {
      this._updateCurrentTimeMarker();
    }, 60000);

    return container;
  }

  scrollToCurrentHour() {
    if (!this.element) return;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    // Scroll so current hour is centered (e.g. currentMins - 180px)
    const targetScroll = Math.max(0, currentMins - 180);
    setTimeout(() => {
      this.element.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 100);
  }

  _updateCurrentTimeMarker() {
    if (!this.element) return;
    const needle = this.element.querySelector('#timeline-needle');
    if (!needle) return;

    if (isToday(this.date)) {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      needle.style.display = 'block';
      needle.style.top = `${currentMins}px`;
    } else {
      needle.style.display = 'none';
    }
  }

  _renderActivities() {
    const layer = this.element.querySelector('#timeline-activities-layer');
    if (!layer) return;
    layer.innerHTML = '';

    if (!this.activities || this.activities.length === 0) {
      return;
    }

    // Sort by startTime
    const sorted = [...this.activities].sort((a, b) => a.startTime.localeCompare(b.startTime));

    sorted.forEach((act, index) => {
      const startMin = timeToMinutes(act.startTime);
      const endMin = timeToMinutes(act.endTime);
      let duration = endMin - startMin;
      if (duration < 25) duration = 25; // minimum height for readability

      const cat = CATEGORIES[act.category] || CATEGORIES.Other;
      const status = STATUSES[act.status] || STATUSES.Planned;
      const starIcons = '★'.repeat(act.stars || 0);

      // Check for overlap with other activities
      const hasConflict = sorted.some((other, oIndex) => {
        if (oIndex === index) return false;
        const oStart = timeToMinutes(other.startTime);
        const oEnd = timeToMinutes(other.endTime);
        return Math.max(startMin, oStart) < Math.min(endMin, oEnd);
      });

      const block = document.createElement('div');
      block.className = 'timeline-activity-block';
      block.dataset.id = act.id;
      block.style.top = `${startMin}px`;
      block.style.height = `${duration}px`;
      block.style.backgroundColor = cat.bg;
      block.style.borderLeft = `4px solid ${cat.color}`;
      block.style.borderColor = cat.border;

      block.innerHTML = `
        <div class="timeline-act-header">
          <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
            <span class="timeline-act-title">${act.title}</span>
            ${hasConflict ? `<span class="timeline-conflict-badge" title="Trùng giờ với hoạt động khác">Trùng giờ</span>` : ''}
          </div>
          <div class="timeline-act-time">
            <span>${act.startTime} - ${act.endTime}</span>
            <span style="color: #f59e0b; font-size: 13px;">${starIcons}</span>
          </div>
        </div>

        ${act.description ? `<div class="timeline-act-desc">${act.description}</div>` : ''}

        <div class="timeline-act-footer">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge-category badge-cat-${act.category}" style="font-size: 11px; padding: 1px 6px;">
              ${cat.label}
            </span>
            <span class="badge-status badge-status-${act.status.replace(/\s+/g, '')}" style="font-size: 10px; padding: 1px 6px;">
              ${status.label}
            </span>
            <span style="font-size: 11px; color: var(--text-muted);">
              ⏱ ${formatDuration(act.actualDurationMinutes || act.durationMinutes)}
            </span>
          </div>

          <div class="timeline-act-actions" style="display: flex; gap: 4px;" onclick="event.stopPropagation();">
            <button class="btn btn-ghost btn-sm btn-icon btn-act-timer" title="Bắt đầu Timer cho hoạt động này" style="width: 24px; height: 24px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon btn-act-delete" title="Xóa hoạt động" style="width: 24px; height: 24px; color: #ef4444;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;

      // Click to open edit modal
      block.onclick = () => {
        activityModal.open({
          activity: act,
          onSaved: () => {
            if (this.onActivityChange) this.onActivityChange();
          }
        });
      };

      // Timer quick start
      block.querySelector('.btn-act-timer').onclick = async (e) => {
        e.stopPropagation();
        try {
          await timerService.start(act);
          toast.success(`Đã khởi động Timer cho: ${act.title}`);
        } catch (err) {
          toast.warning(err.message);
        }
      };

      // Delete action with confirmation
      block.querySelector('.btn-act-delete').onclick = async (e) => {
        e.stopPropagation();
        const ok = await confirmModal.ask({
          title: 'Xóa hoạt động',
          message: `Bạn có chắc chắn muốn xóa hoạt động "${act.title}"?`,
          okText: 'Xóa'
        });

        if (ok) {
          await activityService.deleteActivity(act.id);
          toast.success('Đã xóa hoạt động');
          if (this.onActivityChange) this.onActivityChange();
        }
      };

      layer.appendChild(block);
    });
  }

  destroy() {
    if (this.minuteInterval) {
      clearInterval(this.minuteInterval);
    }
  }
}
