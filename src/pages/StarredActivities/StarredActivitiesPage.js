/**
 * StarredActivitiesPage.js - Priority dashboard highlighting activities rated 1 to 5 stars
 * Ordered strictly by stars (5 -> 1) and filterable by category and date.
 */

import { activityService } from '../../services/activityService.js';
import { CATEGORIES, STATUSES } from '../../utils/constants.js';
import { formatVietnameseDate } from '../../utils/dateUtils.js';
import { formatDuration } from '../../utils/timeUtils.js';
import { activityModal } from '../../components/ActivityModal.js';
import { confirmModal } from '../../components/ConfirmModal.js';
import { toast } from '../../components/Toast.js';

export class StarredActivitiesPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
    this.filterCategory = 'all';
    this.filterMinStars = 1;
    this.boundOnActivityChanged = null;
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Starred Activities</h1>
          <div class="page-subtitle">Quản lý và theo dõi các hoạt động theo mức độ quan trọng (1 - 5 sao)</div>
        </div>

        <button class="btn btn-primary" id="btn-starred-add">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Thêm hoạt động</span>
        </button>
      </div>

      <!-- Filters Bar -->
      <div class="card" style="margin-bottom: 24px; padding: 14px 20px;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">Lọc theo số sao:</span>
            <select id="starred-filter-stars" class="form-select" style="width: 170px; padding: 6px 10px;">
              <option value="1">Tất cả (1-5 sao)</option>
              <option value="3">Từ 3 sao trở lên</option>
              <option value="4">4 & 5 sao (Quan trọng)</option>
              <option value="5">Chỉ 5 sao (Rất quan trọng)</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">Danh mục:</span>
            <select id="starred-filter-category" class="form-select" style="width: 170px; padding: 6px 10px;">
              <option value="all">Tất cả danh mục</option>
              ${Object.values(CATEGORIES).map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Starred List -->
      <div id="starred-list-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
    `;

    this.element = page;
    await this._renderList();
    this._attachEvents();

    this.boundOnActivityChanged = () => this._renderList();
    window.addEventListener('journal:activity-changed', this.boundOnActivityChanged);

    return page;
  }

  async _renderList() {
    const container = this.element.querySelector('#starred-list-container');
    if (!container) return;

    const all = await activityService.getStarredActivities(this.filterMinStars);

    // Apply category filter
    const filtered = all.filter(a => {
      if (this.filterCategory !== 'all' && a.category !== this.filterCategory) return false;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px; color: #f59e0b;">★</div>
          <div style="font-size: 16px; font-weight: 600; color: var(--text-main);">Chưa có hoạt động phù hợp</div>
          <div style="font-size: 13px; margin-top: 4px;">Hãy thêm hoặc gắn sao cho các hoạt động quan trọng để theo dõi tại đây.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(a => {
      const cat = CATEGORIES[a.category] || CATEGORIES.Other;
      const status = STATUSES[a.status] || STATUSES.Planned;
      const starsNum = Number(a.stars) || 3;

      let starsHtml = '';
      for (let s = 1; s <= 5; s++) {
        starsHtml += `<span class="star ${s <= starsNum ? 'filled' : ''}" data-id="${a.id}" data-setstar="${s}" style="font-size: 18px; cursor: pointer;">★</span>`;
      }

      return `
        <div class="card" style="padding: 16px 20px; border-left: 4px solid ${cat.color};">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <h3 style="font-size: 15px; font-weight: 600;">${a.title}</h3>
                <span class="badge-category badge-cat-${a.category}">${cat.label}</span>
                <span class="badge-status badge-status-${a.status.replace(/\s+/g, '')}">${status.label}</span>
              </div>

              ${a.description ? `<p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">${a.description}</p>` : ''}

              <div style="display: flex; align-items: center; gap: 18px; font-size: 12px; color: var(--text-muted);">
                <span>📅 ${formatVietnameseDate(a.date)}</span>
                <span>⏰ ${a.startTime} - ${a.endTime}</span>
                <span>⏱ ${formatDuration(a.actualDurationMinutes || a.durationMinutes)}</span>
                ${a.relatedNote ? `<span>📝 ${a.relatedNote}</span>` : ''}
              </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
              <div class="star-rating" title="Nhấn để đổi đánh giá sao">${starsHtml}</div>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary btn-sm btn-edit-starred" data-id="${a.id}">Chỉnh sửa</button>
                <button class="btn btn-ghost btn-sm btn-icon btn-delete-starred" data-id="${a.id}" style="color: #ef4444;" title="Xóa">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this._attachListActions(filtered);
  }

  _attachListActions(activities) {
    // Quick star toggle
    this.element.querySelectorAll('.star[data-setstar]').forEach(starEl => {
      starEl.onclick = async () => {
        const id = starEl.dataset.id;
        const star = Number(starEl.dataset.setstar);
        await activityService.updateStars(id, star);
        toast.success(`Đã cập nhật mức độ quan trọng thành ${star} sao`);
      };
    });

    // Edit button
    this.element.querySelectorAll('.btn-edit-starred').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const act = activities.find(a => a.id === id);
        if (act) {
          activityModal.open({ activity: act });
        }
      };
    });

    // Delete button
    this.element.querySelectorAll('.btn-delete-starred').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const act = activities.find(a => a.id === id);
        if (!act) return;

        const ok = await confirmModal.ask({
          title: 'Xóa hoạt động',
          message: `Bạn có chắc muốn xóa hoạt động "${act.title}"?`
        });

        if (ok) {
          await activityService.deleteActivity(id);
          toast.success('Đã xóa hoạt động');
        }
      };
    });
  }

  _attachEvents() {
    const filterStars = this.element.querySelector('#starred-filter-stars');
    const filterCategory = this.element.querySelector('#starred-filter-category');
    const addBtn = this.element.querySelector('#btn-starred-add');

    filterStars.onchange = (e) => {
      this.filterMinStars = Number(e.target.value);
      this._renderList();
    };

    filterCategory.onchange = (e) => {
      this.filterCategory = e.target.value;
      this._renderList();
    };

    addBtn.onclick = () => {
      activityModal.open({
        onSaved: () => this._renderList()
      });
    };
  }

  destroy() {
    if (this.boundOnActivityChanged) {
      window.removeEventListener('journal:activity-changed', this.boundOnActivityChanged);
    }
  }
}
