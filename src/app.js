/**
 * app.js - Main Application Orchestrator & Router
 */

import { databaseService } from './database/databaseService.js';
import { timerService } from './services/timerService.js';
import { activityService } from './services/activityService.js';
import { noteService } from './services/noteService.js';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { activityModal } from './components/ActivityModal.js';
import { formatVietnameseDate } from './utils/dateUtils.js';
import { escapeHTML } from './utils/formatters.js';

// Pages
import { DashboardPage } from './pages/Dashboard/DashboardPage.js';
import { DailySchedulePage } from './pages/DailySchedule/DailySchedulePage.js';
import { CalendarPage } from './pages/Calendar/CalendarPage.js';
import { NotesPage } from './pages/Notes/NotesPage.js';
import { StarredActivitiesPage } from './pages/StarredActivities/StarredActivitiesPage.js';
import { TimeTrackingPage } from './pages/TimeTracking/TimeTrackingPage.js';
import { GoalsPage } from './pages/Goals/GoalsPage.js';
import { StatisticsPage } from './pages/Statistics/StatisticsPage.js';
import { HistoryPage } from './pages/History/HistoryPage.js';
import { SettingsPage } from './pages/Settings/SettingsPage.js';

export class App {
  constructor() {
    this.currentTab = 'dashboard';
    this.currentPageInstance = null;
    this.sidebar = null;
    this.header = null;
    this.root = document.getElementById('app');
  }

  async init() {
    this.root = document.getElementById('app') || document.body;

    // 1. Initialize IndexedDB
    try {
      await databaseService.initDatabase();
      console.log('IndexedDB PersonalWorkJournalDB ready.');
    } catch (err) {
      console.error('IndexedDB initialization failed:', err);
    }

    // 2. Initialize Persistent Timer
    await timerService.initTimer();

    // 3. Render base application layout
    this._renderLayout();

    // 4. Load initial tab
    await this.navigate(this.currentTab);
  }

  _renderLayout() {
    this.root.innerHTML = '';

    // Mobile sidebar backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.onclick = () => {
      document.querySelector('.sidebar')?.classList.remove('open');
      backdrop.classList.remove('open');
    };
    this.root.appendChild(backdrop);

    // Sidebar
    this.sidebar = new Sidebar({
      currentTab: this.currentTab,
      onNavigate: (tabId, params) => this.navigate(tabId, params)
    });
    this.root.appendChild(this.sidebar.render());

    // Main wrapper
    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'main-wrapper';

    // Header
    this.header = new Header({
      onNavigate: (tabId, params) => this.navigate(tabId, params),
      onSearch: (keyword) => this._handleGlobalSearch(keyword)
    });
    mainWrapper.appendChild(this.header.render());

    // Dynamic Page Container
    const pageContainer = document.createElement('main');
    pageContainer.id = 'main-page-container';
    pageContainer.style.flex = '1';
    mainWrapper.appendChild(pageContainer);

    this.root.appendChild(mainWrapper);

