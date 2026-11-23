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
- **Nhánh `master`:** Chứa commit cập nhật tài liệu chuẩn hóa và đồng bộ với remote.
- **Nhánh `main`:** Nhánh đã cấu hình kết nối trực tiếp với GitHub Pages environment (`https://ahnguyeen.github.io/Personal-Work-Journal/`).
- **So sánh mã nguồn giữa `main` và `master`:**
  - Cây mã nguồn cốt lõi giữa hai nhánh đồng nhất.
  - Mọi thao tác chuẩn bị nâng cấp tài liệu được thực hiện trên nhánh `master`.

### 2. Quy trình kiểm toán an toàn tuyệt đối
- **Nguyên tắc bất di bất dịch:**
  - Không tự ý sửa đổi source code trong quá trình hoàn thiện tài liệu.
  - Không thay đổi cấu trúc dữ liệu IndexedDB thực tế trên trình duyệt khi chưa có lệnh chính thức.
  - Không deploy lên môi trường production khi chưa hoàn thành kiểm thử.
  - Giữ nguyên lịch sử Git, không force push, không xóa nhánh.

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
    9. `recurrenceOccurrences` (keyPath: `occurrenceId`, indexes: `occurrenceId` [unique], `recurrenceRuleId`, `originalDate`, `generatedActivityId`, `isOverridden`, `isCancelled`, `createdAt`).
    10. `projectJournalEntries` (keyPath: `id`, indexes: `projectId`, `date`, `createdAt`).
- **Các lỗ hổng & rủi ro phát hiện trong V1 (P0/P1):**
  - **Lỗi bẫy Promise trong `initDatabase()`:** Thuộc tính `this._initPromise` lưu giữ Promise kết nối. Nếu kết nối bị lỗi hoặc bị abort một lần, `this._initPromise` bị giữ ở trạng thái rejected vĩnh viễn, ngăn cản các lần thử kết nối lại của người dùng. Cần reset `this._initPromise = null` trong khối `.catch()`.
  - **Thiếu lắng nghe sự kiện `onblocked` và `onclose`:** Khi mở nhiều tab hoặc trong quá trình nâng cấp version, thiếu handler `onblocked` có thể khiến kết nối bị treo.
  - **Rủi ro mất dữ liệu trong `importData()` (Replace Mode):** Trong chế độ `replace`, các store hiện bị `clearStore()` theo các transaction rời rạc trước khi import. Nếu xảy ra lỗi giữa chừng, dữ liệu cũ đã bị xóa dở dang mà không thể khôi phục tự động. Bắt buộc phải đưa toàn bộ thao tác `clear` và `import` của **CẢ 10 OBJECT STORES** vào **CÙNG MỘT TRANSACTION READWRITE DUY NHẤT** để đảm bảo rollback tuyệt đối.

### 2. Tầng nghiệp vụ (Service Layer) & Kiểm toán nguồn gốc thời gian (Actual Duration Provenance)
- **`activityService.js`:**
  - **Vấn đề tự gán sai lệch Actual Duration:** Khi tạo mới hoạt động, thuộc tính `actualDurationMinutes` đang được gán mặc định bằng `durationMinutes` (thời gian dự kiến):
    ```javascript
    actualDurationMinutes: Number(rawData.actualDurationMinutes) || durationMinutes
    ```
    Điều này làm sai lệch thống kê hiệu suất nghiêm trọng vì một việc chỉ mới "lên lịch" (`Planned`) đã bị tính như thể đã làm xong đúng số giờ đó.
  - **Rủi ro nhận diện sai `manual_verified`:**
    - Không được xem điều kiện `actualDurationMinutes !== durationMinutes` là bằng chứng người dùng đã xác nhận thủ công.
    - **Yêu cầu kiểm toán nguồn:** Chỉ phân loại `manual_verified` khi có bằng chứng người dùng chủ động nhập hoặc xác nhận dữ liệu thủ công (cờ `manuallyConfirmed === true`, `manualEntry === true`, `source === 'manual'`, hoặc phiên `type === 'manual'` trong `timerSessions`).
    - Nếu không xác định được nguồn thì bắt buộc giữ nhãn `legacy_unverified`.
    - **Tách bạch tính toán:** Dữ liệu `legacy_unverified` tuyệt đối không được tính chung vào tổng thời gian thực tế đã xác minh (**Verified Actual Time**). Phải tách riêng thành "Thời gian ước tính cũ / Chưa xác minh" (Unverified Legacy Time) để bảo toàn tính trung thực của báo cáo hiệu suất.
    - Giữ nguyên số phút/giây cũ để bảo toàn dữ liệu lịch sử, không âm thầm xóa hay làm biến đổi số liệu cũ.

