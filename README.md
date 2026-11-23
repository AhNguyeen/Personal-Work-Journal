# 📔 Personal Work Journal
> **Website quản lý lịch làm việc, học tập và nhật ký cá nhân chuyên nghiệp**  
> Thiết kế theo chuẩn **Daily Schedule & Personal Journal** (Lịch trình Timeline thực tế, **TUYỆT ĐỐI KHÔNG PHẢI KANBAN BOARD**).

---

## 🌟 1. Giới thiệu dự án

**Personal Work Journal** là giải pháp web ứng dụng cá nhân hóa, độc lập và hiện đại dành cho lập trình viên, học sinh, sinh viên và người đi làm muốn quản lý quỹ thời gian trong ngày một cách kỷ luật và khoa học.

Thay vì phân tán công việc trên các bảng Kanban trừu tượng (To Do, Doing, Done) không gắn liền với thời gian thực tế, **Personal Work Journal** đặt **Trục thời gian thực tế (Timeline 24h)** làm trung tâm:
- Mọi hoạt động đều có giờ bắt đầu, kết thúc, thời lượng dự kiến và thời lượng thực tế.
- Khối thời gian (Timeblock) được trực quan hóa trực tiếp theo phút.
- Gắn liền với hệ thống **Daily Journal (Nhật ký tự phản tư cuối ngày)** và **Kho ghi chú chi tiết**.
- Lưu trữ toàn bộ dữ liệu nghiệp vụ bằng **IndexedDB cục bộ trên trình duyệt**, hoạt động mượt mà offline 100% không cần backend server.

---

## 🎯 2. Mục tiêu dự án

- **Quản lý lịch trình chính xác:** Quan sát toàn bộ hoạt động trong ngày từ 00:00 đến 24:00 với vạch chỉ giờ hiện tại (Current Time Needle).
- **Loại bỏ hoàn toàn tư duy Kanban:** Tập trung vào kế hoạch hóa thời gian thực tế (Timeblocking) tương tự các ứng dụng cao cấp như Sunsama, Routine, Rize.
- **Đánh giá mức độ quan trọng (1 - 5 sao):** Ưu tiên các hoạt động quan trọng nhất, lọc nhanh các đầu việc 4-5 sao.
- **Theo dõi thời gian thực tế (Stopwatch & Manual):** Đo đếm chính xác thời gian làm việc bằng bộ đếm giờ không bị trôi thời gian ngay cả khi đóng hoặc tải lại trình duyệt.
- **Nhật ký cá nhân 2 cấp:** Tổng kết ngày (Daily Note) với 7 câu hỏi phản tư và kho ghi chú linh hoạt (Multiple Notes).
- **Thống kê & phân tích trực quan:** Biểu đồ xu hướng hàng ngày, phân bổ danh mục (Chart.js), tỷ lệ hoàn thành và ngày năng suất nhất.
- **An toàn dữ liệu tuyệt đối:** Xuất/nhập bản sao lưu JSON, xuất báo cáo Excel (CSV) có dấu tiếng Việt, in ấn PDF.

---

## 🚀 3. Danh sách chức năng chi tiết

### 1. Dashboard (Trang tổng quan cá nhân)
- **KPI Metrics:** Tổng hoạt động hôm nay, tỷ lệ hoàn thành, tổng giờ làm việc, học tập, dự án, nghỉ ngơi, số đầu việc 5 sao.
- **Today's Schedule:** Danh sách lịch trình rút gọn trong ngày, click để xem chi tiết.
- **Important Activities:** Danh sách việc ưu tiên cao (4-5 sao).
- **Time Distribution:** Biểu đồ tròn (Doughnut Chart) hiển thị tỷ trọng các danh mục.
- **Today's Notes Snapshot:** Bản xem nhanh nhật ký phản tư của ngày hiện tại.
- **Goals Progress:** Thanh tiến độ thời gian thực của các mục tiêu hàng ngày/hàng tuần.

### 2. Daily Schedule (Trục thời gian Ngày & Tuần) - *Chức năng trọng tâm*
- **Day Timeline (24 Giờ):**
  - Trục 24 khung giờ từ 00:00 đến 23:59 (mỗi phút tương ứng 1px tỉ lệ).
  - **Vạch chỉ giờ hiện tại (Current Time Needle):** Màu đỏ nổi bật, tự động cập nhật vị trí mỗi phút.
  - **Tự động cuộn (Auto-scroll):** Tự động cuộn đến giờ hiện tại khi mở ngày hôm nay.
  - **Timeblock Card:** Khối thời gian hiển thị tên, danh mục, trạng thái, sao, thời lượng thực tế.
  - **Cảnh báo trùng giờ (Overlap Conflict Detection):** Phát hiện và hiển thị huy hiệu cảnh báo khi hai hoạt động trùng thời gian, yêu cầu xác nhận nếu người dùng cố ý lên lịch trùng.