    this._ensureSearchModal();
  }

  async navigate(tabId, params = {}) {
    if (this.currentPageInstance && typeof this.currentPageInstance.destroy === 'function') {
      this.currentPageInstance.destroy();
    }

    this.currentTab = tabId;
    if (this.sidebar) {
      this.sidebar.setActiveTab(tabId);
    }

    const container = document.getElementById('main-page-container');
    if (!container) return;
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">Đang tải...</div>`;

    let page;
    switch (tabId) {
      case 'dashboard':
        page = new DashboardPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      case 'dailySchedule':
        page = new DailySchedulePage({ onNavigate: (t, p) => this.navigate(t, p) });
        if (params.date) page.currentDate = params.date;
        break;
      case 'calendar':
        page = new CalendarPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      case 'notes':
        page = new NotesPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      case 'starred':
        page = new StarredActivitiesPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      case 'timeTracking':
        page = new TimeTrackingPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      case 'goals':
        page = new GoalsPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      case 'statistics':
        page = new StatisticsPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      case 'history':
        page = new HistoryPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      case 'settings':
        page = new SettingsPage({ onNavigate: (t, p) => this.navigate(t, p) });
        break;
      default:
        page = new DashboardPage({ onNavigate: (t, p) => this.navigate(t, p) });
    }

    this.currentPageInstance = page;
    const renderedContent = await page.render();
    container.innerHTML = '';
    container.appendChild(renderedContent);
  }

  _ensureSearchModal() {
    let modal = document.getElementById('global-search-modal');
    if (modal) return;

    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'global-search-modal';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 600px;">
        <div class="modal-header">
          <h3 class="modal-title">Kết quả tìm kiếm toàn hệ thống</h3>
          <button class="btn btn-ghost btn-icon" id="search-modal-close" style="font-size: 20px;">&times;</button>
        </div>
        <div class="modal-body" id="search-modal-results" style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.classList.remove('open');
    modal.querySelector('#search-modal-close').onclick = close;
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };
  }

  async _handleGlobalSearch(keyword) {
    if (!keyword || keyword.length < 2) return;

    const modal = document.getElementById('global-search-modal');
    const resultsContainer = document.getElementById('search-modal-results');
    modal.classList.add('open');

    resultsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">Đang tìm kiếm...</div>`;

    const allActivities = await activityService.getAllActivities();
    const allNotes = await noteService.getAllNotes();

    const q = keyword.toLowerCase();

    const matchedActivities = allActivities.filter(a =>
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.description && a.description.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q))
    );

    const matchedNotes = allNotes.filter(n =>
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q))
    );

    if (matchedActivities.length === 0 && matchedNotes.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--text-muted);">
          Không tìm thấy hoạt động hoặc ghi chú nào phù hợp với từ khóa "${keyword}".
        </div>
      `;
      return;
    }

    let html = '';

    if (matchedActivities.length > 0) {
      html += `<div style="font-size: 12px; font-weight: 700; color: var(--primary); margin-top: 4px;">HOẠT ĐỘNG (${matchedActivities.length})</div>`;
      html += matchedActivities.map(a => `
        <div class="card search-item-act" data-id="${a.id}" style="padding: 10px 14px; cursor: pointer;">
          <div style="display: flex; justify-content: space-between;">
            <strong style="font-size: 14px;">${escapeHTML(a.title)}</strong>
            <span style="font-size: 11px; color: var(--text-muted);">${formatVietnameseDate(a.date, false)} | ${escapeHTML(a.startTime)}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            ${escapeHTML(a.description || 'Không có mô tả')}
          </div>
        </div>
      `).join('');
    }

    if (matchedNotes.length > 0) {
      html += `<div style="font-size: 12px; font-weight: 700; color: #7c3aed; margin-top: 12px;">GHI CHÚ (${matchedNotes.length})</div>`;
      html += matchedNotes.map(n => `
        <div class="card search-item-note" data-id="${n.id}" style="padding: 10px 14px; cursor: pointer;">
          <div style="display: flex; justify-content: space-between;">
            <strong style="font-size: 14px;">${escapeHTML(n.title)}</strong>
            <span style="font-size: 11px; color: var(--text-muted);">${formatVietnameseDate(n.date, false)}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            ${escapeHTML((n.content || '').substr(0, 80))}...
          </div>
        </div>
      `).join('');
    }

    resultsContainer.innerHTML = html;

    // Attach click to open
    resultsContainer.querySelectorAll('.search-item-act').forEach(el => {
      el.onclick = () => {
        modal.classList.remove('open');
        const act = allActivities.find(a => a.id === el.dataset.id);
        if (act) activityModal.open({ activity: act });
      };
    });

    resultsContainer.querySelectorAll('.search-item-note').forEach(el => {
      el.onclick = () => {
        modal.classList.remove('open');
        this.navigate('notes');
      };
    });
  }
}
