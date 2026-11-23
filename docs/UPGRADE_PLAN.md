# 🗺️ UPGRADE PLAN: PERSONAL WORK JOURNAL 2.0
> **Kế hoạch triển khai kiến trúc 5 giai đoạn chi tiết**  
> **Nguyên tắc xuyên suốt:** Bảo toàn dữ liệu 100%, không dùng Kanban Board, Offline-first, kiểm thử nghiêm ngặt trước khi bàn giao.

---

## GIAI ĐOẠN 1: CORE & DATA INTEGRITY (NỀN TẢNG VÀ TOÀN VẸN DỮ LIỆU)

### 1. Nâng cấp IndexedDB Schema (DB_VERSION = 2)
- **Mục tiêu:** Mở rộng từ 6 stores lên **9 Object Stores** mà không làm mất hay thay đổi bất kỳ bản ghi nào trong 6 Object Store hiện có.
- **Thực hiện:**
  - Nâng `DB_VERSION` từ `1` lên `2`.
  - Thêm 3 Object Stores mới:
    - `projects` (keyPath: `id`, indexes: `status`, `category`, `createdAt`).
    - `recurrenceRules` (keyPath: `id`, indexes: `recurrenceType`, `startDate`, `createdAt`).
    - `projectJournalEntries` (keyPath: `id`, indexes: `projectId`, `date`, `createdAt`).
  - Bổ sung indexes vào các Object Stores cũ:
    - `activities`: thêm index `projectId`, `recurrenceRuleId`.
    - `notes`: thêm index `projectId`.
    - `timerSessions`: thêm index `projectId`, `type`.

### 2. Chuẩn hóa Planned Duration & Phân loại dữ liệu thực tế
- Không mặc định hoạt động có status `Completed` là có số liệu thực tế đáng tin cậy. Phân loại 4 nguồn dữ liệu:
  - `timer_verified`: Có phiên bấm giờ hợp lệ trong `timerSessions`.
  - `manual_verified`: Do người dùng chủ động ghi nhận thủ công.
  - `legacy_unverified`: Dữ liệu V1 cũ sao chép tự động từ `durationMinutes` (giữ nguyên không xóa, gắn cờ để người dùng phân biệt).
  - `unperformed`: Hoạt động `Planned` chưa thực hiện (`actualDurationSeconds = 0`).
- Bảo toàn tương thích ngược: Thuộc tính `actualDurationMinutes = Math.round(actualDurationSeconds / 60)` tiếp tục được duy trì song song với `actualDurationSeconds`.
- Tuyệt đối không cộng dồn hai lần giữa Timer Sessions và thời gian nhập thủ công.

### 3. Nâng cấp DatabaseService & Cơ chế Atomic Replace Transaction
- Xử lý reset `this._initPromise = null` khi `openDatabase()` gặp lỗi trong khối `.catch()`, cho phép người dùng kết nối lại mà không kẹt trạng thái lỗi.
- Bổ sung handlers `onblocked` và `onclose` để xử lý an toàn khi người dùng mở nhiều tab hoặc trong quá trình nâng cấp version.
- **Cơ chế Replace trong 1 Transaction duy nhất:**
  - Thẩm định sâu cấu trúc từng store (Deep Schema Validation) trước khi thực hiện ghi.
  - Tạo bản sao lưu tạm thời (In-Memory Snapshot Backup) trước khi xóa.
  - Mở duy nhất **1 Transaction readwrite qua cả 9 Object Stores**: thực hiện `clear()` và `put()` dữ liệu trong cùng một phiên giao dịch.
  - Nếu xảy ra lỗi giữa chừng, IndexedDB engine tự động **rollback** toàn bộ thay đổi, giữ nguyên dữ liệu cũ 100%.

### 4. Vá lỗ hổng bảo mật XSS trong Global Search
- Bọc toàn bộ các trường người dùng nhập (`title`, `description`, `content`) qua hàm `escapeHTML()` trước khi đưa vào template hiển thị kết quả tìm kiếm trong `src/app.js`.
- Bổ sung kiểm thử tự động với các chuỗi độc hại: `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`.

---

## GIAI ĐOẠN 2: ADVANCED TIME MANAGEMENT (QUẢN LÝ THỜI GIAN NÂNG CAO)

