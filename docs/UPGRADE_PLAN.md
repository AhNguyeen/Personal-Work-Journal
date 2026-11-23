# 🗺️ UPGRADE PLAN: PERSONAL WORK JOURNAL 2.0
> **Kế hoạch triển khai kiến trúc 5 giai đoạn chi tiết**  
> **Nguyên tắc xuyên suốt:** Bảo toàn dữ liệu 100%, không dùng Kanban Board, Offline-first, kiểm thử nghiêm ngặt trước khi bàn giao.  
> **Nhánh phát triển:** `master` (Đồng bộ chuẩn hóa theo yêu cầu dự án)

---

## GIAI ĐOẠN 1: CORE & DATA INTEGRITY (NỀN TẢNG VÀ TOÀN VẸN DỮ LIỆU)

> [!IMPORTANT]
> **Quy định rành mạch về phạm vi Giai đoạn 1:**
> Giai đoạn 1 CHỈ tạo cấu trúc Database cần thiết (Database Schema và Repositories cơ bản), vá lỗi an ninh và bảo toàn toàn vẹn dữ liệu.
> **TUYỆT ĐỐI KHÔNG BÁO CÁO** tính năng Recurring Schedule (Lịch lặp) hoặc Project Journal (Nhật ký dự án) đã hoàn thành chỉ vì các Object Store tương ứng đã được khởi tạo trong database!
> Mọi logic tính toán chuỗi lặp, giao diện hiển thị lịch lặp thuộc về **Giai đoạn 2**. Mọi màn hình quản lý dự án và nhật ký tiến độ dự án thuộc về **Giai đoạn 3**.

### 1. Nâng cấp IndexedDB Schema (DB_VERSION = 2)
- **Mục tiêu:** Mở rộng từ 6 stores lên **10 Object Stores** mà không làm mất hay thay đổi bất kỳ bản ghi nào trong 6 Object Store hiện có.
- **Thực hiện trong `src/database/db.js`:**
  - Nâng `DB_VERSION` từ `1` lên `2`.
  - Khởi tạo 4 Object Stores mới (nếu chưa tồn tại):
    1. `projects` (keyPath: `id`, indexes: `status`, `category`, `createdAt`).
    2. `recurrenceRules` (keyPath: `id`, indexes: `recurrenceType`, `startDate`, `createdAt`).
    3. `recurrenceOccurrences` (keyPath: `occurrenceId`, indexes: `occurrenceId` [unique], `recurrenceRuleId`, `originalDate`, `generatedActivityId`, `isOverridden`, `isCancelled`, `createdAt`).
    4. `projectJournalEntries` (keyPath: `id`, indexes: `projectId`, `date`, `createdAt`).
  - Bổ sung indexes mở rộng vào các Object Stores cũ:
    - `activities`: thêm index `projectId`, `recurrenceRuleId`.
    - `notes`: thêm index `projectId`.
    - `timerSessions`: thêm index `projectId`, `type`.

### 2. Xây dựng tầng Repositories cơ bản (Data Access Layer)
- Xây dựng các hàm CRUD nguyên tử độc lập (chỉ làm việc trực tiếp với IndexedDB, không chứa business logic phức tạp):
  - `src/database/repositories/projectRepository.js`
  - `src/database/repositories/recurrenceRepository.js`
  - `src/database/repositories/recurrenceOccurrenceRepository.js`
  - `src/database/repositories/projectJournalRepository.js`

### 3. Chuẩn hóa Nguồn gốc Thời gian Thực tế (Actual Duration Provenance)
- **Quy tắc phân loại nghiêm ngặt 4 nguồn gốc:**
  - `timer_verified`: Có phiên bấm giờ thực tế trong `timerSessions`.
  - `manual_verified`: **Chỉ khi có bằng chứng người dùng chủ động nhập hoặc xác nhận thủ công** (có cờ `manuallyConfirmed === true`, `manualEntry === true`, `source === 'manual'`, hoặc phiên `type === 'manual'`). Tuyệt đối không nhận diện chỉ qua điều kiện `actualDurationMinutes !== durationMinutes`.
  - `legacy_unverified`: Dữ liệu V1 cũ kế thừa không có bằng chứng nguồn. Giữ nguyên toàn bộ giá trị cũ để bảo toàn dữ liệu.
  - `unperformed`: Hoạt động `Planned` chưa thực hiện (`actualDurationSeconds = 0`).
- **Quy tắc tách bạch tính toán:** Dữ liệu `legacy_unverified` tuyệt đối KHÔNG được tính chung vào tổng thời gian thực tế đã xác minh (**Verified Actual Time**). Phân tách rõ ràng thành hai chỉ số riêng biệt trong hệ thống báo cáo.
- **Bảo toàn tương thích ngược:** Duy trì trường `actualDurationMinutes` song song với `actualDurationSeconds`. Tuyệt đối không cộng trùng giữa Timer Sessions và thời gian nhập tay.

