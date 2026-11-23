/**
 * Header.js - Top application navigation bar
 */

import { formatVietnameseDate, getTodayDateString } from '../utils/dateUtils.js';
import { activityModal } from './ActivityModal.js';
import { timerService } from '../services/timerService.js';
import { formatSecondsToTimer } from '../utils/timeUtils.js';

export class Header {
  constructor({ onNavigate, onSearch }) {
    this.onNavigate = onNavigate;
    this.onSearch = onSearch;
    this.element = null;
    this.timerUnsubscribe = null;
  }

  render() {
    const header = document.createElement('header');
    header.className = 'app-header';

    const todayStr = getTodayDateString();
    const dateFormatted = formatVietnameseDate(todayStr, true);

    header.innerHTML = `
      <div class="header-left">
        <button class="btn btn-ghost btn-icon mobile-menu-toggle" id="btn-toggle-sidebar" style="display: none;" title="Mở danh mục">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div class="header-date">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>${dateFormatted}</span>
        </div>
      </div>

      <div class="header-search">
        <span class="header-search-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
        <input type="text" id="global-search-input" placeholder="Tìm kiếm hoạt động, ghi chú..." />
      </div>

      <div class="header-right">
        <!-- Live Timer Header Widget -->
        <div id="header-timer-pill" class="timer-header-widget" title="Xem bộ đếm thời gian" style="display: none;">
          <span class="pulse-dot"></span>
          <span id="header-timer-text">00:00</span>
        </div>

        <div class="db-status-pill" title="Dữ liệu được lưu an toàn trong IndexedDB của trình duyệt">
          <span class="db-status-dot"></span>
          <span>IndexedDB</span>
        </div>

        <button class="btn btn-primary btn-sm" id="btn-quick-add-activity">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Thêm hoạt động</span>
        </button>
      </div>
    `;

    this.element = header;
    this._attachEvents();
    this._setupTimerSubscription();
    return header;
  }

  _attachEvents() {
    const addBtn = this.element.querySelector('#btn-quick-add-activity');
    addBtn.onclick = () => {
      activityModal.open({
        defaultDate: getTodayDateString(),
        onSaved: () => {
          // Handled via custom events
        }
      });
    };

    const timerPill = this.element.querySelector('#header-timer-pill');
    timerPill.onclick = () => {
      if (this.onNavigate) this.onNavigate('timeTracking');
    };

    const searchInput = this.element.querySelector('#global-search-input');
    searchInput.addEventListener('input', (e) => {
      if (this.onSearch) this.onSearch(e.target.value.trim());
    });

    const toggleSidebarBtn = this.element.querySelector('#btn-toggle-sidebar');
    toggleSidebarBtn.onclick = () => {
      const sidebar = document.querySelector('.sidebar');
      const backdrop = document.querySelector('.sidebar-backdrop');
      if (sidebar) sidebar.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('open');
    };
  }

  _setupTimerSubscription() {
    const timerPill = this.element.querySelector('#header-timer-pill');
    const timerText = this.element.querySelector('#header-timer-text');

    this.timerUnsubscribe = timerService.subscribe((state, currentSeconds) => {
      if (!timerPill) return;
      if (state.status === 'running' || state.status === 'paused') {
        timerPill.style.display = 'inline-flex';
        timerPill.className = `timer-header-widget ${state.status === 'running' ? 'running' : 'paused'}`;
        timerText.textContent = `${formatSecondsToTimer(currentSeconds)} (${state.activityTitle ? state.activityTitle.substr(0, 15) : 'Timer'})`;
      } else {
        timerPill.style.display = 'none';
      }
    });
  }
}
