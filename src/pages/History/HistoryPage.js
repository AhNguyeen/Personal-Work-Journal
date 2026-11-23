/**
 * HistoryPage.js - Comprehensive Historical Activities Log
 * Advanced filter by date range, category, status, and star rating.
 * Paginated to ensure fast performance.
 */

import { activityService } from '../../services/activityService.js';
import { CATEGORIES, STATUSES } from '../../utils/constants.js';
import { formatVietnameseDate } from '../../utils/dateUtils.js';
import { formatDuration } from '../../utils/timeUtils.js';
import { activityModal } from '../../components/ActivityModal.js';
import { confirmModal } from '../../components/ConfirmModal.js';
import { toast } from '../../components/Toast.js';

export class HistoryPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
    this.allActivities = [];
    this.filterCategory = 'all';
    this.filterStatus = 'all';
    this.filterMinStars = 0;
    this.searchKeyword = '';
    this.currentPage = 1;
    this.pageSize = 10;
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    this.allActivities = await activityService.getAllActivities();

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Activity History</h1>
          <div class="page-subtitle">Xem lại và tìm kiếm toàn bộ lịch sử hoạt động đã thực hiện</div>
        </div>
      </div>

      <!-- Filters Toolbar Card -->
      <div class="card" style="margin-bottom: 24px; padding: 16px 20px;">
        <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center;">
          <input type="text" id="hist-search" class="form-input" placeholder="Tìm theo tên hoạt động, mô tả..." style="width: 240px;" />

          <select id="hist-category" class="form-select" style="width: 160px;">
            <option value="all">Tất cả danh mục</option>
            ${Object.values(CATEGORIES).map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
          </select>

          <select id="hist-status" class="form-select" style="width: 150px;">
            <option value="all">Tất cả trạng thái</option>
            ${Object.values(STATUSES).map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
          </select>

          <select id="hist-stars" class="form-select" style="width: 140px;">
            <option value="0">Tất cả số sao</option>
            <option value="3">Từ 3 sao trở lên</option>
            <option value="4">Từ 4 sao trở lên</option>
            <option value="5">Chỉ 5 sao</option>
          </select>

          <button class="btn btn-secondary btn-sm" id="btn-hist-reset">Đặt lại bộ lọc</button>
        </div>
      </div>

      <!-- Table Card -->
      <div class="card">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;" id="hist-table">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-default); text-align: left; color: var(--text-secondary);">
                <th style="padding: 12px 14px;">Ngày</th>
                <th style="padding: 12px 14px;">Thời gian</th>
                <th style="padding: 12px 14px;">Tên hoạt động</th>
                <th style="padding: 12px 14px;">Danh mục</th>
                <th style="padding: 12px 14px;">Độ quan trọng</th>
                <th style="padding: 12px 14px;">Trạng thái</th>
                <th style="padding: 12px 14px;">Thời lượng</th>
                <th style="padding: 12px 14px; text-align: right;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="hist-tbody"></tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; pt: 12px; border-top: 1px solid var(--border-subtle);">
          <div id="hist-page-info" style="font-size: 12px; color: var(--text-muted);"></div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="hist-prev-page">◀ Trước</button>
            <button class="btn btn-secondary btn-sm" id="hist-next-page">Sau ▶</button>
          </div>
        </div>
      </div>
    `;

    this.element = page;
    this._renderTable();
    this._attachEvents();
    return page;
  }

  _getFilteredActivities() {
    let list = [...this.allActivities];

    // Sort by date desc then start time
    list.sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime));

    if (this.filterCategory !== 'all') {
      list = list.filter(a => a.category === this.filterCategory);
    }

    if (this.filterStatus !== 'all') {
      list = list.filter(a => a.status === this.filterStatus);
    }

    if (this.filterMinStars > 0) {
      list = list.filter(a => (a.stars || 0) >= this.filterMinStars);
    }

    if (this.searchKeyword) {
      const q = this.searchKeyword.toLowerCase();
      list = list.filter(a =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.relatedNote && a.relatedNote.toLowerCase().includes(q))
      );
    }

    return list;
  }

  _renderTable() {
    const tbody = this.element.querySelector('#hist-tbody');
    const info = this.element.querySelector('#hist-page-info');
    const prevBtn = this.element.querySelector('#hist-prev-page');
    const nextBtn = this.element.querySelector('#hist-next-page');

    const filtered = this._getFilteredActivities();
    const total = filtered.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = startIdx + this.pageSize;
    const pageItems = filtered.slice(startIdx, endIdx);

    info.textContent = `Hiển thị ${pageItems.length > 0 ? startIdx + 1 : 0} - ${Math.min(endIdx, total)} trên tổng số ${total} hoạt động (Trang ${this.currentPage}/${totalPages})`;
    prevBtn.disabled = this.currentPage <= 1;
    nextBtn.disabled = this.currentPage >= totalPages;

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
            Không có hoạt động nào thỏa mãn bộ lọc tìm kiếm.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(a => {
      const cat = CATEGORIES[a.category] || CATEGORIES.Other;
      const status = STATUSES[a.status] || STATUSES.Planned;
      return `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <td style="padding: 12px 14px; font-weight: 500;">${formatVietnameseDate(a.date, false)}</td>
          <td style="padding: 12px 14px; color: var(--text-secondary);">${a.startTime} - ${a.endTime}</td>
          <td style="padding: 12px 14px;">
            <div style="font-weight: 600; color: var(--text-main);">${a.title}</div>
            ${a.description ? `<div style="font-size: 11px; color: var(--text-muted);">${a.description}</div>` : ''}
          </td>
          <td style="padding: 12px 14px;">
            <span class="badge-category badge-cat-${a.category}">${cat.label}</span>
          </td>
          <td style="padding: 12px 14px; color: #f59e0b; font-size: 14px;">
            ${'★'.repeat(a.stars || 0)}
          </td>
          <td style="padding: 12px 14px;">
            <span class="badge-status badge-status-${a.status.replace(/\s+/g, '')}">${status.label}</span>
          </td>
          <td style="padding: 12px 14px; font-weight: 500; color: var(--primary);">
            ${formatDuration(a.actualDurationMinutes || a.durationMinutes)}
          </td>
          <td style="padding: 12px 14px; text-align: right;">
            <button class="btn btn-secondary btn-sm btn-hist-view-day" data-date="${a.date}" title="Mở timeline ngày này">📅</button>
            <button class="btn btn-secondary btn-sm btn-hist-edit" data-id="${a.id}">Sửa</button>
            <button class="btn btn-ghost btn-sm btn-icon btn-hist-del" data-id="${a.id}" style="color: #ef4444;" title="Xóa">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('.btn-hist-view-day').forEach(btn => {
      btn.onclick = () => {
        if (this.onNavigate) this.onNavigate('dailySchedule', { date: btn.dataset.date });
      };
    });

    tbody.querySelectorAll('.btn-hist-edit').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const act = this.allActivities.find(a => a.id === id);
        if (act) {
          activityModal.open({
            activity: act,
            onSaved: async () => {
              this.allActivities = await activityService.getAllActivities();
              this._renderTable();
            }
          });
        }
      };
    });

    tbody.querySelectorAll('.btn-hist-del').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const act = this.allActivities.find(a => a.id === id);
        if (!act) return;

        const ok = await confirmModal.ask({
          title: 'Xóa hoạt động',
          message: `Bạn có chắc muốn xóa hoạt động "${act.title}"?`
        });
        if (ok) {
          await activityService.deleteActivity(id);
          toast.success('Đã xóa hoạt động');
          this.allActivities = await activityService.getAllActivities();
          this._renderTable();
        }
      };
    });
  }

  _attachEvents() {
    const searchInput = this.element.querySelector('#hist-search');
    const catSelect = this.element.querySelector('#hist-category');
    const statusSelect = this.element.querySelector('#hist-status');
    const starsSelect = this.element.querySelector('#hist-stars');
    const resetBtn = this.element.querySelector('#btn-hist-reset');
    const prevBtn = this.element.querySelector('#hist-prev-page');
    const nextBtn = this.element.querySelector('#hist-next-page');

    searchInput.oninput = (e) => {
      this.searchKeyword = e.target.value.trim();
      this.currentPage = 1;
      this._renderTable();
    };

    catSelect.onchange = (e) => {
      this.filterCategory = e.target.value;
      this.currentPage = 1;
      this._renderTable();
    };

    statusSelect.onchange = (e) => {
      this.filterStatus = e.target.value;
      this.currentPage = 1;
      this._renderTable();
    };

    starsSelect.onchange = (e) => {
      this.filterMinStars = Number(e.target.value);
      this.currentPage = 1;
      this._renderTable();
    };

    resetBtn.onclick = () => {
      searchInput.value = '';
      catSelect.value = 'all';
      statusSelect.value = 'all';
      starsSelect.value = '0';
      this.searchKeyword = '';
      this.filterCategory = 'all';
      this.filterStatus = 'all';
      this.filterMinStars = 0;
      this.currentPage = 1;
      this._renderTable();
    };

    prevBtn.onclick = () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this._renderTable();
      }
    };

    nextBtn.onclick = () => {
      this.currentPage++;
      this._renderTable();
    };
  }
}
