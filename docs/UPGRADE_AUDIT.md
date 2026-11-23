# 📋 UPGRADE AUDIT REPORT: PERSONAL WORK JOURNAL 2.0
> **Tài liệu kiểm toán toàn diện mã nguồn, nhánh Git, cơ sở dữ liệu và bảo mật**  
> **Dự án:** Personal Work Journal  
> **Phiên bản hiện tại:** 1.0.0 | **Mục tiêu nâng cấp:** 2.0.0  
> **Nhánh phát triển & kiểm toán:** `master` (Đồng bộ với production workflow)  
> **Thời điểm kiểm toán:** 23/11/2026 (Cập nhật hoàn thiện sau rà soát cuối cùng)

---

## I. KIỂM TOÁN HỆ THỐNG NHÁNH VÀ GIT REPOSITORY

### 1. Hiện trạng Git Remote & Local
- **Repository Remote:** `https://github.com/AhNguyeen/Personal-Work-Journal.git`
- **Remote HEAD:** Trỏ vào `origin/master`.
- **Nhánh `master`:** Nhánh bắt buộc thực hiện kiểm toán và lưu trữ toàn bộ các tài liệu đặc tả kiến trúc.
- **Nhánh `main`:** Nhánh triển khai GitHub Pages (`https://ahnguyeen.github.io/Personal-Work-Journal/`).
- **Nguyên tắc an toàn:**
  - Tuyệt đối không tự ý sửa đổi source code trong quá trình hoàn thiện tài liệu.
  - Không thay đổi cấu trúc dữ liệu IndexedDB thực tế trên trình duyệt.
  - Không deploy lên môi trường production khi chưa có phê duyệt chính thức.
  - Không chuyển nội dung sang `main` trong phiên làm việc này.
  - Không force push, không xóa nhánh, bảo toàn toàn vẹn lịch sử Git.

---

## II. ĐÁNH GIÁ KIẾN TRÚC HIỆN TẠI (ARCHITECTURE AUDIT)

### 1. Tầng lưu trữ (IndexedDB & DatabaseService)
- **Database hiện tại:** `PersonalWorkJournalDB` (Version 1).
- **6 Object Stores hiện tại của V1:**
  1. `activities` (keyPath: `id`, indexes: `date`, `category`, `status`, `stars`, `createdAt`).
  2. `dailyNotes` (keyPath: `id`, indexes: `date` [unique], `createdAt`).
  3. `notes` (keyPath: `id`, indexes: `date`, `category`, `isPinned`, `createdAt`).
  4. `goals` (keyPath: `id`, indexes: `category`, `period`, `status`, `createdAt`).
  5. `timerSessions` (keyPath: `id`, indexes: `activityId`, `status`, `startTime`, `createdAt`).
  6. `settings` (keyPath: `key`).
- **Mở rộng lên 10 Object Stores trong V2:**
  - Bổ sung 4 Object Stores mới:
    7. `projects` (keyPath: `id`, indexes: `status`, `category`, `createdAt`).
    8. `recurrenceRules` (keyPath: `id`, indexes: `recurrenceType`, `startDate`, `createdAt`).
    9. `recurrenceOccurrences` (keyPath: `occurrenceId`, indexes: `recurrenceRuleId`, `originalDate`, `generatedActivityId`, `isOverridden`, `isCancelled`, `createdAt`). *Lưu ý tối ưu: Không tạo index `occurrenceId` vì trường này đã là `keyPath` mang ràng buộc duy nhất.*
    10. `projectJournalEntries` (keyPath: `id`, indexes: `projectId`, `date`, `createdAt`).