### 3. Kiểm toán Lịch lặp lại & Cơ chế Chống trùng bền vững (Recurring Occurrence Persistence)
- **Rủi ro tạo trùng đa tab và sau khi reload:**
  - Nếu chỉ kiểm tra các lần xuất hiện bằng bộ nhớ tạm (In-Memory Set/Array), khi người dùng F5 hoặc mở 2 tab cùng một lúc, hai luồng độc lập sẽ cùng sinh hoạt động cho cùng một ngày, gây nhân bản dữ liệu rác.
  - **Giải pháp kiểm toán:** Bắt buộc lưu trữ các lần xuất hiện vào Object Store vật lý `recurrenceOccurrences` với `keyPath: 'occurrenceId'` và unique index `occurrenceId`. Sự bền vững của IndexedDB và cơ chế transaction isolation sẽ chặn đứng hoàn toàn việc sinh trùng giữa các tab và sau reload.
- **Quy tắc Edit Single Occurrence:**
  - Khi sửa một lần lặp duy nhất, không được cắt đứt quan hệ với quy tắc nguồn. Bản ghi `recurrenceOccurrences` phải giữ nguyên `recurrenceRuleId` và `originalDate`, đồng thời bật `isOverridden = true`.

### 4. Kiểm toán Bảo mật (Security & XSS Audit)
- **`src/app.js` (Global Search):**
  - Trong phương thức `_handleGlobalSearch()`, kết quả tìm kiếm được nối trực tiếp vào chuỗi HTML thông qua template literal:
    ```javascript
    <strong style="font-size: 14px;">${a.title}</strong>
    <div style="font-size: 12px;">${a.description || 'Không có mô tả'}</div>
    ...
    <div style="font-size: 12px;">${(n.content || '').substr(0, 80)}...</div>
    ```
  - **Rủi ro XSS:** Nếu người dùng nhập hoặc import dữ liệu có chứa `<img src=x onerror=alert(1)>` hoặc `<script>`, mã độc có thể được thực thi khi hiển thị kết quả tìm kiếm.
  - **Giải pháp:** Bắt buộc áp dụng `escapeHTML()` cho mọi trường văn bản trước khi đưa vào template hoặc dùng phương thức tạo DOM / `textContent`.

### 5. Triết lý Sản phẩm & Trải nghiệm UI/UX
- Duy trì tuyệt đối **Daily Schedule Timeline (24h)** và **Daily Reflection Journal**. Hoàn toàn không có Kanban Board, không có cột trạng thái kéo thả To Do / Doing / Done.
- Giao diện nhất quán với các hình ảnh thiết kế chuẩn mực: trục thời gian trực quan, so sánh Planned vs Actual, bộ đếm Pomodoro tối giản, và hồ sơ dự án độc lập.

---

## III. BẢNG TỔNG HỢP VẤN ĐỀ VÀ MỨC ĐỘ ƯU TIÊN

| Mã | Hạng mục | Mô tả vấn đề | Mức độ | Kế hoạch xử lý |
| :--- | :--- | :--- | :---: | :--- |
| **SEC-01** | Global Search | XSS qua nội dung tìm kiếm chưa escape HTML | **P0 - Critical** | Áp dụng `escapeHTML` cho tất cả thuộc tính hiển thị |
| **DATA-01** | IndexedDB | `_initPromise` bị kẹt khi lỗi, thiếu `onblocked`/`onclose` | **P0 - Critical** | Reset promise trong `.catch()`, thêm handler `onblocked` |
| **DATA-02** | Activity Service | `actualDurationMinutes` tự gán bằng `durationMinutes` | **P0 - Critical** | Chuẩn hóa `actualDurationSeconds` và phân loại 4 nguồn dữ liệu |
| **DATA-03** | Actual Provenance | Nhận diện sai `manual_verified` chỉ qua độ lệch thời gian | **P0 - Critical** | Đòi hỏi bằng chứng xác nhận chủ động; tách riêng `legacy_unverified` |
| **DATA-04** | Backup/Restore | Import thiếu validation schema từng store & atomic transaction | **P1 - High** | Validate cấu trúc sâu, chạy 1 transaction duy nhất qua 10 stores |
| **DATA-05** | Recurrence Store | Nguy cơ tạo trùng occurrence sau reload và khi mở nhiều tab | **P1 - High** | Thêm Object Store `recurrenceOccurrences`, unique index, persistence |
| **FEAT-01** | Recurrence Rules | Chưa có quy tắc lịch lặp lại (daily, weekly, custom) | **P1 - High** | Thêm Object Store `recurrenceRules` và mô hình quan hệ nguồn bền vững |
| **FEAT-02** | Project Journal | Chưa có hồ sơ dự án và nhật ký tiến độ dự án riêng | **P1 - High** | Thêm Object Store `projects` và `projectJournalEntries` độc lập |
| **FEAT-03** | Advanced Time | Chưa có Focus Mode riêng và Pomodoro Timer | **P1 - High** | Nâng cấp `timerService` hỗ trợ Pomodoro & Focus Screen |
| **PWA-01** | PWA & Offline | Chưa có Manifest, Service Worker và App Shell cache | **P2 - Medium** | Tạo `manifest.webmanifest`, `sw.js`, tích hợp đăng ký an toàn |
| **UI-01** | Personalization | Chưa có Dark Theme và tùy biến màu sắc/thời gian | **P2 - Medium** | Bổ sung theme switcher và lưu cấu hình vào `settings` |