- **Week Timeline (7 Ngày):**
  - Hiển thị 7 cột đại diện từ Thứ 2 đến Chủ nhật.
  - Thống kê tổng số giờ làm việc theo từng ngày.
  - Nhấp vào bất kỳ ngày nào để chuyển ngay sang Timeline chi tiết của ngày đó.

### 3. Star Rating (Hệ thống đánh giá sao 1 - 5)
- Thang đo mức độ quan trọng:
  - 1 sao: Ít quan trọng
  - 2 sao: Bình thường
  - 3 sao: Cần chú ý
  - 4 sao: Quan trọng
  - 5 sao: Rất quan trọng
- Trang **Starred Activities** chuyên biệt, sắp xếp ưu tiên từ 5 sao xuống 1 sao, cho phép lọc theo danh mục và số sao.

### 4. Notes & Work Journal (Nhật ký 2 cấp độ)
- **Daily Note (Nhật ký phản tư theo ngày):**
  - 1. Hôm nay đã làm gì?
  - 2. Những điều đã học được?
  - 3. Kết quả & thành tựu đạt được?
  - 4. Khó khăn gặp phải & giải pháp?
  - 5. Những việc chưa hoàn thành?
  - 6. Kế hoạch & mục tiêu ngày mai?
  - 7. Đánh giá chất lượng ngày hôm nay (1 - 5 sao).
  - **Debounced Auto-save:** Tự động lưu ngầm vào IndexedDB sau 600ms không gõ phím, hiển thị trạng thái `Đang chỉnh sửa` ➔ `Đang lưu...` ➔ `Đã lưu lúc HH:mm` / `Lỗi lưu`.
- **Multiple Notes (Ghi chú chi tiết):**
  - Tạo không giới hạn ghi chú trong ngày hoặc theo dự án.
  - Ghim ghi chú quan trọng (Pin), tìm kiếm từ khóa tức thì.

### 5. Time Tracking (Đo lường thời gian thực tế)
- **Persistent Stopwatch / Timer:**
  - Đồng hồ bấm giờ kỹ thuật số hiển thị `HH:mm:ss`.
  - Chọn hoạt động để bắt đầu theo dõi: `Start` ➔ `Pause` ➔ `Resume` ➔ `Stop & Save` ➔ `Reset`.
  - **Cơ chế lưu trữ chống trôi giờ:** Không phụ thuộc `setInterval`. Lưu `startTime` và `accumulatedSeconds` vào IndexedDB. Khi đóng trình duyệt hoặc tải lại trang (F5), Timer khôi phục chính xác số giây đã trôi qua.
  - Chỉ cho phép 1 Timer hoạt động tại một thời điểm.
  - Khi Stop: Tự động cộng dồn thời gian thực tế vào hoạt động tương ứng và chuyển trạng thái sang `Completed`.
- **Ghi nhận thủ công (Manual Time Entry):**
  - Nhập giờ bắt đầu, giờ kết thúc và số phút nghỉ ngơi (Break).
  - Công thức: `Thời gian thực tế = Giờ kết thúc - Giờ bắt đầu - Thời gian nghỉ`.
- **Lịch sử Timer Sessions:** Bảng ghi nhận chi tiết các phiên bấm giờ đã hoàn tất.

### 6. Calendar (Lịch tháng trực quan)
- Chế độ xem Tháng với lưới 7 cột thứ ngày theo tuần chuẩn Việt Nam (Thứ 2 đến Chủ nhật).
- Thẻ màu sắc tương ứng với các hoạt động đã lên lịch.
- Bảng phụ bên phải hiển thị danh sách công việc của ngày đang chọn, hỗ trợ nút bấm chuyển sang Day Timeline hoặc thêm nhanh hoạt động.

