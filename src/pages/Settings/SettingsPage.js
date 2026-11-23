/**
 * SettingsPage.js - Settings, Database Maintenance, Backup & Restore
 * Export JSON, Import JSON (Replace / Merge with safety checks),
 * and Demo Sample Data Generator.
 */

import { backupService } from '../../services/backupService.js';
import { databaseService } from '../../database/databaseService.js';
import { STORES } from '../../database/db.js';
import { toast } from '../../components/Toast.js';
import { confirmModal } from '../../components/ConfirmModal.js';

export class SettingsPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    // Get current record counts
    let actCount = 0;
    let dailyCount = 0;
    let notesCount = 0;
    let goalsCount = 0;

    try {
      actCount = (await databaseService.getAll(STORES.ACTIVITIES)).length;
      dailyCount = (await databaseService.getAll(STORES.DAILY_NOTES)).length;
      notesCount = (await databaseService.getAll(STORES.NOTES)).length;
      goalsCount = (await databaseService.getAll(STORES.GOALS)).length;
    } catch (e) {
      console.warn('Could not read store counts:', e);
    }

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings & Backup</h1>
          <div class="page-subtitle">Quản lý cấu hình, sao lưu và phục hồi dữ liệu cá nhân IndexedDB</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 860px;">
        <!-- Database Overview Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🗄️ Cơ sở dữ liệu IndexedDB (PersonalWorkJournalDB)</div>
            <div class="db-status-pill">Đang kết nối</div>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
            Toàn bộ dữ liệu nghiệp vụ của bạn được lưu trữ an toàn trong trình duyệt cục bộ, không gửi ra ngoài Internet, đảm bảo tính riêng tư tuyệt đối.
          </p>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px;">
            <div style="background: #f8fafc; border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 12px; text-align: center;">
              <div style="font-size: 18px; font-weight: 700; color: var(--primary);">${actCount}</div>
              <div style="font-size: 12px; color: var(--text-muted);">Hoạt động (Activities)</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 12px; text-align: center;">
              <div style="font-size: 18px; font-weight: 700; color: #7c3aed;">${dailyCount}</div>
              <div style="font-size: 12px; color: var(--text-muted);">Daily Notes</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 12px; text-align: center;">
              <div style="font-size: 18px; font-weight: 700; color: #059669;">${notesCount}</div>
              <div style="font-size: 12px; color: var(--text-muted);">Ghi chú (Notes)</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 12px; text-align: center;">
              <div style="font-size: 18px; font-weight: 700; color: #d97706;">${goalsCount}</div>
              <div style="font-size: 12px; color: var(--text-muted);">Mục tiêu (Goals)</div>
            </div>
          </div>
        </div>

        <!-- Export Backup Card -->
        <div class="card">
          <div class="card-title" style="margin-bottom: 8px;">💾 Sao lưu dữ liệu (Export JSON)</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
            Xuất toàn bộ lịch trình, nhật ký, mục tiêu và phiên bấm giờ thành một file JSON duy nhất để chuyển sang máy tính khác hoặc lưu trữ an toàn.
          </p>
          <button class="btn btn-primary" id="btn-export-backup">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Tải về file Backup (.json)</span>
          </button>
        </div>

        <!-- Import Restore Card -->
        <div class="card">
          <div class="card-title" style="margin-bottom: 8px;">📥 Phục hồi dữ liệu (Import JSON)</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
            Khôi phục dữ liệu từ file sao lưu trước đó. Hệ thống hỗ trợ 2 chế độ: Thay thế toàn bộ (Replace) hoặc Hợp nhất (Merge).
          </p>

          <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 16px;">
            <input type="file" id="import-file-input" accept=".json" class="form-input" style="max-width: 380px;" />
            <select id="import-mode-select" class="form-select" style="max-width: 200px;">
              <option value="replace">Chế độ Replace (Ghi đè)</option>
              <option value="merge">Chế độ Merge (Hợp nhất)</option>
            </select>
          </div>

          <div id="import-preview-box" style="display: none; background: #fafbfc; border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">Chi tiết file sao lưu:</div>
            <div id="import-preview-stats" style="font-size: 13px; color: var(--text-secondary);"></div>
          </div>

          <button class="btn btn-secondary" id="btn-execute-import" disabled>
            Tiến hành khôi phục dữ liệu
          </button>
        </div>

        <!-- Demo Data Generator Card -->
        <div class="card" style="border: 1px dashed var(--primary-border);">
          <div class="card-title" style="margin-bottom: 8px;">✨ Tạo dữ liệu mẫu (Sample Demo Data)</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
            Tạo sẵn một lịch trình làm việc và học tập phong phú cho hôm nay và tuần này (các hoạt động 1-5 sao, Daily Note, mục tiêu mẫu) để trải nghiệm đầy đủ giao diện Timeline và biểu đồ.
          </p>
          <button class="btn btn-secondary" id="btn-load-demo-data">
            Khởi tạo dữ liệu mẫu thực tế
          </button>
        </div>

        <!-- Danger Zone -->
        <div class="card" style="border-color: #fecaca; background-color: #fffafb;">
          <div class="card-title" style="color: #ef4444; margin-bottom: 8px;">⚠️ Khu vực nguy hiểm</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
            Xóa toàn bộ dữ liệu trong IndexedDB trên trình duyệt này. Hãy nhớ xuất file sao lưu trước khi thực hiện.
          </p>
          <button class="btn btn-danger btn-sm" id="btn-clear-all-data">
            Xóa sạch toàn bộ dữ liệu
          </button>
        </div>
      </div>
    `;

    this.element = page;
    this._attachEvents();
    return page;
  }

  _attachEvents() {
    // Export JSON
    this.element.querySelector('#btn-export-backup').onclick = async () => {
      try {
        await backupService.exportJSON();
        toast.success('Đã tải xuống file sao lưu JSON an toàn!');
      } catch (err) {
        toast.error('Lỗi khi xuất dữ liệu: ' + err.message);
      }
    };

    // Import file picker
    const fileInput = this.element.querySelector('#import-file-input');
    const modeSelect = this.element.querySelector('#import-mode-select');
    const importBtn = this.element.querySelector('#btn-execute-import');
    const previewBox = this.element.querySelector('#import-preview-box');
    const previewStats = this.element.querySelector('#import-preview-stats');

    let parsedBackupData = null;

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const validation = backupService.validateBackupFile(text);
        if (!validation.isValid) {
          toast.error(validation.message);
          importBtn.disabled = true;
          previewBox.style.display = 'none';
          return;
        }

        parsedBackupData = validation.data;
        previewBox.style.display = 'block';
        previewStats.innerHTML = `
          Phiên bản ứng dụng: <strong>${parsedBackupData.metadata?.app || 'PersonalWorkJournal'}</strong> |
          Ngày xuất: <strong>${parsedBackupData.metadata?.exportedAt ? new Date(parsedBackupData.metadata.exportedAt).toLocaleString('vi-VN') : 'N/A'}</strong><br>
          Gồm: <strong>${validation.stats.activitiesCount}</strong> hoạt động, <strong>${validation.stats.dailyNotesCount}</strong> Daily Notes, <strong>${validation.stats.notesCount}</strong> Notes, <strong>${validation.stats.goalsCount}</strong> mục tiêu.
        `;
        importBtn.disabled = false;
      };
      reader.readAsText(file);
    };

    // Execute Import
    importBtn.onclick = async () => {
      if (!parsedBackupData) return;
      const mode = modeSelect.value;

      const ok = await confirmModal.ask({
        title: mode === 'replace' ? 'Xác nhận ghi đè dữ liệu' : 'Xác nhận hợp nhất dữ liệu',
        message: mode === 'replace'
          ? 'Hành động này sẽ xóa toàn bộ dữ liệu hiện có và thay thế bằng dữ liệu trong file backup. Bạn có chắc chắn?'
          : 'Hệ thống sẽ hợp nhất các bản ghi từ file backup vào cơ sở dữ liệu hiện tại. Bạn có chắc chắn?'
      });

      if (ok) {
        try {
          await backupService.importJSON(parsedBackupData, mode);
          toast.success('Phục hồi dữ liệu thành công!');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          toast.error('Lỗi khi phục hồi: ' + err.message);
        }
      }
    };

    // Load Demo Data
    this.element.querySelector('#btn-load-demo-data').onclick = async () => {
      const ok = await confirmModal.ask({
        title: 'Khởi tạo dữ liệu mẫu',
        message: 'Hành động này sẽ thiết lập dữ liệu mẫu phong phú để bạn trải nghiệm ngay. Bạn có muốn tiếp tục?',
        isDanger: false,
        okText: 'Tạo dữ liệu mẫu'
      });

      if (ok) {
        await backupService.generateSampleDemoData();
        toast.success('Đã nạp dữ liệu mẫu thành công!');
        if (this.onNavigate) this.onNavigate('dashboard');
      }
    };

    // Clear All
    this.element.querySelector('#btn-clear-all-data').onclick = async () => {
      const ok = await confirmModal.ask({
        title: 'CẢNH BÁO: XÓA SẠCH DỮ LIỆU',
        message: 'Toàn bộ hoạt động, nhật ký, mục tiêu và phiên đếm giờ trong IndexedDB sẽ bị xóa vĩnh viễn. Bạn có chắc chắn 100%?',
        okText: 'Xóa vĩnh viễn',
        isDanger: true
      });

      if (ok) {
        for (const store of Object.values(STORES)) {
          await databaseService.clearStore(store);
        }
        toast.success('Đã xóa sạch toàn bộ cơ sở dữ liệu');
        setTimeout(() => {
          window.location.reload();
        }, 600);
      }
    };
  }
}