### 1. Recurring Schedule & Mô hình Occurrence định danh
- **Mô hình kiến trúc:** Tách biệt `RecurrenceRule` (quy tắc lặp) và `ScheduleOccurrence` (lần xuất hiện thực tế).
- **Cấu trúc Occurrence:**
  - `occurrenceId`: Khóa tất định dạng `occ_${ruleId}_${date}` chống tạo trùng (Idempotency).
  - `recurrenceRuleId`: Liên kết quy tắc gốc.
  - `originalDate`: Ngày dự kiến ban đầu.
  - `isOverridden`: Cờ đánh dấu khi người dùng chỉnh sửa riêng lần lặp này.
  - `isCancelled`: Cờ đánh dấu khi người dùng bỏ qua ngày này.
- **Thao tác nghiệp vụ:**
  - *Sửa một lần:* Tách thành Activity độc lập và đánh dấu `isOverridden = true`.
  - *Bỏ qua ngày:* Thêm ngày vào `rule.excludedDates` và xóa activity phát sinh của ngày đó.
  - *Sửa toàn bộ chuỗi:* Cập nhật bản mẫu `activityTemplate` trong `recurrenceRules`.
  - *Xóa chuỗi lặp:* Xóa rule và các hoạt động tương lai chưa hoàn thành; giữ nguyên các hoạt động quá khứ đã hoàn tất.
- Cơ chế sinh theo Viewport: Không sinh hàng nghìn bản ghi vô hạn vào cơ sở dữ liệu.

### 2. So sánh Kế hoạch vs Thực tế (Planned vs Actual)
- **Trong thẻ Timeline & Modal chi tiết:** Hiển thị thời gian dự kiến (`durationMinutes`), thời gian thực tế (`actualDurationSeconds`), độ chênh lệch (+/- phút), nguồn dữ liệu (`actualDurationSource`) và tỷ lệ hoàn thành (%).
- **Trong Statistics:** Biểu đồ so sánh thời gian dự kiến và thực tế theo ngày, theo tuần và theo danh mục.

### 3. Focus Mode & Pomodoro Timer
- **Focus Mode:** Màn hình tập trung tối giản, loại bỏ xao nhãng, hiển thị mục tiêu của phiên làm việc và đồng hồ bấm giờ trực quan.
- **Pomodoro Timer:**
  - Chu trình: 25 phút Focus ➔ 5 phút Short Break ➔ 25 phút Focus ➔ ... ➔ 15 phút Long Break.
  - Tích hợp dùng chung `timerService` duy nhất (không tạo bộ đếm thứ hai chạy ngầm độc lập gây xung đột dữ liệu).
  - Không cộng thời gian nghỉ ngơi (Break) vào thời gian làm việc thực tế của hoạt động.
  - Lưu trữ trạng thái vào IndexedDB, khôi phục chính xác sau khi reload trang.

---

## GIAI ĐOẠN 3: PROJECT JOURNAL (HỒ SƠ VÀ NHẬT KÝ DỰ ÁN)

### 1. Quản lý Dự án (Project Management)
- Thêm thực thể `Project` với màu sắc, icon, mục tiêu, ngày bắt đầu, ngày dự kiến hoàn thành và trạng thái (`Active`, `On Hold`, `Completed`, `Archived`).
- Menu mới trên Sidebar: **Projects**.
- **Tuyệt đối không sử dụng Kanban:** Các dự án được quản lý theo danh sách thẻ hồ sơ và Timeline dự án.

### 2. Object Store riêng biệt: `projectJournalEntries`
- Tạo riêng Store `projectJournalEntries` với khóa `id` (dạng `pje_...`) và indexes `projectId`, `date`, `createdAt`.
- Lưu trữ các bài viết nhật ký tiến độ dự án độc lập, không nhân bản hay làm lẫn lộn với `notes` và `dailyNotes`.
- Hỗ trợ trường `linkedActivityIds` để gắn các hoạt động trong Timeline vào bài viết nhật ký.