### 7. Statistics (Báo cáo & Thống kê chuyên sâu)
- Bộ lọc linh hoạt: Hôm nay, 7 ngày gần nhất, Tuần này, Tháng này, 3 tháng, Tùy chỉnh.
- Biểu đồ cột: Xu hướng thời gian làm việc qua các ngày.
- Biểu đồ tròn (Doughnut): Tỷ trọng % giữa các danh mục (Work, Study, Project, Personal, Break, Other).
- Biểu đồ phân bổ sao: Thống kê số lượng công việc theo mức độ quan trọng.
- Phân tích thông minh: Ngày năng suất nhất (Peak Day), danh mục chiếm nhiều thời gian nhất.
- Nút **Xuất file Excel (CSV)** với UTF-8 BOM chuẩn hiển thị tiếng Việt và **In ấn / Xuất PDF**.

### 8. Goals (Quản lý mục tiêu cá nhân)
- Đặt mục tiêu số giờ làm việc, học tập theo ngày, tuần hoặc tháng.
- Tự động đối chiếu với thời gian thực tế từ các hoạt động trong IndexedDB để tính tỷ lệ hoàn thành (%).
- Thanh tiến độ trực quan với cảnh báo còn thiếu bao nhiêu giờ để cán đích.

### 9. History (Tra cứu lịch sử toàn diện)
- Bảng danh sách toàn bộ hoạt động theo thời gian giảm dần.
- Phân trang (Pagination) mượt mà, bảo vệ hiệu năng khi dữ liệu lớn.
- Lọc đa chiều: Khoảng thời gian, danh mục, trạng thái, số sao và ô tìm kiếm từ khóa.

### 10. Global Search (Tìm kiếm toàn hệ thống)
- Ô tìm kiếm đặt ngay tại thanh Header.
- Tự động quét tức thì qua Tên hoạt động, Mô tả, Danh mục, Tiêu đề ghi chú và Nội dung ghi chú.
- Modal hiển thị kết quả phân loại rõ ràng, nhấp vào để mở ngay modal chỉnh sửa.

### 11. Settings, Backup & Restore
- **Export JSON:** Tải về toàn bộ cơ sở dữ liệu `PersonalWorkJournalDB` gồm 6 stores dưới định dạng JSON có thông tin phiên bản schema và mốc thời gian xuất.
- **Import JSON:** Phục hồi dữ liệu từ file sao lưu với 2 chế độ:
  - `Replace Mode`: Thay thế toàn bộ dữ liệu hiện tại sau khi người dùng xác nhận an toàn.
  - `Merge Mode`: Hợp nhất dữ liệu mới với dữ liệu hiện có.
- **Tạo dữ liệu mẫu (Sample Demo Data):** Khởi tạo sẵn một lịch trình phong phú trong tuần để trải nghiệm đầy đủ giao diện.
- **Xóa sạch dữ liệu (Clear DB):** Tẩy trống dữ liệu để bắt đầu lại từ đầu khi cần.

---

## 🛠️ 4. Công nghệ sử dụng & Kiến trúc hệ thống

- **Core Web:** HTML5, CSS3 hiện đại (CSS Variables, Flexbox, Grid), JavaScript ES6+ (Native Modules).
- **Data Persistence:** **IndexedDB API** làm cơ sở dữ liệu chính (`PersonalWorkJournalDB`).
- **Data Abstraction:** Kiến trúc phân tầng rõ ràng:
  - `DatabaseService`: Quản lý kết nối, giao dịch (transactions), import/export.
  - `Repositories`: `activityRepository`, `dailyNoteRepository`, `noteRepository`, `goalRepository`, `timerRepository`, `settingsRepository`.
  - `Services`: `activityService`, `noteService`, `timerService`, `statisticsService`, `backupService`, `exportService`.
- **Charts:** Chart.js 4.x.
- **Icons:** SVG chuẩn hóa và Lucide icons.
- **Build & Dev Tool:** Vite 6.x (Cấu hình `base: './'` đảm bảo tương thích tuyệt đối khi chạy local và GitHub Pages).

---

## 📂 5. Cấu trúc thư mục nguồn

