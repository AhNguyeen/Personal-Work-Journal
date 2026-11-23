/**
 * ActivityModal.js - Add & Edit Activity Dialog with comprehensive validation,
 * star rating (1-5), time overlap warnings, and Vietnamese labels.
 */

import { activityService } from '../services/activityService.js';
import { CATEGORIES, STATUSES, STAR_RATINGS } from '../utils/constants.js';
import { calculateDurationMinutes, formatDuration } from '../utils/timeUtils.js';
import { getTodayDateString } from '../utils/dateUtils.js';
import { toast } from './Toast.js';

class ActivityModal {
  constructor() {
    this.backdrop = null;
    this.currentActivity = null;
    this.selectedStars = 3;
    this._onSavedCallback = null;
  }

  _ensureDOM() {
    if (this.backdrop) return;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.id = 'activity-modal-backdrop';

    const categoryOptions = Object.values(CATEGORIES)
      .map(c => `<option value="${c.id}">${c.label}</option>`)
      .join('');

    const statusOptions = Object.values(STATUSES)
      .map(s => `<option value="${s.id}">${s.label}</option>`)
      .join('');

    this.backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title" id="act-modal-title">Thêm hoạt động mới</h3>
          <button class="btn btn-ghost btn-icon" id="act-modal-close" style="font-size: 20px;">&times;</button>
        </div>
        <form id="act-modal-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="act-title">Tên hoạt động <span style="color:#ef4444;">*</span></label>
              <input type="text" id="act-title" class="form-input" placeholder="Ví dụ: Thiết kế giao diện Dashboard" required />
              <div class="form-error" id="err-act-title"></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="act-desc">Mô tả chi tiết</label>
              <textarea id="act-desc" class="form-textarea" placeholder="Nội dung, mục tiêu hoặc ghi chú công việc..."></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label" for="act-category">Danh mục</label>
                <select id="act-category" class="form-select">
                  ${categoryOptions}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="act-status">Trạng thái</label>
                <select id="act-status" class="form-select">
                  ${statusOptions}
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" for="act-date">Ngày thực hiện <span style="color:#ef4444;">*</span></label>
                <input type="date" id="act-date" class="form-input" required />
                <div class="form-error" id="err-act-date"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="act-start">Bắt đầu <span style="color:#ef4444;">*</span></label>
                <input type="time" id="act-start" class="form-input" required />
                <div class="form-error" id="err-act-start"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="act-end">Kết thúc <span style="color:#ef4444;">*</span></label>
                <input type="time" id="act-end" class="form-input" required />
                <div class="form-error" id="err-act-end"></div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: center;">
              <div class="form-group">
                <label class="form-label" for="act-break">Thời gian nghỉ (phút)</label>
                <input type="number" id="act-break" class="form-input" min="0" max="300" value="0" />
              </div>

              <div class="form-group">
                <label class="form-label">Thời lượng dự kiến</label>
                <div id="act-duration-preview" style="font-size: 14px; font-weight: 600; color: var(--primary); padding-top: 6px;">
                  0 phút
                </div>
              </div>
            </div>

            <!-- Star Rating (1 to 5 stars) -->
            <div class="form-group" style="background: #fafbfc; padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-default);">
              <label class="form-label" style="margin-bottom: 8px;">Đánh giá mức độ quan trọng (1 - 5 sao)</label>
              <div style="display: flex; align-items: center; gap: 14px;">
                <div class="star-rating" id="act-star-picker">
                  ${[1, 2, 3, 4, 5].map(s => `<span class="star" data-star="${s}" style="font-size: 24px;">★</span>`).join('')}
                </div>
                <span id="act-star-label" style="font-size: 13px; font-weight: 500; color: var(--text-secondary);">
                  Cần chú ý (3 sao)
                </span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="act-note">Ghi chú liên quan</label>
              <input type="text" id="act-note" class="form-input" placeholder="Ghi chú ngắn hoặc liên kết..." />
            </div>

            <!-- Conflict warning banner -->
            <div id="act-overlap-warning" style="display: none; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 12px; margin-top: 10px;">
              <div style="display: flex; gap: 8px; font-size: 13px; color: #b45309;">
                <span>⚠️</span>
                <div id="act-overlap-text"></div>
              </div>
              <label style="display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; font-weight: 600; color: #92400e; cursor: pointer;">
                <input type="checkbox" id="act-allow-overlap" />
                Tôi muốn lưu hoạt động này dù có sự trùng giờ
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="act-modal-cancel">Hủy</button>
            <button type="submit" class="btn btn-primary" id="act-modal-submit">Lưu hoạt động</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.backdrop);
    this._attachEvents();
  }

  _attachEvents() {
    const form = this.backdrop.querySelector('#act-modal-form');
    const closeBtn = this.backdrop.querySelector('#act-modal-close');
    const cancelBtn = this.backdrop.querySelector('#act-modal-cancel');
    const starPicker = this.backdrop.querySelector('#act-star-picker');
    const startInput = this.backdrop.querySelector('#act-start');
    const endInput = this.backdrop.querySelector('#act-end');
    const breakInput = this.backdrop.querySelector('#act-break');

    const updateDuration = () => {
      const s = startInput.value;
      const e = endInput.value;
      const b = Number(breakInput.value) || 0;
      if (s && e) {
        const mins = calculateDurationMinutes(s, e, b);
        this.backdrop.querySelector('#act-duration-preview').textContent = formatDuration(mins);
      }
    };

    startInput.addEventListener('change', updateDuration);
    endInput.addEventListener('change', updateDuration);
    breakInput.addEventListener('input', updateDuration);

    // Star picker
    starPicker.addEventListener('click', (e) => {
      const starEl = e.target.closest('.star');
      if (starEl) {
        const star = Number(starEl.dataset.star);
        this._setStars(star);
      }
    });

    closeBtn.onclick = () => this.close();
    cancelBtn.onclick = () => this.close();

    form.onsubmit = async (e) => {
      e.preventDefault();
      await this._handleSave();
    };
  }

  _setStars(star) {
    this.selectedStars = star;
    const stars = this.backdrop.querySelectorAll('#act-star-picker .star');
    stars.forEach((s) => {
      const val = Number(s.dataset.star);
      if (val <= star) {
        s.classList.add('filled');
      } else {
        s.classList.remove('filled');
      }
    });

    const info = STAR_RATINGS[star] || { label: '' };
    this.backdrop.querySelector('#act-star-label').textContent = `${info.label} (${star} sao)`;
  }

  open({ activity = null, defaultDate = null, defaultStartTime = null, onSaved = null } = {}) {
    this._ensureDOM();
    this.currentActivity = activity;
    this._onSavedCallback = onSaved;

    const titleEl = this.backdrop.querySelector('#act-modal-title');
    const form = this.backdrop.querySelector('#act-modal-form');
    form.reset();

    // Reset errors and warnings
    this.backdrop.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    this.backdrop.querySelector('#act-overlap-warning').style.display = 'none';
    this.backdrop.querySelector('#act-allow-overlap').checked = false;

    if (activity) {
      titleEl.textContent = 'Chỉnh sửa hoạt động';
      this.backdrop.querySelector('#act-title').value = activity.title || '';
      this.backdrop.querySelector('#act-desc').value = activity.description || '';
      this.backdrop.querySelector('#act-category').value = activity.category || 'Work';
      this.backdrop.querySelector('#act-status').value = activity.status || 'Planned';
      this.backdrop.querySelector('#act-date').value = activity.date || getTodayDateString();
      this.backdrop.querySelector('#act-start').value = activity.startTime || '09:00';
      this.backdrop.querySelector('#act-end').value = activity.endTime || '10:00';
      this.backdrop.querySelector('#act-break').value = activity.breakMinutes || 0;
      this.backdrop.querySelector('#act-note').value = activity.relatedNote || '';
      this._setStars(Number(activity.stars) || 3);
    } else {
      titleEl.textContent = 'Thêm hoạt động mới';
      this.backdrop.querySelector('#act-date').value = defaultDate || getTodayDateString();
      this.backdrop.querySelector('#act-start').value = defaultStartTime || '09:00';
      // End time + 1h
      const [h, m] = (defaultStartTime || '09:00').split(':').map(Number);
      const endH = String(Math.min(23, h + 1)).padStart(2, '0');
      this.backdrop.querySelector('#act-end').value = `${endH}:${String(m).padStart(2, '0')}`;
      this._setStars(3);
    }

    // Trigger duration update
    const s = this.backdrop.querySelector('#act-start').value;
    const e = this.backdrop.querySelector('#act-end').value;
    const mins = calculateDurationMinutes(s, e, 0);
    this.backdrop.querySelector('#act-duration-preview').textContent = formatDuration(mins);

    this.backdrop.classList.add('open');
  }

  close() {
    if (this.backdrop) {
      this.backdrop.classList.remove('open');
    }
  }

  async _handleSave() {
    const title = this.backdrop.querySelector('#act-title').value.trim();
    const description = this.backdrop.querySelector('#act-desc').value.trim();
    const category = this.backdrop.querySelector('#act-category').value;
    const status = this.backdrop.querySelector('#act-status').value;
    const date = this.backdrop.querySelector('#act-date').value;
    const startTime = this.backdrop.querySelector('#act-start').value;
    const endTime = this.backdrop.querySelector('#act-end').value;
    const breakMinutes = Number(this.backdrop.querySelector('#act-break').value) || 0;
    const relatedNote = this.backdrop.querySelector('#act-note').value.trim();
    const allowOverlap = this.backdrop.querySelector('#act-allow-overlap').checked;

    const payload = {
      id: this.currentActivity ? this.currentActivity.id : undefined,
      title,
      description,
      category,
      status,
      date,
      startTime,
      endTime,
      breakMinutes,
      stars: this.selectedStars,
      relatedNote,
      // Bảo tồn provenance từ currentActivity khi chỉnh sửa thông tin chung
      ...(this.currentActivity ? {
        actualDurationMinutes: this.currentActivity.actualDurationMinutes,
        actualDurationSeconds: this.currentActivity.actualDurationSeconds,
        actualDurationSource: this.currentActivity.actualDurationSource,
        timerSeconds: this.currentActivity.timerSeconds,
        manualSeconds: this.currentActivity.manualSeconds,
        projectId: this.currentActivity.projectId,
        recurrenceRuleId: this.currentActivity.recurrenceRuleId,
        isOccurrenceOverridden: this.currentActivity.isOccurrenceOverridden
      } : {})
    };

    try {
      let saved;
      if (this.currentActivity) {
        saved = await activityService.updateActivity(payload, allowOverlap);
        toast.success(`Đã cập nhật hoạt động "${saved.title}"`);
      } else {
        saved = await activityService.createActivity(payload, allowOverlap);
        toast.success(`Đã thêm hoạt động "${saved.title}"`);
      }

      this.close();
      if (this._onSavedCallback) {
        this._onSavedCallback(saved);
      }
    } catch (err) {
      if (err.isOverlapConflict) {
        const warningBox = this.backdrop.querySelector('#act-overlap-warning');
        const warningText = this.backdrop.querySelector('#act-overlap-text');
        warningText.textContent = err.message;
        warningBox.style.display = 'block';
        toast.warning('Phát hiện trùng giờ! Vui lòng kiểm tra lại hoặc tích xác nhận lưu.');
      } else {
        toast.error(err.message || 'Lỗi khi lưu hoạt động');
      }
    }
  }
}

export const activityModal = new ActivityModal();