- **Các lỗ hổng & rủi ro phát hiện trong V1 (P0/P1):**
  - **Lỗi bẫy Promise trong `initDatabase()`:** Thuộc tính `this._initPromise` lưu giữ Promise kết nối. Nếu kết nối bị lỗi hoặc bị abort một lần, `this._initPromise` bị giữ ở trạng thái rejected vĩnh viễn, ngăn cản các lần thử kết nối lại của người dùng. Cần reset `this._initPromise = null` trong khối `.catch()`.
  - **Thiếu lắng nghe sự kiện `onblocked` và `onclose`:** Khi mở nhiều tab hoặc trong quá trình nâng cấp version, thiếu handler `onblocked` có thể khiến kết nối bị treo.
  - **Rủi ro mất dữ liệu trong `importData()` (Replace Mode):**
    - Trong chế độ `replace`, các store hiện bị `clearStore()` theo các transaction rời rạc trước khi import. Nếu xảy ra lỗi giữa chừng, dữ liệu cũ đã bị xóa dở dang mà không thể khôi phục tự động.
    - **Yêu cầu kiểm toán:** Toàn bộ thao tác `clear` và `import` của **CẢ 10 OBJECT STORES** bắt buộc phải nằm trong **CÙNG MỘT TRANSACTION READWRITE DUY NHẤT**.
    - **Rủi ro Auto-Commit do Async Gap:** Nếu có thao tác bất đồng bộ (`await`, `setTimeout`) trong transaction, transaction sẽ tự động commit và đóng trước khi ghi xong. Toàn bộ validation và chuẩn bị dữ liệu phải hoàn tất 100% trước khi mở transaction.
    - **Giới hạn của Snapshot trong RAM:** Bản chụp bộ nhớ RAM chỉ là lớp hỗ trợ ở tầng ứng dụng, không thể bảo đảm phục hồi nếu tab trình duyệt bị crash hoặc tiến trình bị tắt đột ngột. Cơ chế rollback cốt lõi phải dựa vào IndexedDB Transaction Rollback.

### 2. Tầng nghiệp vụ & Phân biệt rõ Timer thực tế và Nhập tay (Actual Duration Provenance)
- **Kiểm toán phân loại nguồn thời gian thực tế:**
  1. **`timer_verified` (Ưu tiên 1):** Phải có ít nhất 1 phiên hoàn tất trong `timerSessions` có **`type !== 'manual'`** (tức là được đo bằng đồng hồ Stopwatch hoặc Pomodoro thực tế).
  2. **`manual_verified` (Ưu tiên 2):** Bao gồm:
     - Các phiên hoàn tất trong `timerSessions` có **`type === 'manual'`** (người dùng tự log tay). **Quy định nghiêm ngặt: Phiên `manual` trong `timerSessions` tuyệt đối không được phân loại nhầm thành `timer_verified`.**
     - Hoặc Activity có cờ bằng chứng xác nhận thủ công (`manuallyConfirmed === true`, `manualEntry === true`, `source === 'manual'`).
     - Tuyệt đối không nhận diện chỉ qua điều kiện `actualDurationMinutes !== durationMinutes`.
  3. **`legacy_unverified` (Ưu tiên 3):** Dữ liệu V1 cũ có `actualDurationMinutes > 0` nhưng không rõ bằng chứng nguồn.
     - **Bảo toàn dữ liệu lịch sử:** Đối với Activity V1 trạng thái `Planned` có số phút cũ, bắt buộc giữ nguyên giá trị lịch sử (không xóa, không reset về 0), gán `actualDurationSeconds = actualDurationMinutes * 60` và gắn nhãn `legacy_unverified`.
     - **Tách bạch tính toán:** Dữ liệu `legacy_unverified` **tuyệt đối KHÔNG được tính chung** vào `Verified Actual Time`. Tách riêng thành chỉ số "Thời gian ước tính cũ / Chưa xác minh" (Unverified Legacy Time) trong báo cáo.
  4. **`unperformed` (Ưu tiên 4):** Hoạt động `Planned` và `actualDurationMinutes === 0` (hoặc rỗng), thời gian thực tế = 0.
- **Xử lý hoạt động có cả 2 loại phiên:** Nếu vừa có phiên `timer` vừa có phiên `manual`, gán nhãn chính `timer_verified` nhưng lưu metadata bóc tách chi tiết `timerSeconds` và `manualSeconds` để báo cáo nguồn minh bạch.

### 3. Kiểm toán Lịch lặp lại & Xử lý `ConstraintError` khi hai tab cùng tạo Occurrence
- **Scope giao dịch nguyên tử:** Việc kiểm tra và tạo Occurrence cùng Activity bắt buộc phải thực hiện trong một transaction `readwrite` bao gồm cả `recurrenceOccurrences` và `activities`.
- **Vấn đề kỹ thuật với `ConstraintError`:**
  - Khi dùng `occStore.add()`, nếu khóa `occurrenceId` đã tồn tại (do tab khác vừa tạo), request sẽ ném lỗi `ConstraintError`.
  - Mặc định, lỗi này sẽ nổi bọt và **khiến transaction tự động bị abort**. Khi transaction đã abort thì không thể tiếp tục dùng chính transaction đó để đọc dữ liệu.
