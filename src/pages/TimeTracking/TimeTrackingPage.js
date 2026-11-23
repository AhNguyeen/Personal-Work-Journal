/**
 * TimeTrackingPage.js - Integrated Time Tracking:
 * 1. Persistent Stopwatch / Timer (survives reload)
 * 2. Manual Time Entry (start, end, break deduction)
 * 3. Recent Sessions History Log
 */

import { timerService } from '../../services/timerService.js';
import { activityService } from '../../services/activityService.js';
import { timerRepository } from '../../database/repositories/timerRepository.js';
import { formatSecondsToTimer, calculateDurationMinutes, formatDuration } from '../../utils/timeUtils.js';
import { getTodayDateString, formatVietnameseDate } from '../../utils/dateUtils.js';
import { toast } from '../../components/Toast.js';
import { confirmModal } from '../../components/ConfirmModal.js';

export class TimeTrackingPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
    this.timerUnsubscribe = null;
    this.activities = [];
    this.selectedActivityId = '';
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    this.activities = await activityService.getAllActivities();

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Time Tracking</h1>
          <div class="page-subtitle">Ghi nhận thời gian làm việc thực tế bằng Stopwatch và nhật ký thủ công</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
        <!-- STOPWATCH TIMER CARD -->
        <div class="card" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px 24px;">
          <div class="card-title" style="width: 100%; justify-content: flex-start; margin-bottom: 20px;">
            <span>⏱ Bộ đếm thời gian (Stopwatch)</span>
          </div>

          <div style="width: 100%; max-width: 360px; margin-bottom: 20px;">
            <label class="form-label" style="text-align: left;">Chọn hoạt động cần bấm giờ:</label>
            <select id="timer-activity-select" class="form-select">
              <option value="">-- Chọn một hoạt động --</option>
              ${this.activities.map(a => `<option value="${a.id}">[${a.category}] ${a.title} (${a.date})</option>`).join('')}
            </select>
          </div>

          <!-- Digital Clock Display -->
          <div id="stopwatch-display" style="font-size: 54px; font-weight: 700; font-family: monospace; color: var(--text-main); margin: 16px 0; letter-spacing: 2px;">
            00:00:00
          </div>

          <div id="stopwatch-target-info" style="font-size: 13px; color: var(--primary); font-weight: 500; min-height: 20px; margin-bottom: 24px;">
            Sẵn sàng bấm giờ
          </div>

          <!-- Controls Button Group -->
          <div style="display: flex; gap: 12px; align-items: center;" id="stopwatch-controls">
            <button class="btn btn-primary" id="btn-timer-start" style="min-width: 110px; padding: 10px 20px; font-size: 15px;">
              Bắt đầu
            </button>
            <button class="btn btn-secondary" id="btn-timer-pause" style="display: none; padding: 10px 20px; font-size: 15px;">
              Tạm dừng
            </button>
            <button class="btn btn-primary" id="btn-timer-resume" style="display: none; padding: 10px 20px; font-size: 15px;">
              Tiếp tục
            </button>
            <button class="btn btn-danger" id="btn-timer-stop" style="display: none; padding: 10px 20px; font-size: 15px;">
              Dừng & Lưu
            </button>
            <button class="btn btn-ghost" id="btn-timer-reset" style="padding: 10px 16px; font-size: 15px;">
              Reset
            </button>
          </div>
        </div>

        <!-- MANUAL TIME LOGGING CARD -->
        <div class="card" style="padding: 24px 28px;">
          <div class="card-title" style="margin-bottom: 20px;">
            <span>✍️ Ghi nhận thời gian thủ công</span>
          </div>

          <form id="manual-time-form">
            <div class="form-group">
              <label class="form-label">Chọn hoạt động <span style="color: #ef4444;">*</span></label>
              <select id="manual-activity" class="form-select" required>
                <option value="">-- Chọn hoạt động --</option>
                ${this.activities.map(a => `<option value="${a.id}">[${a.category}] ${a.title} (${a.date})</option>`).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label">Giờ bắt đầu <span style="color: #ef4444;">*</span></label>
                <input type="time" id="manual-start" class="form-input" required />
              </div>

              <div class="form-group">
                <label class="form-label">Giờ kết thúc <span style="color: #ef4444;">*</span></label>
                <input type="time" id="manual-end" class="form-input" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: center;">
              <div class="form-group">
                <label class="form-label">Thời gian nghỉ (phút)</label>
                <input type="number" id="manual-break" class="form-input" min="0" value="0" />
              </div>

              <div class="form-group">
                <label class="form-label">Thời gian thực tế</label>
                <div id="manual-calc-preview" style="font-size: 16px; font-weight: 700; color: var(--primary); padding-top: 6px;">
                  0 phút
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">
              Lưu thời gian thực tế vào hoạt động
            </button>
          </form>
        </div>
      </div>

      <!-- RECENT SESSIONS TABLE -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Lịch sử các phiên bấm giờ (Timer Sessions)</div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-sessions">Làm mới</button>
        </div>
        <div id="timer-sessions-table-wrapper" style="overflow-x: auto;"></div>
      </div>
    `;

    this.element = page;
    this._attachEvents();
    this._setupTimerSubscription();
    await this._renderSessionsTable();
    return page;
  }

  _setupTimerSubscription() {
    const display = this.element.querySelector('#stopwatch-display');
    const targetInfo = this.element.querySelector('#stopwatch-target-info');
    const select = this.element.querySelector('#timer-activity-select');
    const startBtn = this.element.querySelector('#btn-timer-start');
    const pauseBtn = this.element.querySelector('#btn-timer-pause');
    const resumeBtn = this.element.querySelector('#btn-timer-resume');
    const stopBtn = this.element.querySelector('#btn-timer-stop');

    this.timerUnsubscribe = timerService.subscribe((state, currentSeconds) => {
      if (!display) return;
      display.textContent = formatSecondsToTimer(currentSeconds);

      if (state.status === 'running') {
        targetInfo.innerHTML = `Đang đếm thời gian: <strong>${state.activityTitle}</strong>`;
        select.disabled = true;
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'inline-flex';
      } else if (state.status === 'paused') {
        targetInfo.innerHTML = `Đang tạm dừng: <strong>${state.activityTitle}</strong>`;
        select.disabled = true;
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'inline-flex';
        stopBtn.style.display = 'inline-flex';
      } else {
        targetInfo.textContent = 'Sẵn sàng bấm giờ';
        select.disabled = false;
        startBtn.style.display = 'inline-flex';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        stopBtn.style.display = 'none';
      }
    });
  }

  _attachEvents() {
    const select = this.element.querySelector('#timer-activity-select');
    const startBtn = this.element.querySelector('#btn-timer-start');
    const pauseBtn = this.element.querySelector('#btn-timer-pause');
    const resumeBtn = this.element.querySelector('#btn-timer-resume');
    const stopBtn = this.element.querySelector('#btn-timer-stop');
    const resetBtn = this.element.querySelector('#btn-timer-reset');

    startBtn.onclick = async () => {
      const actId = select.value;
      if (!actId) {
        toast.warning('Vui lòng chọn một hoạt động để bắt đầu đếm giờ');
        return;
      }
      const act = this.activities.find(a => a.id === actId);
      if (!act) return;

      try {
        await timerService.start(act);
        toast.success(`Bắt đầu bấm giờ cho "${act.title}"`);
      } catch (err) {
        toast.warning(err.message);
      }
    };

    pauseBtn.onclick = async () => {
      await timerService.pause();
      toast.info('Đã tạm dừng đếm giờ');
    };

    resumeBtn.onclick = async () => {
      await timerService.resume();
      toast.info('Tiếp tục đếm giờ');
    };

    stopBtn.onclick = async () => {
      const summary = await timerService.stop();
      if (summary) {
        toast.success(`Đã hoàn tất phiên bấm giờ: ${formatDuration(summary.totalMinutes)}!`);
        await this._renderSessionsTable();
      }
    };

    resetBtn.onclick = async () => {
      const ok = await confirmModal.ask({
        title: 'Đặt lại Timer',
        message: 'Bạn có chắc muốn hủy phiên đếm giờ hiện tại mà không lưu?',
        okText: 'Reset',
        isDanger: false
      });
      if (ok) {
        await timerService.reset();
        toast.info('Đã đặt lại Timer');
      }
    };

    // Manual Form events
    const manualForm = this.element.querySelector('#manual-time-form');
    const mStart = this.element.querySelector('#manual-start');
    const mEnd = this.element.querySelector('#manual-end');
    const mBreak = this.element.querySelector('#manual-break');
    const mAct = this.element.querySelector('#manual-activity');
    const preview = this.element.querySelector('#manual-calc-preview');

    const updateManualCalc = () => {
      if (mStart.value && mEnd.value) {
        const mins = calculateDurationMinutes(mStart.value, mEnd.value, Number(mBreak.value) || 0);
        preview.textContent = formatDuration(mins);
      }
    };

    mStart.onchange = updateManualCalc;
    mEnd.onchange = updateManualCalc;
    mBreak.oninput = updateManualCalc;

    mAct.onchange = () => {
      const act = this.activities.find(a => a.id === mAct.value);
      if (act) {
        mStart.value = act.startTime || '09:00';
        mEnd.value = act.endTime || '10:00';
        mBreak.value = act.breakMinutes || 0;
        updateManualCalc();
      }
    };

    manualForm.onsubmit = async (e) => {
      e.preventDefault();
      const actId = mAct.value;
      if (!actId) {
        toast.warning('Vui lòng chọn hoạt động');
        return;
      }

      const mins = calculateDurationMinutes(mStart.value, mEnd.value, Number(mBreak.value) || 0);
      if (mins <= 0) {
        toast.warning('Giờ kết thúc phải lớn hơn giờ bắt đầu và thời gian nghỉ');
        return;
      }

      const act = this.activities.find(a => a.id === actId);
      if (act) {
        act.actualDurationMinutes = mins;
        act.actualDurationSeconds = mins * 60;
        act.manualSeconds = mins * 60;
        act.manuallyConfirmed = true;
        act.actualDurationSource = 'manual_verified';
        act.status = 'Completed';
        await activityService.updateActivity(act, true);
        toast.success(`Đã cập nhật thời gian thực tế: ${formatDuration(mins)} cho "${act.title}"`);
      }
    };

    this.element.querySelector('#btn-refresh-sessions').onclick = () => {
      this._renderSessionsTable();
    };
  }

  async _renderSessionsTable() {
    const wrapper = this.element.querySelector('#timer-sessions-table-wrapper');
    if (!wrapper) return;

    const sessions = await timerRepository.getAll();
    const completed = sessions.filter(s => s.status === 'completed').reverse();

    if (completed.length === 0) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 13px;">
          Chưa có phiên bấm giờ nào được ghi nhận.
        </div>
      `;
      return;
    }

    wrapper.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-default); text-align: left; color: var(--text-secondary);">
            <th style="padding: 10px;">Hoạt động</th>
            <th style="padding: 10px;">Bắt đầu</th>
            <th style="padding: 10px;">Kết thúc</th>
            <th style="padding: 10px;">Tổng thời gian</th>
            <th style="padding: 10px; width: 60px;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${completed.map(s => {
            const startStr = s.startTime ? new Date(s.startTime).toLocaleTimeString('vi-VN') : 'N/A';
            const endStr = s.endTime ? new Date(s.endTime).toLocaleTimeString('vi-VN') : 'N/A';
            return `
              <tr style="border-bottom: 1px solid var(--border-subtle);">
                <td style="padding: 10px; font-weight: 500;">${s.activityTitle || s.activityId}</td>
                <td style="padding: 10px; color: var(--text-muted);">${startStr}</td>
                <td style="padding: 10px; color: var(--text-muted);">${endStr}</td>
                <td style="padding: 10px; font-weight: 600; color: var(--primary);">${formatSecondsToTimer(s.totalSeconds || 0)}</td>
                <td style="padding: 10px;">
                  <button class="btn btn-ghost btn-sm btn-icon btn-del-session" data-id="${s.id}" style="color: #ef4444;" title="Xóa phiên">✕</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    wrapper.querySelectorAll('.btn-del-session').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const ok = await confirmModal.ask({
          title: 'Xóa phiên',
          message: 'Bạn có chắc chắn muốn xóa phiên ghi nhận này không?'
        });
        if (ok) {
          await timerRepository.delete(id);
          toast.success('Đã xóa phiên');
          this._renderSessionsTable();
        }
      };
    });
  }

  destroy() {
    if (this.timerUnsubscribe) {
      this.timerUnsubscribe();
    }
  }
}
