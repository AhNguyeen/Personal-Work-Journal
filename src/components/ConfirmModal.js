/**
 * ConfirmModal.js - Reusable confirmation modal for delete and critical actions
 */

class ConfirmModal {
  constructor() {
    this.backdrop = null;
    this._resolve = null;
  }

  _ensureDOM() {
    if (this.backdrop) return;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.id = 'confirm-modal-backdrop';
    this.backdrop.innerHTML = `
      <div class="modal-dialog" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title" id="confirm-modal-title">Xác nhận</h3>
          <button class="btn btn-ghost btn-icon" id="confirm-modal-close" style="font-size: 18px;">&times;</button>
        </div>
        <div class="modal-body" id="confirm-modal-body" style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
          Bạn có chắc chắn muốn thực hiện hành động này?
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="confirm-modal-cancel">Hủy bỏ</button>
          <button class="btn btn-danger" id="confirm-modal-ok">Đồng ý</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.backdrop);

    const close = () => {
      this.backdrop.classList.remove('open');
      if (this._resolve) this._resolve(false);
    };

    this.backdrop.querySelector('#confirm-modal-close').onclick = close;
    this.backdrop.querySelector('#confirm-modal-cancel').onclick = close;
    this.backdrop.onclick = (e) => {
      if (e.target === this.backdrop) close();
    };

    this.backdrop.querySelector('#confirm-modal-ok').onclick = () => {
      this.backdrop.classList.remove('open');
      if (this._resolve) this._resolve(true);
    };
  }

  /**
   * Show confirmation dialog
   * @param {Object} options { title, message, okText, isDanger }
   * @returns {Promise<boolean>}
   */
  ask({ title = 'Xác nhận xóa', message = 'Hành động này không thể hoàn tác.', okText = 'Xóa dữ liệu', isDanger = true } = {}) {
    this._ensureDOM();

    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-body').textContent = message;
    const okBtn = document.getElementById('confirm-modal-ok');
    okBtn.textContent = okText;
    okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

    this.backdrop.classList.add('open');

    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }
}

export const confirmModal = new ConfirmModal();