- **Giải pháp kiểm toán chuẩn mực:**
  - **Phương án 1 (Chính thức):** Bắt sự kiện `onerror` tại request `add()`, gọi `event.preventDefault()` và `event.stopPropagation()` để ngăn lỗi nổi bọt lên transaction, sau đó đọc lại bản ghi bằng `occStore.get(occurrenceId)` ngay trong transaction còn sống.
  - **Phương án 2 (Dự phòng):** Nếu transaction đã abort, lắng nghe `tx.onabort` hoặc catch error, mở một transaction `readonly` mới để đọc lại bản ghi `occurrenceId` đã tồn tại và lấy `generatedActivityId` tương ứng.
  - Cả hai cách đều bảo đảm **tuyệt đối không tạo Activity trùng lặp giữa hai tab**.
- **Quy tắc Edit Single Occurrence:**
  - Giữ nguyên `recurrenceRuleId`, `originalDate`, `generatedActivityId` trong `recurrenceOccurrences` và cập nhật `isOverridden = true`.
  - Activity cập nhật thông tin riêng, giữ nguyên liên kết `recurrenceRuleId`, `occurrenceId` và đánh dấu `isOccurrenceOverridden: true`.

### 4. Kiểm toán Bảo mật (Security & XSS Audit)
- **`src/app.js` (Global Search):**
  - Kết quả tìm kiếm hiện nối chuỗi trực tiếp vào `innerHTML` mà chưa escape HTML.
  - Bắt buộc áp dụng `escapeHTML()` cho toàn bộ các trường hiển thị (`title`, `description`, `content`) để ngăn ngừa tấn công XSS.

---

## III. BẢNG TỔNG HỢP VẤN ĐỀ VÀ MỨC ĐỘ ƯU TIÊN

| Mã | Hạng mục | Mô tả vấn đề | Mức độ | Kế hoạch xử lý |
| :--- | :--- | :--- | :---: | :--- |
| **SEC-01** | Global Search | XSS qua nội dung tìm kiếm chưa escape HTML | **P0 - Critical** | Áp dụng `escapeHTML` cho tất cả thuộc tính hiển thị |
| **DATA-01** | IndexedDB | `_initPromise` bị kẹt khi lỗi, thiếu `onblocked`/`onclose` | **P0 - Critical** | Reset promise trong `.catch()`, thêm handler `onblocked` |
| **DATA-02** | Activity Service | `actualDurationMinutes` tự gán bằng `durationMinutes` | **P0 - Critical** | Chuẩn hóa `actualDurationSeconds` và phân loại 4 nguồn dữ liệu |
| **DATA-03** | Actual Provenance | Phân loại nhầm phiên `manual` trong `timerSessions` thành timer | **P0 - Critical** | Phân biệt `type !== 'manual'`, bảo toàn lịch sử Planned cũ |
| **DATA-04** | Backup/Restore | Nguy cơ mất dữ liệu do chia nhỏ transaction & async gap | **P1 - High** | Validate trước, 1 transaction readwrite qua 10 stores, không async gap |
| **DATA-05** | Recurrence Store | Lỗi `ConstraintError` gây abort transaction khi 2 tab tạo occurrence | **P1 - High** | Xử lý `preventDefault()` hoặc mở transaction mới, transaction kép occ + act |
| **FEAT-01** | Recurrence Rules | Chưa có quy tắc lịch lặp lại (daily, weekly, custom) | **P1 - High** | Thêm Object Store `recurrenceRules` và mô hình quan hệ nguồn bền vững |
| **FEAT-02** | Project Journal | Chưa có hồ sơ dự án và nhật ký tiến độ dự án riêng | **P1 - High** | Thêm Object Store `projects` và `projectJournalEntries` độc lập |
| **FEAT-03** | Advanced Time | Chưa có Focus Mode riêng và Pomodoro Timer | **P1 - High** | Nâng cấp `timerService` hỗ trợ Pomodoro & Focus Screen |
| **PWA-01** | PWA & Offline | Chưa có Manifest, Service Worker và App Shell cache | **P2 - Medium** | Tạo `manifest.webmanifest`, `sw.js`, tích hợp đăng ký an toàn |
| **UI-01** | Personalization | Chưa có Dark Theme và tùy biến màu sắc/thời gian | **P2 - Medium** | Bổ sung theme switcher và lưu cấu hình vào `settings` |

---

## IV. MA TRẬN PHÂN ĐỊNH 5 TẦNG KIẾN TRÚC TRONG GIAI ĐOẠN 1

