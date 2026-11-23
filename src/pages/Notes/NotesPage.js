/**
 * NotesPage.js - Work Journal System:
 * 1. Daily Note (Structured daily reflection with debounce auto-save)
 * 2. Multiple Notes (Multi-note collection with tagging, pin, search)
 */

import { noteService } from '../../services/noteService.js';
import { getTodayDateString, formatVietnameseDate, addDays } from '../../utils/dateUtils.js';
import { debounce } from '../../utils/formatters.js';
import { toast } from '../../components/Toast.js';
import { confirmModal } from '../../components/ConfirmModal.js';

export class NotesPage {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.element = null;
    this.currentDate = getTodayDateString();
    this.activeSubtab = 'daily'; // 'daily' | 'multiple'
    this.dailyNote = null;
    this.editingNote = null;
    this.boundDebouncedDailySave = null;
  }

  async render() {
    const page = document.createElement('div');
    page.className = 'page-container';

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Notes & Work Journal</h1>
          <div class="page-subtitle">Nhật ký tổng kết công việc theo ngày và kho ghi chú chi tiết</div>
        </div>

        <!-- Subtabs -->
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary ${this.activeSubtab === 'daily' ? 'btn-primary' : ''}" id="subtab-daily-btn">
            📖 Daily Journal
          </button>
          <button class="btn btn-secondary ${this.activeSubtab === 'multiple' ? 'btn-primary' : ''}" id="subtab-multi-btn">
            📝 Multiple Notes
          </button>
        </div>
      </div>

      <div id="notes-content-container"></div>
    `;

    this.element = page;
    await this._renderSubtabContent();
    this._attachSubtabEvents();
    return page;
  }

  _attachSubtabEvents() {
    const dailyBtn = this.element.querySelector('#subtab-daily-btn');
    const multiBtn = this.element.querySelector('#subtab-multi-btn');

    dailyBtn.onclick = () => {
      this.activeSubtab = 'daily';
      dailyBtn.className = 'btn btn-primary';
      multiBtn.className = 'btn btn-secondary';
      this._renderSubtabContent();
    };

    multiBtn.onclick = () => {
      this.activeSubtab = 'multiple';
      multiBtn.className = 'btn btn-primary';
      dailyBtn.className = 'btn btn-secondary';
      this._renderSubtabContent();
    };
  }

  async _renderSubtabContent() {
    const container = this.element.querySelector('#notes-content-container');
    if (!container) return;

    if (this.activeSubtab === 'daily') {
      await this._renderDailyNoteSection(container);
    } else {
      await this._renderMultipleNotesSection(container);
    }
  }

  // ================= 1. DAILY NOTE SECTION =================
  async _renderDailyNoteSection(container) {
    this.dailyNote = await noteService.getDailyNote(this.currentDate);

    container.innerHTML = `
      <!-- Daily Date Navigation and Auto-save indicator -->
      <div class="card" style="margin-bottom: 20px; padding: 14px 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn btn-secondary btn-sm" id="daily-nav-prev">◀</button>
            <button class="btn btn-secondary btn-sm" id="daily-nav-today">Hôm nay</button>
            <button class="btn btn-secondary btn-sm" id="daily-nav-next">▶</button>
            <span style="font-weight: 600; font-size: 15px; margin-left: 6px;">${formatVietnameseDate(this.currentDate)}</span>
            <input type="date" id="daily-date-input" value="${this.currentDate}" style="border: 1px solid var(--border-default); border-radius: var(--radius-sm); padding: 3px 8px; font-size: 12px;" />
          </div>

          <div style="display: flex; align-items: center; gap: 16px;">
            <div id="daily-save-status" class="autosave-status saved">
              <span>●</span>
              <span>Đã lưu vào IndexedDB</span>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
              <span>Đánh giá ngày:</span>
              <select id="daily-rating" class="form-select" style="width: 130px; padding: 4px 8px; font-size: 12px;">
                <option value="5" ${this.dailyNote.rating === 5 ? 'selected' : ''}>★★★★★ Rất tốt</option>
                <option value="4" ${this.dailyNote.rating === 4 ? 'selected' : ''}>★★★★☆ Tốt</option>
                <option value="3" ${this.dailyNote.rating === 3 ? 'selected' : ''}>★★★☆☆ Bình thường</option>
                <option value="2" ${this.dailyNote.rating === 2 ? 'selected' : ''}>★★☆☆☆ Cần cố gắng</option>
                <option value="1" ${this.dailyNote.rating === 1 ? 'selected' : ''}>★☆☆☆☆ Kém</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- 7 Reflection fields -->
      <div class="card">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 600; color: var(--primary);">1. Hôm nay đã làm gì?</label>
            <textarea id="dn-whatDone" class="form-textarea" style="min-height: 100px;" placeholder="Tóm tắt các hoạt động chính đã hoàn thành...">${this.dailyNote.whatDone || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600; color: #7c3aed;">2. Những điều đã học được?</label>
            <textarea id="dn-whatLearned" class="form-textarea" style="min-height: 100px;" placeholder="Kiến thức mới, bài học kinh nghiệm rút ra...">${this.dailyNote.whatLearned || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600; color: #059669;">3. Kết quả & thành tựu đạt được?</label>
            <textarea id="dn-achievements" class="form-textarea" style="min-height: 100px;" placeholder="Những kết quả đáng mừng, mục tiêu đã hoàn tất...">${this.dailyNote.achievements || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600; color: #ef4444;">4. Khó khăn gặp phải & giải pháp?</label>
            <textarea id="dn-obstacles" class="form-textarea" style="min-height: 100px;" placeholder="Trở ngại về thời gian, kỹ thuật hoặc tâm lý...">${this.dailyNote.obstacles || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600; color: #d97706;">5. Những việc chưa hoàn thành?</label>
            <textarea id="dn-unfinished" class="form-textarea" style="min-height: 100px;" placeholder="Các đầu việc cần chuyển sang hôm sau...">${this.dailyNote.unfinished || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 600; color: #2563eb;">6. Kế hoạch & mục tiêu ngày mai?</label>
            <textarea id="dn-tomorrowPlan" class="form-textarea" style="min-height: 100px;" placeholder="Top 3 việc quan trọng nhất cho ngày mai...">${this.dailyNote.tomorrowPlan || ''}</textarea>
          </div>
        </div>
      </div>
    `;

    this._attachDailyEvents();
  }

  _attachDailyEvents() {
    const prevBtn = this.element.querySelector('#daily-nav-prev');
    const nextBtn = this.element.querySelector('#daily-nav-next');
    const todayBtn = this.element.querySelector('#daily-nav-today');
    const dateInput = this.element.querySelector('#daily-date-input');

    prevBtn.onclick = () => {
      this.currentDate = addDays(this.currentDate, -1);
      this._renderSubtabContent();
    };

    nextBtn.onclick = () => {
      this.currentDate = addDays(this.currentDate, 1);
      this._renderSubtabContent();
    };

    todayBtn.onclick = () => {
      this.currentDate = getTodayDateString();
      this._renderSubtabContent();
    };

    dateInput.onchange = (e) => {
      if (e.target.value) {
        this.currentDate = e.target.value;
        this._renderSubtabContent();
      }
    };

    // Debounced Auto-save
    const statusEl = this.element.querySelector('#daily-save-status');
    const setStatus = (state, text) => {
      if (!statusEl) return;
      statusEl.className = `autosave-status ${state}`;
      statusEl.innerHTML = `<span>●</span><span>${text}</span>`;
    };

    const doSave = async () => {
      setStatus('saving', 'Đang lưu vào IndexedDB...');
      try {
        const payload = {
          ...this.dailyNote,
          date: this.currentDate,
          whatDone: this.element.querySelector('#dn-whatDone').value,
          whatLearned: this.element.querySelector('#dn-whatLearned').value,
          achievements: this.element.querySelector('#dn-achievements').value,
          obstacles: this.element.querySelector('#dn-obstacles').value,
          unfinished: this.element.querySelector('#dn-unfinished').value,
          tomorrowPlan: this.element.querySelector('#dn-tomorrowPlan').value,
          rating: Number(this.element.querySelector('#daily-rating').value) || 4
        };
        this.dailyNote = await noteService.saveDailyNote(payload);
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setStatus('saved', `Đã lưu lúc ${timeStr}`);
      } catch (err) {
        console.error('Error saving daily note:', err);
        setStatus('error', 'Lỗi khi lưu dữ liệu!');
      }
    };

    this.boundDebouncedDailySave = debounce(doSave, 600);

    const inputs = this.element.querySelectorAll('#dn-whatDone, #dn-whatLearned, #dn-achievements, #dn-obstacles, #dn-unfinished, #dn-tomorrowPlan');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        setStatus('saving', 'Đang chỉnh sửa...');
        this.boundDebouncedDailySave();
      });
      input.addEventListener('blur', () => {
        doSave();
      });
    });

    const ratingSelect = this.element.querySelector('#daily-rating');
    ratingSelect.onchange = () => {
      doSave();
    };
  }

  // ================= 2. MULTIPLE NOTES SECTION =================
  async _renderMultipleNotesSection(container) {
    const allNotes = await noteService.getAllNotes();

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <input type="text" id="multi-search" class="form-input" placeholder="Tìm kiếm ghi chú..." style="width: 260px;" />
        </div>
        <button class="btn btn-primary" id="btn-add-multi-note">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Tạo ghi chú mới</span>
        </button>
      </div>

      <!-- Note Editor Box (when active) -->
      <div id="note-editor-wrapper" style="display: none; margin-bottom: 24px;"></div>

      <!-- Notes Grid -->
      <div id="multi-notes-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;"></div>
    `;

    this._renderNotesGrid(allNotes);
    this._attachMultipleNotesEvents(allNotes);
  }

  _renderNotesGrid(notes) {
    const grid = this.element.querySelector('#multi-notes-grid');
    if (!grid) return;

    if (notes.length === 0) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">📝</div>
          <div style="font-weight: 600; font-size: 15px; color: var(--text-main);">Chưa có ghi chú nào</div>
          <div style="font-size: 13px; margin-top: 4px;">Nhấn nút "+ Tạo ghi chú mới" để lưu ý tưởng và nội dung công việc.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = notes.map(n => `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; position: relative;">
        <div>
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
            <h3 style="font-size: 15px; font-weight: 600;">${n.title}</h3>
            <button class="btn btn-ghost btn-sm btn-icon btn-pin-note" data-id="${n.id}" title="${n.isPinned ? 'Bỏ ghim' : 'Ghim ghi chú'}" style="color: ${n.isPinned ? '#f59e0b' : 'var(--text-muted)'};">
              📌
            </button>
          </div>

          <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px; max-height: 120px; overflow: hidden; text-overflow: ellipsis;">
            ${n.content || '<em style="color: var(--text-muted);">Chưa có nội dung</em>'}
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; pt: 12px; border-top: 1px solid var(--border-subtle); font-size: 12px; color: var(--text-muted); margin-top: 12px;">
          <span>📅 ${formatVietnameseDate(n.date)}</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm btn-edit-note" data-id="${n.id}">Sửa</button>
            <button class="btn btn-ghost btn-sm btn-icon btn-del-note" data-id="${n.id}" style="color: #ef4444;" title="Xóa">✕</button>
          </div>
        </div>
      </div>
    `).join('');

    // Attach actions
    grid.querySelectorAll('.btn-pin-note').forEach(btn => {
      btn.onclick = async () => {
        await noteService.togglePin(btn.dataset.id);
        const fresh = await noteService.getAllNotes();
        this._renderNotesGrid(fresh);
      };
    });

    grid.querySelectorAll('.btn-edit-note').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const note = notes.find(n => n.id === id);
        if (note) this._openNoteEditor(note);
      };
    });

    grid.querySelectorAll('.btn-del-note').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const ok = await confirmModal.ask({
          title: 'Xóa ghi chú',
          message: 'Bạn có chắc chắn muốn xóa ghi chú này không?'
        });
        if (ok) {
          await noteService.deleteNote(id);
          toast.success('Đã xóa ghi chú');
          const fresh = await noteService.getAllNotes();
          this._renderNotesGrid(fresh);
        }
      };
    });
  }

  _openNoteEditor(note = null) {
    const wrapper = this.element.querySelector('#note-editor-wrapper');
    wrapper.style.display = 'block';

    const isEdit = Boolean(note);
    wrapper.innerHTML = `
      <div class="card" style="border: 2px solid var(--primary-border); padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="font-size: 16px; font-weight: 600;">${isEdit ? 'Chỉnh sửa ghi chú' : 'Tạo ghi chú mới'}</h3>
          <button class="btn btn-ghost btn-sm" id="btn-close-note-editor">✕ Đóng</button>
        </div>

        <div class="form-group">
          <label class="form-label">Tiêu đề ghi chú <span style="color: #ef4444;">*</span></label>
          <input type="text" id="editor-note-title" class="form-input" value="${note ? note.title : ''}" placeholder="Nhập tiêu đề..." />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Ngày ghi chú</label>
            <input type="date" id="editor-note-date" class="form-input" value="${note ? note.date : getTodayDateString()}" />
          </div>

          <div class="form-group">
            <label class="form-label">Danh mục / Phân loại</label>
            <input type="text" id="editor-note-cat" class="form-input" value="${note ? note.category : 'Work'}" placeholder="Work, Ideas, Meeting..." />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Nội dung ghi chú</label>
          <textarea id="editor-note-content" class="form-textarea" style="min-height: 140px;" placeholder="Ghi chú chi tiết, định dạng...">${note ? note.content : ''}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
          <button class="btn btn-secondary" id="btn-cancel-note-editor">Hủy</button>
          <button class="btn btn-primary" id="btn-save-note-editor">Lưu ghi chú</button>
        </div>
      </div>
    `;

    wrapper.querySelector('#btn-close-note-editor').onclick = () => { wrapper.style.display = 'none'; };
    wrapper.querySelector('#btn-cancel-note-editor').onclick = () => { wrapper.style.display = 'none'; };

    wrapper.querySelector('#btn-save-note-editor').onclick = async () => {
      const title = wrapper.querySelector('#editor-note-title').value.trim();
      const date = wrapper.querySelector('#editor-note-date').value;
      const category = wrapper.querySelector('#editor-note-cat').value.trim();
      const content = wrapper.querySelector('#editor-note-content').value;

      if (!title) {
        toast.warning('Vui lòng nhập tiêu đề ghi chú');
        return;
      }

      try {
        if (note && note.id) {
          await noteService.updateNote({ ...note, title, date, category, content });
          toast.success('Đã cập nhật ghi chú');
        } else {
          await noteService.createNote({ title, date, category, content, isPinned: false });
          toast.success('Đã tạo ghi chú mới');
        }
        wrapper.style.display = 'none';
        const fresh = await noteService.getAllNotes();
        this._renderNotesGrid(fresh);
      } catch (err) {
        toast.error(err.message || 'Lỗi khi lưu ghi chú');
      }
    };
  }

  _attachMultipleNotesEvents(initialNotes) {
    const addBtn = this.element.querySelector('#btn-add-multi-note');
    addBtn.onclick = () => this._openNoteEditor(null);

    const searchInput = this.element.querySelector('#multi-search');
    searchInput.oninput = debounce(async (e) => {
      const q = e.target.value.toLowerCase().trim();
      const all = await noteService.getAllNotes();
      const filtered = all.filter(n => (n.title && n.title.toLowerCase().includes(q)) || (n.content && n.content.toLowerCase().includes(q)));
      this._renderNotesGrid(filtered);
    }, 200);
  }
}
