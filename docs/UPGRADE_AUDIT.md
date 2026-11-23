# 📋 UPGRADE AUDIT REPORT: PERSONAL WORK JOURNAL 2.0
> **Tài liệu kiểm toán toàn diện mã nguồn, nhánh Git, cơ sở dữ liệu và bảo mật**  
> **Dự án:** Personal Work Journal  
> **Phiên bản hiện tại:** 1.0.0 | **Mục tiêu nâng cấp:** 2.0.0  
> **Thời điểm kiểm toán:** 23/11/2026 (Cập nhật hoàn thiện sau rà soát)

---

## I. KIỂM TOÁN HỆ THỐNG NHÁNH VÀ GIT REPOSITORY

### 1. Hiện trạng Git Remote & Local
- **Repository Remote:** `https://github.com/AhNguyeen/Personal-Work-Journal.git`
- **Remote HEAD:** Trỏ vào `origin/master`.
- **Nhánh `master` trên remote:** Commit `16362bc` (*Merge pull request #1 from AhNguyeen/main*).
- **Nhánh `main` trên remote:** Commit `63a239a` (*fix(deploy): configure canonical base path and restrict deployment trigger to main branch*).
- **So sánh mã nguồn giữa `origin/main` và `origin/master`:**
  - Lệnh `git diff origin/main origin/master` cho kết quả **0 khác biệt** (Cây mã nguồn của hai nhánh hiện tại hoàn toàn đồng nhất 100%).
- **Trạng thái GitHub Pages Deployment:**
  - Nhánh `main`: **Active & Deployment thành công** tại `https://ahnguyeen.github.io/Personal-Work-Journal/`.
  - Nhánh `master`: Từng gặp lỗi deployment trước đây khi GitHub Actions cố gắng deploy vào environment `github-pages` nhưng bị giới hạn bởi quyền hạn nhánh môi trường.

### 2. Đề xuất quy chuẩn nhánh chính thức
- **Nhánh chính thức phát triển và triển khai:** **`main`**.
  - Lý do: GitHub Pages Environment trên repo đã cấu hình gán quyền trực tiếp cho nhánh `main`. Workflow [.github/workflows/deploy.yml](file:///d:/VS%20Code/Personal-Work-Journal/.github/workflows/deploy.yml) hiện đã chuẩn hóa lắng nghe sự kiện push trên nhánh `main`.
- **Quy trình an toàn cho đợt nâng cấp 2.0:**
  - Tạo nhánh phát triển tính năng riêng: `feature/personal-work-journal-2.0`.
  - Toàn bộ quá trình phát triển, kiểm thử V1->V2 migration và regression test sẽ được thực hiện trên nhánh tính năng.
  - Tuyệt đối không xóa branch, không force push, không ghi đè lịch sử Git.
  - Chỉ tạo PR và merge vào `main` khi toàn bộ 100% test cases đã pass.

---

## II. ĐÁNH GIÁ KIẾN TRÚC HIỆN TẠI (ARCHITECTURE AUDIT)

### 1. Tầng lưu trữ (IndexedDB & DatabaseService)
- **Database:** `PersonalWorkJournalDB` (Version 1).
- **6 Object Stores hiện tại:**
  1. `activities` (keyPath: `id`, indexes: `date`, `category`, `status`, `stars`, `createdAt`).
  2. `dailyNotes` (keyPath: `id`, indexes: `date` [unique], `createdAt`).
  3. `notes` (keyPath: `id`, indexes: `date`, `category`, `isPinned`, `createdAt`).
  4. `goals` (keyPath: `id`, indexes: `category`, `period`, `status`, `createdAt`).
  5. `timerSessions` (keyPath: `id`, indexes: `activityId`, `status`, `startTime`, `createdAt`).
  6. `settings` (keyPath: `key`).
- **Điểm mạnh:**
  - Tập trung mọi thao tác qua `databaseService.js` và `repositories/`.
  - Không có mã truy vấn IndexedDB phân tán trong UI components.
  - Sử dụng transaction hoàn chỉnh (`readwrite` / `readonly`).
- **Vấn đề phát hiện (P0/P1):**
  - **Lỗi bẫy Promise trong `initDatabase()`:** Thuộc tính `this._initPromise` lưu giữ Promise kết nối. Nếu kết nối bị lỗi hoặc bị abort một lần, `this._initPromise` bị giữ ở trạng thái rejected vĩnh viễn, ngăn cản các lần thử kết nối lại của người dùng.
  - **Thiếu lắng nghe sự kiện `onblocked` và `onclose`:** Khi mở nhiều tab hoặc trong quá trình nâng cấp version, thiếu handler `onblocked` có thể khiến kết nối bị treo.
  - **Cơ chế Transaction trong `importData()` (Replace Mode):** Trong chế độ `replace`, các store hiện bị `clearStore()` theo các transaction rời rạc trước khi import. Nếu xảy ra lỗi giữa chừng, dữ liệu cũ đã bị xóa dở dang mà không thể khôi phục tự động. Bắt buộc phải đưa toàn bộ thao tác `clear` và `import` của 9 stores vào **CÙNG MỘT TRANSACTION READWRITE DUY NHẤT** để đảm bảo rollback tuyệt đối.

### 2. Tầng nghiệp vụ (Service Layer) & Tính toán thời gian
- **`activityService.js`:**
  - **Vấn đề sai lệch Actual Duration:** Khi tạo mới hoạt động, thuộc tính `actualDurationMinutes` đang được gán mặc định bằng `durationMinutes` (thời gian dự kiến):
    ```javascript
    actualDurationMinutes: Number(rawData.actualDurationMinutes) || durationMinutes
    ```
    Điều này làm sai lệch thống kê hiệu suất. Không được mặc định rằng một hoạt động có trạng thái `Completed` thì `actualDurationMinutes` là số liệu thực tế đáng tin cậy.
  - **Giải pháp chuẩn hóa & Bảo toàn dữ liệu cũ:**
    - Phân loại 4 nguồn dữ liệu: `timer_verified` (có Timer Session), `manual_verified` (nhập tay), `legacy_unverified` (dữ liệu V1 cũ sao chép từ dự kiến), `unperformed` (chưa thực hiện).
    - Ưu tiên tính thời gian từ `timerSessions`. Không cộng dồn hai lần giữa Timer và thủ công.
    - Giữ nguyên `actualDurationMinutes` để tương thích ngược, đồng thời bổ sung `actualDurationSeconds` và `actualDurationSource`.
- **`timerService.js`:**
  - Hoạt động ổn định, lưu trữ `startTimestamp` và `accumulatedSeconds` vào `settings` để chống trôi thời gian khi F5/reload.
  - Cần nâng cấp để hỗ trợ chế độ Pomodoro (Focus / Short Break / Long Break) và tích hợp liên kết Dự án (`projectId`).

### 3. Bảo mật (Security & XSS Audit)
- **`src/app.js` (Global Search):**
  - Trong phương thức `_handleGlobalSearch()`, kết quả tìm kiếm được nối trực tiếp vào chuỗi HTML thông qua template literal:
    ```javascript
    <strong style="font-size: 14px;">${a.title}</strong>
    <div style="font-size: 12px;">${a.description || 'Không có mô tả'}</div>
    ...
    <div style="font-size: 12px;">${(n.content || '').substr(0, 80)}...</div>
    ```
  - **Rủi ro XSS:** Nếu người dùng nhập hoặc import dữ liệu có chứa `<img src=x onerror=alert(1)>` hoặc `<script>`, mã độc có thể được thực thi khi hiển thị kết quả tìm kiếm.
  - **Giải pháp:** Bắt buộc áp dụng `escapeHTML()` (đã có trong `src/utils/formatters.js`) cho mọi trường văn bản trước khi đưa vào template hoặc dùng phương thức tạo DOM / `textContent`.

### 4. Giao diện (UI/UX & Routing)
- **Triết lý sản phẩm:** Duy trì tuyệt đối **Daily Schedule Timeline (24h)** và **Daily Journal**. Hoàn toàn không có Kanban Board, không có cột trạng thái kéo thả.
- **Khả năng mở rộng:** Sidebar hiện có 10 mục. Bổ sung `Projects` và `Focus Mode` hài hòa, không tạo menu lồng nhau phức tạp.
- **Chủ đề hiển thị:** Hiện mới chỉ có Light Theme; cần bổ sung Dark Theme và System Theme theo chuẩn CSS Custom Properties hiện có.

### 5. Khả năng hỗ trợ PWA & Offline
- Chưa có Web App Manifest (`manifest.webmanifest`).
- Chưa có Service Worker (`sw.js`) để cache App Shell khi mất mạng.
- Cần đảm bảo `start_url` và `scope` trong manifest khớp chính xác với subpath `/Personal-Work-Journal/`.

---

## III. BẢNG TỔNG HỢP VẤN ĐỀ VÀ MỨC ĐỘ ƯU TIÊN

| Mã | Hạng mục | Mô tả vấn đề | Mức độ | Kế hoạch xử lý |
| :--- | :--- | :--- | :---: | :--- |
| **SEC-01** | Global Search | XSS qua nội dung tìm kiếm chưa escape HTML | **P0 - Critical** | Áp dụng `escapeHTML` cho tất cả thuộc tính hiển thị |
| **DATA-01** | IndexedDB | `_initPromise` bị kẹt khi lỗi, thiếu `onblocked`/`onclose` | **P0 - Critical** | Reset promise trong `.catch()`, thêm handler `onblocked` |
| **DATA-02** | Activity Service | `actualDurationMinutes` tự gán bằng `durationMinutes` | **P0 - Critical** | Chuẩn hóa `actualDurationSeconds` và phân loại 4 nguồn dữ liệu |
| **DATA-03** | Backup/Restore | Import thiếu validation schema từng store & atomic transaction | **P1 - High** | Validate cấu trúc sâu trước khi ghi, chạy trong 1 transaction duy nhất |
| **FEAT-01** | Recurrence | Chưa có lịch lặp lại (hằng ngày, theo thứ, tháng) | **P1 - High** | Thêm Object Store `recurrenceRules`, mô hình `ScheduleOccurrence` định danh |
| **FEAT-02** | Project Journal | Chưa có hồ sơ dự án và nhật ký dự án riêng biệt | **P1 - High** | Thêm Object Store `projects` và `projectJournalEntries` |
| **FEAT-03** | Advanced Time | Chưa có Focus Mode riêng và Pomodoro Timer | **P1 - High** | Nâng cấp `timerService` hỗ trợ Pomodoro & Focus Screen |
| **PWA-01** | PWA & Offline | Chưa có Manifest, Service Worker và App Shell cache | **P2 - Medium** | Tạo `manifest.webmanifest`, `sw.js`, tích hợp đăng ký an toàn |
| **UI-01** | Personalization | Chưa có Dark Theme và tùy biến màu sắc/thời gian | **P2 - Medium** | Bổ sung theme switcher và lưu cấu hình vào `settings` |

---

## IV. MA TRẬN TÁC ĐỘNG TỆP (IMPACT ANALYSIS CHO V2)

| Tệp tin | Trạng thái | Nội dung tác động |
| :--- | :---: | :--- |
| `src/database/db.js` | Chỉnh sửa | Nâng `DB_VERSION = 2`, tạo store `projects`, `recurrenceRules`, `projectJournalEntries`, thêm indexes |
| `src/database/databaseService.js` | Chỉnh sửa | Sửa `_initPromise`, thêm `onblocked`, hỗ trợ single-transaction replace |
| `src/database/repositories/projectRepository.js` | **Tạo mới** | Repository quản lý Project CRUD |
| `src/database/repositories/projectJournalRepository.js` | **Tạo mới** | Repository quản lý Project Journal Entries CRUD |
| `src/database/repositories/recurrenceRepository.js` | **Tạo mới** | Repository quản lý Recurrence Rules |
| `src/services/activityService.js` | Chỉnh sửa | Chuẩn hóa `actualDurationSeconds`, liên kết `projectId` & `recurrenceRuleId` |
| `src/services/timerService.js` | Chỉnh sửa | Tích hợp chu trình Pomodoro (Focus/Break) & gắn `projectId` |
| `src/services/projectService.js` | **Tạo mới** | Nghiệp vụ dự án, tính tổng thời gian, tiến độ và nhật ký dự án |
| `src/services/recurrenceService.js` | **Tạo mới** | Tính toán các lần xuất hiện của lịch lặp theo mô hình Occurrence |
| `src/services/backupService.js` | Chỉnh sửa | Hỗ trợ 9 stores vào backup, thẩm định schema sâu và snapshot rollback |
| `src/pages/Projects/ProjectsPage.js` | **Tạo mới** | Màn hình quản lý dự án, Project Timeline và Project Journal Entries |
| `src/pages/Focus/FocusPage.js` | **Tạo mới** | Màn hình Focus Mode & Pomodoro tối giản |
| `src/app.js` | Chỉnh sửa | Vá XSS Search, đăng ký routes `projects`, `focusMode` |
| `src/components/Sidebar.js` | Chỉnh sửa | Thêm mục `Projects` và `Focus Mode` |
| `public/manifest.webmanifest` | **Tạo mới** | Web App Manifest cấu hình chuẩn GitHub Pages |
| `public/sw.js` | **Tạo mới** | Service Worker quản lý offline cache an toàn |
| `test/test-suite.js` | Chỉnh sửa | Mở rộng bổ sung 12 kịch bản test migration và nghiệp vụ V2 |