### 3. Liên kết Hoạt động & Xử lý an toàn khi xóa Dự án
- Bổ sung thuộc tính `projectId` trên các thực thể `activities`, `notes`, `timerSessions`.
- Trong `ActivityModal.js`: Dropdown chọn dự án liên kết với màu sắc nhận diện.
- **Quy tắc an toàn khi xóa dự án:**
  - Cảnh báo người dùng về số lượng hoạt động và bài viết nhật ký liên quan.
  - Cung cấp tùy chọn: "Hủy liên kết dự án nhưng giữ lại hoạt động" hoặc "Lưu trữ dự án (Archive) thay vì xóa".
  - Tuyệt đối không xóa âm thầm các hoạt động hay phiên bấm giờ liên quan.

---

## GIAI ĐOẠN 4: PWA, OFFLINE & CÁ NHÂN HÓA

### 1. Progressive Web App (PWA)
- **Manifest:** Tạo `public/manifest.webmanifest` với `start_url: "/Personal-Work-Journal/"`, `scope: "/Personal-Work-Journal/"`, icons kích thước 192x192, 512x512 và maskable.
- **Service Worker:** Tạo `public/sw.js` cache App Shell (HTML, CSS, JS, Fonts, Icons) theo chiến lược Cache-First cho assets tĩnh có version và Network-First cho HTML điều hướng.
- Thông báo cập nhật phiên bản khi có Service Worker mới được kích hoạt.

### 2. Khả năng hoạt động Offline hoàn hảo
- Khi không có mạng: Mở ứng dụng từ màn hình Desktop/Điện thoại đã cài PWA, đọc/ghi IndexedDB bình thường, chạy Timer, xem Timeline và xuất file backup JSON hoàn toàn ngoại tuyến.

### 3. Thông báo thông minh (Smart Reminders)
- Sử dụng Browser Notification API (chỉ yêu cầu quyền khi người dùng chủ động bật trong Settings).
- Nhắc nhở trước khi hoạt động bắt đầu (5 - 15 phút), nhắc nhở mục tiêu trong ngày và nhắc viết Daily Note.

### 4. Cá nhân hóa (Themes & Preferences)
- Hỗ trợ 3 chế độ giao diện: Light Theme, Dark Theme, System Theme (đồng bộ theo hệ điều hành).
- Lưu toàn bộ cấu hình cá nhân hóa vào Object Store `settings`.

---

## GIAI ĐOẠN 5: TÍCH HỢP, KIỂM THỬ HỒI QUY VÀ ĐÓNG GÓI

### 1. Cập nhật Điều hướng & UI
- Tích hợp menu `Projects` và `Focus Mode` vào Sidebar.
- Mở rộng Dashboard widgets: Dự án đang hoạt động, Thời gian tập trung hôm nay, So sánh Planned vs Actual, Phân bổ thời gian theo dự án.
- Mở rộng Statistics: Biểu đồ đa chiều theo dự án và các phiên Pomodoro.

### 2. Mở rộng Export & Backup
- File Backup JSON chứa đầy đủ **9 Object Stores** và thông tin phiên bản 2.0.0.
- Bổ sung xuất báo cáo tiến độ dự án ra file Excel (CSV) và bản in / PDF.

### 3. Bộ kiểm thử hồi quy toàn diện (Regression Testing Suite)
- Chạy lại toàn bộ 18 test cases của Version 1.0.
- Bổ sung bộ 12 test cases chuyên sâu cho Migration và V2:
  1. Migration từ Database V1 rỗng lên V2 (đủ 9 stores).
  2. Migration từ Database V1 có đầy đủ 6 stores cũ (bảo toàn 100% record count).
  3. Xử lý Activity Planned không có timer (`actualDurationSeconds = 0`).
  4. Xử lý Activity Completed có timerSessions (`timer_verified`).
  5. Xử lý Activity có thời gian nhập thủ công (`manual_verified`).
  6. Xử lý dữ liệu cũ kế thừa (`legacy_unverified` giữ nguyên không xóa).
  7. Không cộng trùng Timer Sessions và Manual tracking.
  8. Xử lý lỗi rollback trong quá trình nâng cấp store.
  9. Xử lý sự kiện `onversionchange` và `onblocked` khi mở nhiều tab.
  10. Tạo Project và liên kết Activity qua index `projectId`.
  11. Tạo Project Journal Entry độc lập trong `projectJournalEntries`.
  12. Thẩm định quy trình Replace Backup trong 1 transaction duy nhất.
- Chạy `npm run build` xác nhận hoàn thành đóng gói production với 0 lỗi.