| Tầng kiến trúc | Vai trò | Phạm vi triển khai trong Giai đoạn 1 |
| :--- | :--- | :---: |
| **Database Schema** | Tạo 10 Object Stores, cấu hình indexes chuẩn (bỏ index trùng keyPath), cursor migration V1 ➔ V2 an toàn | **HOÀN THÀNH 100% TRONG GĐ 1** |
| **Repository** | Cung cấp CRUD nguyên tử cơ bản cho 10 stores độc lập | **HOÀN THÀNH 100% TRONG GĐ 1** |
| **Service Layer** | Business logic: tính occurrence window, pomodoro cycles, project progress | *Thuộc Giai đoạn 2 và 3* |
| **Business Logic** | Điều phối luồng dữ liệu liên service, state toàn cục | *Thuộc Giai đoạn 2 và 3* |
| **UI Components** | Giao diện Timeline, Modal, Widgets, Focus Page, Projects Page | *Thuộc Giai đoạn 2, 3, 4* |

> **Cam kết:** Giai đoạn 1 chỉ bàn giao Tầng Database Schema và Tầng Repository nền tảng cho 10 Object Stores, cùng với việc vá lỗi an ninh và bảo toàn dữ liệu. Không báo cáo tính năng Lịch lặp hoặc Hồ sơ dự án đã hoàn thành khi Tầng Service và Tầng UI chưa hoàn thiện.

---

## V. MA TRẬN TÁC ĐỘNG TỆP CHI TIẾT (CHO TOÀN BỘ DỰ ÁN 2.0)

| Tệp tin | Trạng thái | Tầng kiến trúc | Nội dung tác động |
| :--- | :---: | :---: | :--- |
| `src/database/db.js` | Chỉnh sửa | Database Schema | Nâng `DB_VERSION = 2`, tạo đủ 10 Object Stores, bỏ index thừa keyPath, cursor migration |
| `src/database/databaseService.js` | Chỉnh sửa | Database Core | Sửa `_initPromise`, thêm `onblocked`, hỗ trợ single-transaction replace qua 10 stores không async gap |
| `src/database/repositories/projectRepository.js` | **Tạo mới** | Repository | Repository CRUD cho Object Store `projects` |
| `src/database/repositories/recurrenceRepository.js` | **Tạo mới** | Repository | Repository CRUD cho Object Store `recurrenceRules` |
| `src/database/repositories/recurrenceOccurrenceRepository.js` | **Tạo mới** | Repository | Repository CRUD cho Object Store `recurrenceOccurrences` |
| `src/database/repositories/projectJournalRepository.js` | **Tạo mới** | Repository | Repository CRUD cho Object Store `projectJournalEntries` |
| `src/services/activityService.js` | Chỉnh sửa | Service | Chuẩn hóa `actualDurationSeconds`, liên kết `projectId` & `recurrenceRuleId`, bóc tách timer vs manual |
| `src/services/timerService.js` | Chỉnh sửa | Service | Hỗ trợ chu trình Pomodoro & liên kết dự án `projectId` |
| `src/services/projectService.js` | **Tạo mới** | Service | Nghiệp vụ dự án, tính tổng thời gian, tiến độ và nhật ký dự án |
| `src/services/recurrenceService.js` | **Tạo mới** | Service | Tính toán và quản lý các lần xuất hiện theo transaction kép và xử lý `ConstraintError` bằng preventDefault/fallback |
| `src/services/backupService.js` | Chỉnh sửa | Service | Hỗ trợ đầy đủ 10 Object Stores vào file backup JSON, thẩm định schema sâu và atomic replace |
| `src/pages/Projects/ProjectsPage.js` | **Tạo mới** | UI | Màn hình quản lý dự án, Project Timeline và Project Journal Entries |
| `src/pages/Focus/FocusPage.js` | **Tạo mới** | UI | Màn hình Focus Mode & Pomodoro tối giản |
| `src/app.js` | Chỉnh sửa | UI & Security | Vá XSS Search, đăng ký routes `projects`, `focusMode` |
| `src/components/Sidebar.js` | Chỉnh sửa | UI | Thêm mục `Projects` và `Focus Mode` |
| `public/manifest.webmanifest` | **Tạo mới** | PWA | Web App Manifest cấu hình chuẩn GitHub Pages |
| `public/sw.js` | **Tạo mới** | PWA | Service Worker quản lý offline cache an toàn |
| `test/test-suite.js` | Chỉnh sửa | Testing | Mở rộng bổ sung 20 kịch bản test migration, provenance, multi-tab và nghiệp vụ V2 |