---

## IV. MA TRẬN PHÂN ĐỊNH 5 TẦNG KIẾN TRÚC TRONG GIAI ĐOẠN 1

Nhằm bảo đảm không nhầm lẫn giữa việc "tạo database store" với việc "tính năng đã hoàn thành", hệ thống quy định phân định tầng kiến trúc minh bạch:

| Tầng kiến trúc | Vai trò | Phạm vi triển khai trong Giai đoạn 1 |
| :--- | :--- | :---: |
| **Database Schema** | Tạo 10 Object Stores, cấu hình indexes, cursor migration V1 ➔ V2 an toàn | **HOÀN THÀNH 100% TRONG GĐ 1** |
| **Repository** | Cung cấp CRUD nguyên tử cơ bản cho 10 stores độc lập | **HOÀN THÀNH 100% TRONG GĐ 1** |
| **Service Layer** | Business logic: tính occurrence window, pomodoro cycles, project progress | *Thuộc Giai đoạn 2 và 3* |
| **Business Logic** | Tích hợp liên service, điều phối luồng dữ liệu, xử lý state toàn cục | *Thuộc Giai đoạn 2 và 3* |
| **UI Components** | Giao diện Timeline, Modal, Widgets, Focus Page, Projects Page | *Thuộc Giai đoạn 2, 3, 4* |

> **Cam kết:** Giai đoạn 1 chỉ bàn giao Tầng Database Schema và Tầng Repository nền tảng cho 10 Object Stores, cùng với việc vá lỗi an ninh và bảo toàn dữ liệu. Không báo cáo tính năng Lịch lặp hoặc Hồ sơ dự án đã hoàn thành khi Tầng Service và Tầng UI chưa hoàn thiện.

---

## V. MA TRẬN TÁC ĐỘNG TỆP CHI TIẾT (CHO TOÀN BỘ DỰ ÁN 2.0)

| Tệp tin | Trạng thái | Tầng kiến trúc | Nội dung tác động |
| :--- | :---: | :---: | :--- |
| `src/database/db.js` | Chỉnh sửa | Database Schema | Nâng `DB_VERSION = 2`, tạo đủ 10 Object Stores, thêm indexes, cursor migration |
| `src/database/databaseService.js` | Chỉnh sửa | Database Core | Sửa `_initPromise`, thêm `onblocked`, hỗ trợ single-transaction replace qua 10 stores |
| `src/database/repositories/projectRepository.js` | **Tạo mới** | Repository | Repository CRUD cho Object Store `projects` |
| `src/database/repositories/recurrenceRepository.js` | **Tạo mới** | Repository | Repository CRUD cho Object Store `recurrenceRules` |
| `src/database/repositories/recurrenceOccurrenceRepository.js` | **Tạo mới** | Repository | Repository CRUD cho Object Store `recurrenceOccurrences` |
| `src/database/repositories/projectJournalRepository.js` | **Tạo mới** | Repository | Repository CRUD cho Object Store `projectJournalEntries` |
| `src/services/activityService.js` | Chỉnh sửa | Service | Chuẩn hóa `actualDurationSeconds`, liên kết `projectId` & `recurrenceRuleId` |
| `src/services/timerService.js` | Chỉnh sửa | Service | Hỗ trợ chu trình Pomodoro & liên kết dự án `projectId` |
| `src/services/projectService.js` | **Tạo mới** | Service | Nghiệp vụ dự án, tính tổng thời gian, tiến độ và nhật ký dự án |
| `src/services/recurrenceService.js` | **Tạo mới** | Service | Tính toán và quản lý các lần xuất hiện của lịch lặp theo mô hình Occurrence bền vững |
| `src/services/backupService.js` | Chỉnh sửa | Service | Hỗ trợ đầy đủ 10 Object Stores vào file backup JSON, thẩm định schema sâu và snapshot rollback |
| `src/pages/Projects/ProjectsPage.js` | **Tạo mới** | UI | Màn hình quản lý dự án, Project Timeline và Project Journal Entries |
| `src/pages/Focus/FocusPage.js` | **Tạo mới** | UI | Màn hình Focus Mode & Pomodoro tối giản |
| `src/app.js` | Chỉnh sửa | UI & Security | Vá XSS Search, đăng ký routes `projects`, `focusMode` |
| `src/components/Sidebar.js` | Chỉnh sửa | UI | Thêm mục `Projects` và `Focus Mode` |
| `public/manifest.webmanifest` | **Tạo mới** | PWA | Web App Manifest cấu hình chuẩn GitHub Pages |
| `public/sw.js` | **Tạo mới** | PWA | Service Worker quản lý offline cache an toàn |
| `test/test-suite.js` | Chỉnh sửa | Testing | Mở rộng bổ sung 18 kịch bản test migration, provenance và nghiệp vụ V2 |
