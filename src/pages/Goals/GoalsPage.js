/**
 * GoalsPage.js - Personal Time & Productivity Goals
 * Tracks daily, weekly, and monthly target hours vs actual completed hours
 */

import { goalRepository } from '../../database/repositories/goalRepository.js';
import { activityService } from '../../services/activityService.js';
import { CATEGORIES, GOAL_PERIODS } from '../../utils/constants.js';
import { generateId } from '../../utils/formatters.js';
import { toast } from '../../components/Toast.js';
import { confirmModal } from '../../components/ConfirmModal.js';

export class GoalsPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
    this.goals = [];
    this.activities = [];
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    this.goals = await goalRepository.getAll();
    this.activities = await activityService.getAllActivities();

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Personal Goals</h1>
          <div class="page-subtitle">Thiết lập và theo dõi mục tiêu thời gian làm việc, học tập và dự án</div>
        </div>

        <button class="btn btn-primary" id="btn-add-goal">
          + Thiết lập mục tiêu mới
        </button>
      </div>

      <!-- Add/Edit Goal Modal Form Drawer -->
      <div id="goal-form-wrapper" style="display: none; margin-bottom: 24px;"></div>

      <!-- Goals List -->
      <div id="goals-list-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 18px;"></div>
    `;

    this.element = page;
    this._renderGoals();
    this._attachEvents();
    return page;
  }

  _renderGoals() {
    const grid = this.element.querySelector('#goals-list-grid');
    if (!grid) return;

    if (this.goals.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
          <div style="font-size: 16px; font-weight: 600; color: var(--text-main);">Chưa có mục tiêu nào</div>
          <div style="font-size: 13px; margin-top: 4px;">Hãy thiết lập mục tiêu số giờ làm việc, học tập hàng ngày hoặc hàng tuần để phấn đấu.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.goals.map(g => {
      const cat = CATEGORIES[g.category] || CATEGORIES.Work;
      const period = GOAL_PERIODS[g.period] || GOAL_PERIODS.daily;

      // Calculate actual hours for this goal's category
      const matchedMins = this.activities
        .filter(a => a.category === g.category)
        .reduce((acc, a) => acc + (a.actualDurationMinutes || a.durationMinutes || 0), 0);
      const actualHours = Math.round((matchedMins / 60) * 10) / 10;
      const targetHours = Number(g.targetHours) || 1;
      const percent = Math.min(100, Math.round((actualHours / targetHours) * 100));
      const remainingHours = Math.max(0, Math.round((targetHours - actualHours) * 10) / 10);

      return `
        <div class="card" style="border-top: 4px solid ${cat.color}; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
              <h3 style="font-size: 15px; font-weight: 600;">${g.title}</h3>
              <span class="badge-category badge-cat-${g.category}">${cat.label}</span>
            </div>

            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">
              Chu kỳ: <strong>${period.label}</strong>
            </div>

            <!-- Progress Bar -->
            <div style="margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                <span style="font-weight: 600; color: var(--primary);">${actualHours}h / ${targetHours}h</span>
                <span style="font-weight: 600; color: ${percent >= 100 ? '#10b981' : 'var(--text-main)'};">${percent}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                <div style="width: ${percent}%; height: 100%; background: ${percent >= 100 ? '#10b981' : cat.color}; border-radius: 999px; transition: width 0.3s ease;"></div>
              </div>
            </div>

            <div style="font-size: 12px; color: var(--text-secondary);">
              ${percent >= 100 ? '🎉 <strong style="color:#10b981;">Đã đạt mục tiêu!</strong>' : `Còn thiếu <strong>${remainingHours} giờ</strong> để hoàn thành.`}
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
            <button class="btn btn-secondary btn-sm btn-edit-goal" data-id="${g.id}">Sửa</button>
            <button class="btn btn-ghost btn-sm btn-icon btn-del-goal" data-id="${g.id}" style="color: #ef4444;" title="Xóa">✕</button>
          </div>
        </div>
      `;
    }).join('');

    this._attachGoalActions();
  }

  _attachGoalActions() {
    this.element.querySelectorAll('.btn-edit-goal').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const goal = this.goals.find(g => g.id === id);
        if (goal) this._openGoalForm(goal);
      };
    });

    this.element.querySelectorAll('.btn-del-goal').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const ok = await confirmModal.ask({
          title: 'Xóa mục tiêu',
          message: 'Bạn có chắc chắn muốn xóa mục tiêu này không?'
        });
        if (ok) {
          await goalRepository.delete(id);
          toast.success('Đã xóa mục tiêu');
          this.goals = await goalRepository.getAll();
          this._renderGoals();
        }
      };
    });
  }

  _openGoalForm(goal = null) {
    const wrapper = this.element.querySelector('#goal-form-wrapper');
    wrapper.style.display = 'block';

    const isEdit = Boolean(goal);
    wrapper.innerHTML = `
      <div class="card" style="border: 2px solid var(--primary-border); padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="font-size: 16px; font-weight: 600;">${isEdit ? 'Chỉnh sửa mục tiêu' : 'Thiết lập mục tiêu mới'}</h3>
          <button class="btn btn-ghost btn-sm" id="btn-close-goal-form">✕ Đóng</button>
        </div>

        <div class="form-group">
          <label class="form-label">Tên mục tiêu <span style="color: #ef4444;">*</span></label>
          <input type="text" id="goal-title" class="form-input" value="${goal ? goal.title : ''}" placeholder="Ví dụ: Dành 4 giờ lập trình mỗi ngày" required />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Danh mục</label>
            <select id="goal-category" class="form-select">
              ${Object.values(CATEGORIES).map(c => `<option value="${c.id}" ${goal && goal.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Số giờ mục tiêu <span style="color: #ef4444;">*</span></label>
            <input type="number" id="goal-hours" class="form-input" min="0.5" step="0.5" value="${goal ? goal.targetHours : 4}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Chu kỳ</label>
            <select id="goal-period" class="form-select">
              <option value="daily" ${goal && goal.period === 'daily' ? 'selected' : ''}>Hàng ngày</option>
              <option value="weekly" ${goal && goal.period === 'weekly' ? 'selected' : ''}>Hàng tuần</option>
              <option value="monthly" ${goal && goal.period === 'monthly' ? 'selected' : ''}>Hàng tháng</option>
            </select>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button class="btn btn-secondary" id="btn-cancel-goal-form">Hủy</button>
          <button class="btn btn-primary" id="btn-save-goal-form">Lưu mục tiêu</button>
        </div>
      </div>
    `;

    wrapper.querySelector('#btn-close-goal-form').onclick = () => { wrapper.style.display = 'none'; };
    wrapper.querySelector('#btn-cancel-goal-form').onclick = () => { wrapper.style.display = 'none'; };

    wrapper.querySelector('#btn-save-goal-form').onclick = async () => {
      const title = wrapper.querySelector('#goal-title').value.trim();
      const category = wrapper.querySelector('#goal-category').value;
      const targetHours = Number(wrapper.querySelector('#goal-hours').value);
      const period = wrapper.querySelector('#goal-period').value;

      if (!title) {
        toast.warning('Vui lòng nhập tên mục tiêu');
        return;
      }

      if (!targetHours || targetHours <= 0) {
        toast.warning('Số giờ mục tiêu phải lớn hơn 0');
        return;
      }

      if (goal && goal.id) {
        await goalRepository.update({ ...goal, title, category, targetHours, period });
        toast.success('Đã cập nhật mục tiêu');
      } else {
        await goalRepository.add({ id: generateId('goal'), title, category, targetHours, period, status: 'In Progress' });
        toast.success('Đã tạo mục tiêu mới');
      }

      wrapper.style.display = 'none';
      this.goals = await goalRepository.getAll();
      this._renderGoals();
    };
  }

  _attachEvents() {
    this.element.querySelector('#btn-add-goal').onclick = () => this._openGoalForm(null);
  }
}