### 4. Nâng cấp DatabaseService & Cơ chế Atomic Replace Transaction trên 10 Stores
- Xử lý reset `this._initPromise = null` khi `openDatabase()` gặp lỗi trong khối `.catch()`, cho phép kết nối lại an toàn.
- Bổ sung handlers `onblocked` và `onclose` để xử lý xung đột khi mở nhiều tab.
- **Cơ chế Replace trong 1 Transaction duy nhất:**
  - Thẩm định sâu cấu trúc từng store (Deep Schema Validation) trước khi thực hiện ghi.
  - Tạo bản sao lưu tạm thời (In-Memory Snapshot Backup) trước khi xóa.
  - Mở duy nhất **1 Transaction readwrite qua CẢ 10 OBJECT STORES**: thực hiện `clear()` và `put()` dữ liệu trong cùng một phiên giao dịch.
  - Nếu xảy ra lỗi giữa chừng, IndexedDB engine tự động **rollback** toàn bộ thay đổi, giữ nguyên dữ liệu cũ 100%.

### 5. Vá lỗ hổng bảo mật XSS trong Global Search
- Bọc toàn bộ các trường người dùng nhập (`title`, `description`, `content`) qua hàm `escapeHTML()` trước khi đưa vào template hiển thị kết quả tìm kiếm trong `src/app.js`.

---

## GIAI ĐOẠN 2: ADVANCED TIME MANAGEMENT (QUẢN LÝ THỜI GIAN NÂNG CAO)

### 1. Recurring Schedule & Lưu trữ Bền vững các Lần Lặp (Occurrence Model)
- **Cơ chế chống tạo trùng bền vững sau reload và đa tab:**
  - Không dựa vào In-Memory cache/set.
  - Sử dụng Object Store `recurrenceOccurrences` với `keyPath: 'occurrenceId'` và unique index.
  - Mỗi khi sinh lịch cho ngày `D`, kiểm tra sự tồn tại của `occurrenceId` trực tiếp trong IndexedDB. Ràng buộc khóa duy nhất của IndexedDB loại bỏ triệt để nguy cơ tạo trùng giữa 2 tab mở đồng thời hoặc sau khi reload.
- **Quy tắc Edit Single Occurrence (Bảo toàn quan hệ nguồn):**
  - Khi người dùng chỉnh sửa riêng một lần lặp:
    - Activity tương ứng được cập nhật thông tin riêng.
    - Bản ghi `recurrenceOccurrences` cập nhật `isOverridden = true`, nhưng **GIỮ NGUYÊN `recurrenceRuleId`** và `originalDate`.
    - Activity trong `activities` vẫn lưu liên kết `recurrenceRuleId` kèm cờ `isOccurrenceOverridden: true`.
    - Bảo toàn quan hệ nguồn: Instance này vẫn thuộc chuỗi lặp gốc nhưng được bảo vệ không bị ghi đè khi sửa đổi toàn bộ chuỗi.
- **Thao tác khác:** Bỏ qua ngày (`isCancelled = true`), sửa toàn bộ chuỗi (`activityTemplate`), xóa chuỗi lặp (xóa tương lai, giữ lịch sử quá khứ).

### 2. So sánh Kế hoạch vs Thực tế (Planned vs Actual)
- Hiển thị thời gian dự kiến (`durationMinutes`), thời gian thực tế (`actualDurationSeconds`), nguồn dữ liệu (`actualDurationSource`) và độ chênh lệch (+/- phút).
- Thống kê đối chiếu: Phân tách rõ ràng giữa `Verified Actual Time` và `Unverified Legacy Time`.

### 3. Focus Mode & Pomodoro Timer
- **Focus Mode:** Màn hình tập trung tối giản, hiển thị mục tiêu phiên làm việc và đồng hồ bấm giờ trực quan.
- **Pomodoro Timer:**
  - Chu trình: 25 phút Focus ➔ 5 phút Short Break ➔ 25 phút Focus ➔ ... ➔ 15 phút Long Break.
  - Tích hợp dùng chung `timerService` duy nhất (không tạo timer thứ hai chạy ngầm).
  - Không cộng thời gian nghỉ ngơi vào thời gian làm việc thực tế. Lưu trữ trạng thái vào IndexedDB, khôi phục sau reload.

---

## GIAI ĐOẠN 3: PROJECT JOURNAL (HỒ SƠ VÀ NHẬT KÝ DỰ ÁN)

### 1. Quản lý Dự án (Project Management)
- Thêm thực thể `Project` với màu sắc, icon, mục tiêu, ngày bắt đầu, ngày dự kiến hoàn thành và trạng thái (`Active`, `On Hold`, `Completed`, `Archived`).
- Menu mới trên Sidebar: **Projects**.
- **Tuyệt đối không sử dụng Kanban:** Quản lý theo danh sách hồ sơ và Timeline dự án.

