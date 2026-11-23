# 🗺️ UPGRADE PLAN: PERSONAL WORK JOURNAL 2.0
> **Kế hoạch triển khai kiến trúc 5 giai đoạn chi tiết**  
> **Nguyên tắc xuyên suốt:** Bảo toàn dữ liệu 100%, không dùng Kanban Board, Offline-first, kiểm thử nghiêm ngặt trước khi bàn giao.

---

## GIAI ĐOẠN 1: CORE & DATA INTEGRITY (NỀN TẢNG VÀ TOÀN VẸN DỮ LIỆU)

### 1. Nâng cấp IndexedDB Schema (DB_VERSION = 2)
- **Mục tiêu:** Bổ sung cấu trúc dữ liệu mới mà không làm mất hay thay đổi bất kỳ bản ghi nào trong 6 Object Store hiện có.
- **Thực hiện:**
  - Nâng `DB_VERSION` từ `1` lên `2`.
  - Thêm 2 Object Stores mới:
    - `projects` (keyPath: `id`, indexes: `status`, `category`, `createdAt`).
    - `recurrenceRules` (keyPath: `id`, indexes: `recurrenceType`, `startDate`, `createdAt`).
  - Bổ sung indexes vào các Object Stores cũ:
    - `activities`: thêm index `projectId`, `recurrenceRuleId`.
    - `notes`: thêm index `projectId`.
    - `timerSessions`: thêm index `projectId`, `type`.
  - Di chuyển dữ liệu tương thích (Data migration): kiểm tra thuộc tính `actualDurationSeconds` trên từng bản ghi `activities`, chuẩn hóa tự động nhưng bảo toàn dữ liệu gốc.

### 2. Tối ưu hóa DatabaseService & Kết nối
- Xử lý reset `this._initPromise = null` khi `openDatabase()` gặp lỗi, hỗ trợ người dùng thử lại kết nối mà không cần tải lại toàn bộ trang.
- Thêm sự kiện `onblocked` và `onclose` để xử lý khi có nhiều tab cùng mở hoặc trong quá trình nâng cấp version.
- Đảm bảo tất cả thao tác ghi dữ liệu chỉ trả về kết quả sau khi transaction hoàn thành (`tx.oncomplete`).

### 3. Nâng cấp An toàn Backup & Restore
- **Export:** Bổ sung toàn bộ 8 Object Stores vào file JSON backup (kèm thông tin schema version 2.0.0, tổng số record từng store, timestamp).
- **Import:**
  - Xác thực sâu cấu trúc (Deep Schema Validation): Kiểm tra kiểu dữ liệu, các trường bắt buộc và định dạng ID trước khi thực hiện ghi.
  - Snapshot Backup: Tự động sao lưu dữ liệu hiện tại vào bộ nhớ tạm trước khi thực hiện Replace Mode. Nếu có bất kỳ lỗi nào xảy ra trong quá trình ghi, lập tức rollback trả lại dữ liệu cũ nguyên vẹn.

### 4. Chuẩn hóa Planned Duration & Actual Duration
- Tách biệt rạch ròi:
  - `durationMinutes`: Thời lượng dự kiến lên kế hoạch (tính từ startTime và endTime trừ breakMinutes).
  - `actualDurationSeconds`: Thời lượng thực tế (mặc định = 0 cho hoạt động mới chưa chạy Timer hoặc chưa nhập thủ công).
  - `actualDurationMinutes`: Thuộc tính hiển thị tương thích = `Math.round(actualDurationSeconds / 60)`.
- Cập nhật thống kê phân biệt rõ: Kế hoạch (Planned) vs Thực tế (Actual).

### 5. Vá lỗ hổng bảo mật XSS trong Global Search
- Bọc toàn bộ các trường người dùng nhập (`title`, `description`, `content`) qua hàm `escapeHTML()` trước khi đưa vào template hiển thị kết quả tìm kiếm trong `src/app.js`.
- Bổ sung kiểm thử tự động với các chuỗi độc hại: `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`.

---

## GIAI ĐOẠN 2: ADVANCED TIME MANAGEMENT (QUẢN LÝ THỜI GIAN NÂNG CAO)

### 1. Recurring Schedule (Lịch lặp lại định kỳ)
- **Mô hình:** Tách biệt `RecurrenceRule` (quy tắc lặp) và `Occurrence` (lần xuất hiện thực tế).
- **Các kiểu lặp:** Hằng ngày (Daily), Hằng tuần (Weekly), Chọn các thứ cụ thể trong tuần (Custom Weekdays), Hằng tháng (Monthly).
- **Tính năng:**
  - Lên lịch chuỗi lặp với ngày bắt đầu, ngày kết thúc hoặc lặp vô hạn.
  - Hỗ trợ danh sách ngày ngoại lệ (`excludedDates`).
  - Cho phép sửa/xóa một lần duy nhất hoặc sửa/xóa toàn bộ chuỗi lặp.
  - Cơ chế sinh lịch theo phạm vi hiển thị (Viewport Generation) tránh tạo hàng nghìn bản ghi rác trong cơ sở dữ liệu.