```text
Personal-Work-Journal/
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD tự động deploy lên GitHub Pages
├── dist/                         # Bản build production sẵn sàng deploy
├── src/
│   ├── components/               # Các UI components tái sử dụng
│   │   ├── ActivityModal.js      # Modal thêm/sửa hoạt động (validation, overlap check)
│   │   ├── ConfirmModal.js       # Hộp thoại xác nhận thao tác quan trọng
│   │   ├── Header.js             # Thanh điều hướng trên, tìm kiếm, widget timer
│   │   ├── Sidebar.js            # Thanh bên điều hướng 10 phân hệ
│   │   ├── Timeline.js           # Trục thời gian 24h, kim chỉ giờ đỏ, auto-scroll
│   │   ├── Toast.js              # Thông báo thông minh (success, error, warning)
│   │   └── WeekTimeline.js       # Tổng quan lịch trình tuần 7 ngày
│   ├── database/
│   │   ├── db.js                 # Khởi tạo schema và indexes IndexedDB
│   │   ├── databaseService.js    # Lớp dịch vụ CRUD và giao dịch tập trung
│   │   └── repositories/         # Các kho lưu trữ chuyên biệt cho từng thực thể
│   │       ├── activityRepository.js
│   │       ├── dailyNoteRepository.js
│   │       ├── goalRepository.js
│   │       ├── noteRepository.js
│   │       ├── settingsRepository.js
│   │       └── timerRepository.js
│   ├── pages/                    # Các màn hình chính
│   │   ├── Calendar/CalendarPage.js
│   │   ├── DailySchedule/DailySchedulePage.js
│   │   ├── Dashboard/DashboardPage.js
│   │   ├── Goals/GoalsPage.js
│   │   ├── History/HistoryPage.js
│   │   ├── Notes/NotesPage.js
│   │   ├── Settings/SettingsPage.js
│   │   ├── StarredActivities/StarredActivitiesPage.js
│   │   ├── Statistics/StatisticsPage.js
│   │   └── TimeTracking/TimeTrackingPage.js
│   ├── services/                 # Nghiệp vụ logic độc lập
│   │   ├── activityService.js
│   │   ├── backupService.js
│   │   ├── exportService.js
│   │   ├── noteService.js
│   │   ├── statisticsService.js
│   │   └── timerService.js
│   ├── styles/                   # Hệ thống giao diện Clean Modern Minimalist
│   │   ├── components.css
│   │   ├── global.css
│   │   ├── layout.css
│   │   ├── responsive.css
│   │   └── variables.css
│   ├── utils/                    # Tiện ích ngày giờ, định dạng, validation
│   │   ├── constants.js
│   │   ├── dateUtils.js
│   │   ├── formatters.js
│   │   ├── timeUtils.js
│   │   └── validation.js
│   ├── app.js                    # Điều phối chính & Routing ứng dụng
│   └── main.js                   # Điểm khởi chạy ứng dụng
├── test/
│   └── test-suite.js             # Bộ kiểm thử tự động toàn diện (18 test cases)
├── index.html                    # File HTML chính
├── package.json
├── vite.config.js                # Cấu hình Vite (base: './')
└── README.md
```

---

## 💻 6. Hướng dẫn cài đặt & Chạy dự án

### Yêu cầu môi trường
- **Node.js**: Phiên bản 18.x trở lên (đã kiểm thử trên Node 24).
- **Trình duyệt hiện đại**: Chrome, Edge, Firefox, Safari (hỗ trợ IndexedDB và ES Modules).

### Các bước cài đặt
1. Mở terminal tại thư mục dự án:
   ```bash
   cd "d:\VS Code\Personal-Work-Journal"
   ```

2. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ```

3. Chạy môi trường phát triển (Development):
   ```bash
   npm run dev
   ```
   Sau đó mở trình duyệt tại địa chỉ hiển thị trên màn hình (mặc định: `http://localhost:3000`).

4. Chạy bộ kiểm thử tự động (Unit & Integration Tests):
   ```bash
   npm test
   # hoặc: node test/test-suite.js
   ```

5. Đóng gói cho Production:
   ```bash
   npm run build
   ```
   Thư mục `dist/` sẽ được tạo ra chứa mã nguồn HTML, CSS, JS đã được tối ưu hóa.

6. Chạy thử bản build production:
   ```bash
   npm run preview
   ```

---

## 🌐 7. Hướng dẫn Triển khai lên GitHub Pages

Website được thiết kế hoàn toàn tĩnh phía Frontend (Static Web App) và toàn bộ dữ liệu lưu trữ phía client bằng IndexedDB, do đó việc triển khai lên GitHub Pages cực kỳ đơn giản và miễn phí:

### Cách 1: Sử dụng GitHub Actions tự động (Khuyên dùng)
1. Tạo một repository mới trên GitHub (ví dụ: `personal-work-journal`).
2. Đẩy toàn bộ mã nguồn lên branch `main`:
   ```bash
   git remote add origin https://github.com/<tên-người-dùng>/personal-work-journal.git
   git branch -M main
   git push -u origin main
   ```