### 2. Object Store riêng biệt: `projectJournalEntries`
- Lưu trữ các bài viết nhật ký tiến độ dự án độc lập, không nhân bản hay làm lẫn lộn với `notes` và `dailyNotes`.
- Hỗ trợ trường `linkedActivityIds` để gắn các hoạt động trong Timeline vào bài viết nhật ký.

### 3. Liên kết Hoạt động & Xử lý an toàn khi xóa Dự án
- Bổ sung dropdown chọn dự án trong `ActivityModal.js`.
- **Quy tắc an toàn khi xóa dự án:**
  - Cảnh báo người dùng về số lượng hoạt động và bài viết nhật ký liên quan.
  - Cung cấp tùy chọn: "Hủy liên kết dự án nhưng giữ lại hoạt động" hoặc "Lưu trữ dự án (Archive) thay vì xóa".
  - Tuyệt đối không xóa âm thầm các hoạt động hay phiên bấm giờ liên quan.

---

## GIAI ĐOẠN 4: PWA, OFFLINE & CÁ NHÂN HÓA

### 1. Progressive Web App (PWA)
- **Manifest:** Tạo `public/manifest.webmanifest` với `start_url: "/Personal-Work-Journal/"`, `scope: "/Personal-Work-Journal/"`, icons chuẩn PWA.
- **Service Worker:** Tạo `public/sw.js` cache App Shell theo chiến lược Cache-First cho assets tĩnh và Network-First cho HTML điều hướng.

### 2. Khả năng hoạt động Offline hoàn hảo
- Khi không có mạng: Mở ứng dụng từ PWA, đọc/ghi IndexedDB bình thường, chạy Timer, xem Timeline và xuất file backup JSON hoàn toàn ngoại tuyến.

### 3. Thông báo thông minh (Smart Reminders)
- Sử dụng Browser Notification API (chỉ yêu cầu quyền khi người dùng chủ động bật trong Settings). Nhắc trước khi hoạt động bắt đầu (5 - 15 phút), nhắc mục tiêu ngày và nhắc viết Daily Note.

### 4. Cá nhân hóa (Themes & Preferences)
- Hỗ trợ 3 chế độ giao diện: Light Theme, Dark Theme, System Theme. Lưu cấu hình vào store `settings`.

---

## GIAI ĐOẠN 5: TÍCH HỢP, KIỂM THỬ HỒI QUY VÀ ĐÓNG GÓI

### 1. Cập nhật Điều hướng & UI
- Tích hợp menu `Projects` và `Focus Mode` vào Sidebar.
- Mở rộng Dashboard widgets: Dự án đang hoạt động, Thời gian tập trung hôm nay, So sánh Planned vs Actual, Phân bổ thời gian theo dự án.

### 2. Mở rộng Export & Backup
- File Backup JSON chứa đầy đủ **10 Object Stores** và thông tin phiên bản 2.0.0.
- Bổ sung xuất báo cáo tiến độ dự án ra file CSV và bản in / PDF.

### 3. Bộ kiểm thử hồi quy toàn diện (Regression Testing Suite)
- Chạy lại toàn bộ 18 test cases của Version 1.0.
- Thực thi bộ 18 test cases chuyên sâu cho Migration, Data Provenance và V2:
  1. Migration từ Database V1 rỗng lên V2 (đủ 10 stores).
  2. Migration từ Database V1 có đầy đủ 6 stores cũ (bảo toàn 100% record count).
  3. Xử lý Activity Planned không có timer (`actualDurationSeconds = 0`).
  4. Xử lý Activity Completed có timerSessions (`timer_verified`).
  5. Xử lý Activity có bằng chứng nhập thủ công tường minh (`manual_verified`).
  6. Xử lý dữ liệu cũ không có bằng chứng (`legacy_unverified` giữ nguyên không xóa).
  7. Dữ liệu `legacy_unverified` KHÔNG bị cộng vào `Verified Actual Time`.
  8. Không cộng trùng Timer Sessions và Manual tracking.
  9. Xử lý lỗi rollback trong quá trình nâng cấp store.
  10. Xử lý sự kiện `onversionchange` và `onblocked` khi mở nhiều tab.
  11. Chống tạo trùng Occurrence sau Reload trang (IndexedDB persistence).
  12. Chống tạo trùng Occurrence giữa hai tab cùng ghi đồng thời (unique index).
  13. Edit Single Occurrence vẫn giữ được quan hệ nguồn (`recurrenceRuleId`, `originalDate`, `isOverridden = true`).
  14. Tạo Project và liên kết Activity qua index `projectId`.
  15. Tạo Project Journal Entry độc lập trong `projectJournalEntries`.
  16. Xóa Project cảnh báo an toàn, không xóa mồ côi activities liên quan.
  17. Thẩm định quy trình Replace Backup trong 1 transaction duy nhất qua cả 10 Object Stores.
  18. Export Backup JSON chứa đầy đủ 10 Object Stores phiên bản 2.0.0.
- Chạy `npm run build` xác nhận hoàn thành đóng gói production với 0 lỗi.