### 2. So sánh Kế hoạch vs Thực tế (Planned vs Actual)
- **Trong thẻ hoạt động & modal chi tiết:** Hiển thị thời gian dự kiến, thời gian thực tế, độ chênh lệch (+/- phút) và tỷ lệ hoàn thành (%).
- **Trong thống kê:** Biểu đồ so sánh thời gian dự kiến và thực tế theo ngày, theo tuần và theo danh mục.

### 3. Focus Mode & Pomodoro Timer
- **Focus Mode:** Màn hình tập trung tối giản, loại bỏ xao nhãng, hiển thị mục tiêu của phiên làm việc và đồng hồ bấm giờ trực quan.
- **Pomodoro Timer:**
  - Chu trình: 25 phút Focus ➔ 5 phút Short Break ➔ 25 phút Focus ➔ ... ➔ 15 phút Long Break.
  - Cho phép tùy chỉnh thời gian phiên, tạm dừng, bỏ qua break.
  - Tích hợp dùng chung `timerService` duy nhất (không tạo bộ đếm thứ hai chạy ngầm độc lập gây xung đột dữ liệu).
  - Lưu trữ trạng thái vào IndexedDB, khôi phục chính xác sau khi reload trang.

---

## GIAI ĐOẠN 3: PROJECT JOURNAL (HỒ SƠ VÀ NHẬT KÝ DỰ ÁN)

### 1. Quản lý Dự án (Project Management)
- Thêm thực thể `Project` với màu sắc, icon, mục tiêu, ngày bắt đầu, ngày dự kiến hoàn thành và trạng thái (`Active`, `On Hold`, `Completed`, `Archived`).
- Menu mới trên Sidebar: **Projects**.
- **Tuyệt đối không sử dụng Kanban:** Các dự án được quản lý theo danh sách thẻ hồ sơ và Timeline dự án.

### 2. Liên kết Hoạt động và Nhật ký với Dự án
- Thuộc tính `projectId` trên các thực thể `activities`, `notes`, `timerSessions`.
- Trong form thêm/sửa hoạt động: Dropdown chọn dự án liên kết với màu sắc nhận diện.
- Khi xóa dự án: Hiển thị cảnh báo, cung cấp tùy chọn "Hủy liên kết dự án nhưng giữ lại hoạt động" để chống sinh ra dữ liệu mồ côi.

### 3. Project Dashboard & Project Journal
- Trang chi tiết cho từng dự án:
  - Tổng số giờ dự kiến vs thực tế của dự án.
  - Số hoạt động đã hoàn tất.
  - **Project Timeline:** Trục thời gian hiển thị toàn bộ hoạt động thuộc dự án.
  - **Project Journal:** Khu vực nhật ký ghi chú tiến độ, khó khăn, giải pháp kỹ thuật gắn liền với dự án.

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
- Nhắc nhở trước khi hoạt động bắt đầu (5 - 15 phút), nhắc nhở mục tiêu cuối ngày và nhắc viết Daily Note.

### 4. Cá nhân hóa (Themes & Preferences)
- Hỗ trợ 3 chế độ giao diện: Light Theme, Dark Theme, System Theme (đồng bộ theo hệ điều hành).
- Lưu toàn bộ cấu hình cá nhân hóa vào Object Store `settings`.

---

## GIAI ĐOẠN 5: TÍCH HỢP, KIỂM THỬ HỒI QUY VÀ ĐÓNG GÓI

1. **Cập nhật Điều hướng:** Tích hợp menu `Projects` và `Focus Mode` vào Sidebar.
2. **Nâng cấp Dashboard & Statistics:** Bổ sung chỉ số dự án, biểu đồ phân bổ thời gian dự án, so sánh Planned vs Actual và phiên Pomodoro.
3. **Mở rộng Export:** Xuất báo cáo dự án ra CSV/PDF và file JSON chứa toàn bộ dữ liệu 2.0.
4. **Kiểm thử hồi quy:** Mở rộng `test/test-suite.js` kiểm tra toàn bộ 18 test cases cũ và bổ sung hơn 15 test cases mới cho migration, recurrence, project, planned vs actual và security XSS.
5. **Kiểm thử Build Production:** Chạy `npm run build` xác nhận không có lỗi module, kiểm tra kích thước bundle và đường dẫn assets.