3. Trên GitHub, vào mục **Settings** của repository -> Chọn **Pages** (cột trái).
4. Tại mục **Build and deployment** -> **Source**: Chọn **GitHub Actions**.
5. File `.github/workflows/deploy.yml` đã được cấu hình sẵn sẽ tự động kích hoạt, kiểm tra test suite, build Vite và deploy lên địa chỉ:
   `https://<tên-người-dùng>.github.io/personal-work-journal/`

### Cách 2: Triển khai thủ công từ thư mục dist
1. Chạy `npm run build`.
2. Đẩy thư mục `dist/` lên branch `gh-pages`:
   ```bash
   git subtree push --prefix dist origin gh-pages
   ```

---

## 💾 8. Cơ chế lưu trữ IndexedDB & Sao lưu phục hồi

### Cơ chế hoạt động của IndexedDB
- Ứng dụng khởi tạo cơ sở dữ liệu `PersonalWorkJournalDB` phiên bản 1 với 6 Object Stores:
  1. `activities`: Chứa lịch trình công việc, gắn index `date`, `category`, `status`, `stars`.
  2. `dailyNotes`: Chứa nhật ký tự phản tư, khóa chính và index theo `date`.
  3. `notes`: Chứa kho ghi chú chi tiết, index theo `date`, `category`, `isPinned`.
  4. `goals`: Chứa mục tiêu năng suất, index theo `category`, `period`, `status`.
  5. `timerSessions`: Chứa lịch sử bấm giờ, index theo `activityId`, `status`.
  6. `settings`: Chứa trạng thái active của Timer và các tùy chọn giao diện.
- **Không bao giờ mất dữ liệu:** Khi tải lại trang, tắt máy hoặc mở lại trình duyệt, IndexedDB vẫn giữ nguyên 100% dữ liệu.

### Hướng dẫn Backup & Restore
1. **Để sao lưu:**
   - Vào menu **Settings & Backup** -> Nhấn nút **"Tải về file Backup (.json)"**.
   - File JSON sẽ được tải về với tên dạng: `personal_work_journal_backup_YYYY-MM-DD.json`.
2. **Để phục hồi:**
   - Tại trang **Settings & Backup**, chọn file `.json` đã lưu.
   - Chọn chế độ: **Replace (Ghi đè)** hoặc **Merge (Hợp nhất)**.
   - Nhấn **"Tiến hành khôi phục dữ liệu"** và xác nhận trên hộp thoại. Ứng dụng sẽ nạp dữ liệu vào IndexedDB và tự động làm mới giao diện.

---

## 🔒 9. Giới hạn phiên bản & Kế hoạch mở rộng

- **Phiên bản hiện tại (v1.0.0):**
  - Lưu trữ độc lập trên từng thiết bị/trình duyệt của người dùng (Offline-first, bảo mật tối đa).
  - Không cần mạng Internet để sử dụng sau khi đã tải trang lần đầu.
- **Đề xuất phát triển tương lai (v2.0):**
  - Bổ sung tùy chọn đồng bộ mã hóa qua Google Drive cá nhân hoặc WebDAV.
  - Hỗ trợ thông báo âm thanh hoặc Notification API của trình duyệt khi sắp đến giờ hoạt động tiếp theo.
  - Hỗ trợ PWA (Progressive Web App) Service Worker để cài đặt website như app native trên Windows/macOS/Android/iOS.

---

## 🏆 10. Kết quả nghiệm thu & Cam kết kỹ thuật

- [x] **Giao diện Timeline chuẩn mực:** Có trục 24h, kim chỉ giờ đỏ, auto-scroll, card tỉ lệ phút chuẩn xác.
- [x] **Tuyệt đối không có Kanban Board:** Không có To Do / Doing / Done, không kéo thả board, tổ chức chuẩn thời gian.
- [x] **Hệ thống đánh giá sao 1-5:** Phân loại độ quan trọng, trang Starred Activities ưu tiên 5 -> 1 sao.
- [x] **Nhật ký 2 cấp:** Daily Note với 7 câu hỏi phản tư có Auto-save debounce + Multiple Notes.
- [x] **Stopwatch thời gian thực tế:** Chống trôi giờ qua F5/Reload nhờ lưu timestamp vào IndexedDB.
- [x] **Thống kê Chart.js & Lịch Calendar:** Biểu đồ đa dạng, lọc thời gian linh hoạt, xuất file Excel CSV tiếng Việt.
- [x] **Bộ test tự động:** 18/18 test case passed 100%.
- [x] **Sẵn sàng GitHub Pages:** Build Vite thành công với đường dẫn relative `./assets/`.
