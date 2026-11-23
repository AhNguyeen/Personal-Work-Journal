# 🗄️ DATABASE MIGRATION SPECIFICATION: V1 ➔ V2
> **Chi tiết thiết kế di chuyển cơ sở dữ liệu IndexedDB, phân loại dữ liệu thực tế và đảm bảo toàn vẹn**  
> **Cơ sở dữ liệu:** `PersonalWorkJournalDB`  
> **Phiên bản cũ:** `1` ➔ **Phiên bản mới:** `2`

---

## I. TỔNG QUAN DANH SÁCH 10 OBJECT STORES TRONG V2

Hệ thống nâng cấp từ 6 Object Stores lên **10 Object Stores**. Tất cả 6 store cũ được bảo toàn 100% dữ liệu, cấu trúc và khóa chính:

| STT | Tên Object Store | Tình trạng trong V2 | Mục đích nghiệp vụ | Khóa chính (keyPath) | Giai đoạn triển khai |
| :---: | :--- | :---: | :--- | :--- | :---: |
| 1 | `activities` | **Giữ nguyên & Mở rộng** | Lịch trình công việc thực tế theo ngày | `id` | V1 ➔ V2 (GĐ 1) |
| 2 | `dailyNotes` | **Giữ nguyên (Bảo toàn)** | Nhật ký phản tư tổng hợp theo ngày (1 bản ghi/ngày) | `id` | V1 (GĐ 1) |
| 3 | `notes` | **Giữ nguyên & Mở rộng** | Kho ghi chú chi tiết nhiều bản ghi trong ngày | `id` | V1 ➔ V2 (GĐ 1) |
| 4 | `goals` | **Giữ nguyên (Bảo toàn)** | Mục tiêu giờ làm việc/học tập theo tuần/tháng | `id` | V1 (GĐ 1) |
| 5 | `timerSessions` | **Giữ nguyên & Mở rộng** | Lịch sử các phiên bấm giờ thực tế | `id` | V1 ➔ V2 (GĐ 1) |
| 6 | `settings` | **Giữ nguyên (Bảo toàn)** | Cài đặt hệ thống, theme, active timer state | `key` | V1 (GĐ 1) |
| 7 | `projects` | **MỚI (Bổ sung)** | Quản lý hồ sơ dự án cá nhân | `id` | Schema GĐ 1 / UI GĐ 3 |
| 8 | `recurrenceRules` | **MỚI (Bổ sung)** | Quản lý các quy tắc lịch lặp lại định kỳ | `id` | Schema GĐ 1 / UI GĐ 2 |
| 9 | `recurrenceOccurrences` | **MỚI (Bổ sung)** | Lưu trữ bền vững các lần lặp định danh, chống tạo trùng cross-tab/reload | `occurrenceId` | Schema GĐ 1 / Logic GĐ 2 |
| 10 | `projectJournalEntries`| **MỚI (Bổ sung)** | Nhật ký tiến độ và giải pháp kỹ thuật của dự án | `id` | Schema GĐ 1 / UI GĐ 3 |

---

## II. ĐẶC TẢ CHI TIẾT CÁC STORE MỚI VÀ INDEXES MỞ RỘNG

### 1. Store mới: `projects`
```javascript
if (!db.objectStoreNames.contains('projects')) {
  const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
  projectStore.createIndex('status', 'status', { unique: false });
  projectStore.createIndex('category', 'category', { unique: false });
  projectStore.createIndex('createdAt', 'createdAt', { unique: false });
}
```
**Mô hình dữ liệu:**
```typescript
interface Project {
  id: string;               // 'proj_...'
  name: string;             // Tên dự án (ví dụ: HondaAuto DMS, Mercedes Garage)
  description: string;      // Mục tiêu, phạm vi dự án
  category: string;         // 'Work' | 'Study' | 'Project' | 'Personal' | 'Other'
  color: string;            // Mã màu HEX nhận diện
  icon: string;             // Tên icon Lucide đại diện
  startDate: string;        // 'YYYY-MM-DD'
  targetDate: string;       // 'YYYY-MM-DD'
  status: 'Active' | 'On Hold' | 'Completed' | 'Archived';
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}
```

### 2. Store mới: `recurrenceRules`
```javascript
if (!db.objectStoreNames.contains('recurrenceRules')) {
  const recStore = db.createObjectStore('recurrenceRules', { keyPath: 'id' });
  recStore.createIndex('recurrenceType', 'recurrenceType', { unique: false });
  recStore.createIndex('startDate', 'startDate', { unique: false });
  recStore.createIndex('createdAt', 'createdAt', { unique: false });
}
```
**Mô hình dữ liệu:**
```typescript
interface RecurrenceRule {
  id: string;               // 'rec_...'
  activityTemplate: {       // Bản mẫu để sinh các lần xuất hiện
    title: string;
    description: string;
    category: string;
    startTime: string;      // '09:00'
    endTime: string;        // '10:30'
    stars: number;
    projectId?: string;
  };
  recurrenceType: 'daily' | 'weekly' | 'custom_weekdays' | 'monthly';
  interval: number;         // 1 (mỗi ngày), 2 (cách 2 ngày/tuần)...
  selectedWeekdays?: number[]; // [1, 3, 5] (Thứ 2, Thứ 4, Thứ 6; 0: CN)
  startDate: string;        // 'YYYY-MM-DD'
  endDate?: string;         // 'YYYY-MM-DD'
  repeatUntil?: string;     // 'YYYY-MM-DD'
  excludedDates?: string[]; // Danh sách 'YYYY-MM-DD' bị bỏ qua (skip occurrence)
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}
```

### 3. Store mới: `recurrenceOccurrences` (Lưu trữ bền vững & Chống tạo trùng)
Nhằm đảm bảo cơ chế chống tạo trùng có tính bền vững tuyệt đối sau khi reload trang và khi người dùng mở nhiều tab cùng lúc, hệ thống quản lý các lần xuất hiện bằng Object Store độc lập lưu trên ổ đĩa thay vì chỉ lưu tạm trong bộ nhớ:
```javascript
if (!db.objectStoreNames.contains('recurrenceOccurrences')) {
  const occStore = db.createObjectStore('recurrenceOccurrences', { keyPath: 'occurrenceId' });
  occStore.createIndex('occurrenceId', 'occurrenceId', { unique: true });
  occStore.createIndex('recurrenceRuleId', 'recurrenceRuleId', { unique: false });
  occStore.createIndex('originalDate', 'originalDate', { unique: false });
  occStore.createIndex('generatedActivityId', 'generatedActivityId', { unique: false });
  occStore.createIndex('isOverridden', 'isOverridden', { unique: false });
  occStore.createIndex('isCancelled', 'isCancelled', { unique: false });
  occStore.createIndex('createdAt', 'createdAt', { unique: false });
}
```
**Mô hình dữ liệu:**
```typescript
interface RecurrenceOccurrence {
  occurrenceId: string;         // 'occ_${recurrenceRuleId}_${originalDate}' (Định danh tất định - Primary Key)
  recurrenceRuleId: string;     // Liên kết với recurrenceRules.id (luôn bảo toàn quan hệ nguồn)
  originalDate: string;         // 'YYYY-MM-DD' (Ngày lịch dự kiến ban đầu)
  generatedActivityId?: string; // ID của activity tương ứng trong store activities
  isOverridden: boolean;        // true nếu lần này được sửa riêng biệt
  isCancelled: boolean;         // true nếu lần này bị bỏ qua / hủy
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}
```

### 4. Store mới: `projectJournalEntries` (Riêng biệt, không nhân bản Notes)
```javascript
if (!db.objectStoreNames.contains('projectJournalEntries')) {
  const pjeStore = db.createObjectStore('projectJournalEntries', { keyPath: 'id' });
  pjeStore.createIndex('projectId', 'projectId', { unique: false });
  pjeStore.createIndex('date', 'date', { unique: false });
  pjeStore.createIndex('createdAt', 'createdAt', { unique: false });
}
```
**Mô hình dữ liệu:**
```typescript
interface ProjectJournalEntry {
  id: string;               // 'pje_...'
  projectId: string;        // ID dự án liên kết (bắt buộc)
  title: string;            // Tiêu đề bài viết nhật ký tiến độ
  content: string;          // Nội dung chi tiết tiến độ, giải pháp kỹ thuật
  date: string;             // 'YYYY-MM-DD'
  category?: string;        // 'Milestone' | 'Technical' | 'BugFix' | 'Meeting' | 'Review'
  keyResults?: string;      // Kết quả kỹ thuật đạt được
  challenges?: string;      // Trở ngại & khó khăn
  nextSteps?: string;       // Bước đi tiếp theo
  linkedActivityIds?: string[]; // Danh sách ID các hoạt động trong Timeline gắn với bài này
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}
```

### 5. Bổ sung Indexes vào các Store hiện có (Non-destructive)
```javascript
if (event.oldVersion < 2) {
  // 1. activities
  const actStore = tx.objectStore('activities');
  if (!actStore.indexNames.contains('projectId')) {
    actStore.createIndex('projectId', 'projectId', { unique: false });
  }
  if (!actStore.indexNames.contains('recurrenceRuleId')) {
    actStore.createIndex('recurrenceRuleId', 'recurrenceRuleId', { unique: false });
  }

  // 2. notes
  const noteStore = tx.objectStore('notes');
  if (!noteStore.indexNames.contains('projectId')) {
    noteStore.createIndex('projectId', 'projectId', { unique: false });
  }

  // 3. timerSessions
  const timerStore = tx.objectStore('timerSessions');
  if (!timerStore.indexNames.contains('projectId')) {
    timerStore.createIndex('projectId', 'projectId', { unique: false });
  }
  if (!timerStore.indexNames.contains('type')) {
    timerStore.createIndex('type', 'type', { unique: false });
  }
}
```

---

## III. CHUẨN HÓA ACTUAL DURATION PROVENANCE & BẢO TOÀN DỮ LIỆU CŨ

### 1. Phân loại nguồn gốc dữ liệu thực tế (Data Provenance)
Tuyệt đối không được mặc định một Activity có trạng thái `Completed` hay điều kiện `actualDurationMinutes !== durationMinutes` là đồng nghĩa với việc dữ liệu đã được xác minh thực tế. Dữ liệu thời gian được phân loại thành 4 nguồn gốc tường minh:

```typescript
type ActualDurationSource = 
  | 'timer_verified'      // Có phiên bấm giờ thực tế trong timerSessions
  | 'manual_verified'     // Có bằng chứng người dùng chủ động nhập hoặc xác nhận thủ công
  | 'legacy_unverified'   // Dữ liệu cũ kế thừa từ V1 không có bằng chứng nguồn
  | 'unperformed';        // Hoạt động chưa diễn ra (Planned), thời gian thực tế = 0
```

### 2. Tiêu chí xác định nguồn gốc nghiêm ngặt (Strict Provenance Rules):

1. **`timer_verified` (Ưu tiên cao nhất):**
   - Tồn tại ít nhất 1 bản ghi trong `timerSessions` có `activityId === a.id` và `status === 'completed'` với `totalSeconds > 0`.
   - `actualDurationSeconds` = tổng số `totalSeconds` của các phiên hoàn tất.
   - `actualDurationMinutes = Math.round(actualDurationSeconds / 60)`.
   - `actualDurationSource = 'timer_verified'`.

2. **`manual_verified` (Đòi hỏi bằng chứng người dùng chủ động xác nhận):**
   - **Quy tắc bắt buộc:** Không được nhận diện `manual_verified` chỉ bằng điều kiện `actualDurationMinutes !== durationMinutes`.
   - **Bằng chứng hợp lệ:** Bản ghi phải có cờ xác nhận chủ động của người dùng, bao gồm:
     - Trường `manuallyConfirmed === true`, hoặc
     - Trường `manualEntry === true`, hoặc
     - Trường `source === 'manual'`, hoặc
     - Có phiên trong `timerSessions` thuộc loại `type === 'manual'` do người dùng tự nhập.
   - Khi có bằng chứng:
     - `actualDurationSeconds = a.actualDurationMinutes * 60`.
     - `actualDurationSource = 'manual_verified'`.

3. **`legacy_unverified` (Dữ liệu cũ không rõ bằng chứng - Giữ nguyên bảo toàn):**
   - Nếu bản ghi từ V1 có `actualDurationMinutes` (bất kể bằng hay khác `durationMinutes`) nhưng **KHÔNG** có phiên Timer Session và **KHÔNG** có bằng chứng cờ xác nhận thủ công tường minh:
     - **Tuyệt đối không xóa hoặc ghi đè số phút cũ.**
     - Gán `actualDurationSeconds = (Number(a.actualDurationMinutes) || 0) * 60`.
     - Gán `actualDurationSource = 'legacy_unverified'`.
     - **Quy tắc tính toán thời gian:** Không để dữ liệu `legacy_unverified` được tính chung vào tổng thời gian thực tế đã xác minh (**Verified Actual Time**).
     - Trong thống kê: Phân tách rõ thành 2 chỉ số riêng biệt:
       - `Verified Actual Time` = tổng thời gian của `timer_verified` + `manual_verified`.
       - `Unverified Legacy Time` = tổng thời gian của `legacy_unverified` (kèm nhãn chú thích dữ liệu ước tính cũ).

4. **`unperformed` (Hoạt động chưa thực hiện):**
   - Nếu `a.status === 'Planned'` và không có phiên timer session nào:
     - Gán `actualDurationSeconds = 0`.
     - Gán `actualDurationMinutes = 0`.
     - Gán `actualDurationSource = 'unperformed'`.

### 3. Tương thích ngược (Backward Compatibility):
- Trường `actualDurationMinutes` tiếp tục được duy trì song song trong tất cả các bản ghi.
- Mọi logic cũ đọc `a.actualDurationMinutes` vẫn hoạt động bình thường mà không bị crash. Logic mới sẽ ưu tiên `a.actualDurationSeconds` để đạt độ chính xác cao nhất.
- Tuyệt đối không cộng trùng thời gian giữa `timerSessions` và thời gian nhập thủ công.

---

## IV. CƠ CHẾ GIAO DỊCH ATOMIC CHO BACKUP & RESTORE TRÊN 10 OBJECT STORES

### 1. Phân biệt rõ hai tầng bảo vệ:
- **Tầng 1 (IndexedDB Engine Transaction Rollback):** Đảm bảo tính nguyên tử (Atomicity) ở cấp độ cơ sở dữ liệu. Toàn bộ thao tác ghi/xóa phải nằm trong cùng một transaction. Nếu có bất kỳ ngoại lệ hoặc lỗi dữ liệu nào phát sinh, IndexedDB engine tự động hoàn tác toàn bộ thay đổi.
- **Tầng 2 (Application In-Memory Snapshot Backup):** Bản chụp toàn bộ 10 Object Stores được lưu tạm trong bộ nhớ RAM của ứng dụng trước khi bắt đầu transaction, giúp khôi phục tức thời nếu transaction bị ngắt kết nối đột ngột từ phía trình duyệt.

### 2. Quy trình Replace chuẩn mực trong 1 Transaction duy nhất:

```
[Bắt đầu Restore File JSON]
       │
       ▼
[1. Deep Schema Validation] ──(Dữ liệu lỗi/thiếu)──► [Báo lỗi chi tiết & Hủy, Không chạm DB]
       │ (Hợp lệ 100%)
       ▼
[2. Snapshot In-Memory Backup] (Lưu bản chụp hiện tại của cả 10 Object Stores)
       │
       ▼
[3. Mở duy nhất 1 Single readwrite Transaction qua CẢ 10 OBJECT STORES]
       tx = db.transaction([
         'activities', 'dailyNotes', 'notes', 'goals', 'timerSessions', 
         'settings', 'projects', 'recurrenceRules', 'recurrenceOccurrences', 
         'projectJournalEntries'
       ], 'readwrite')
       │
       ├──► Trong cùng transaction: clearStore() tuần tự cho cả 10 stores
       │
       ├──► Trong cùng transaction: put() từng bản ghi đã qua xác thực vào từng store
       │
       ▼
[4. Lắng nghe kết quả Transaction]
    ├─── tx.oncomplete ──► Thông báo Phục hồi Thành công & Phát sự kiện cập nhật UI
    │
    └─── tx.onerror / tx.onabort ──► IndexedDB Engine tự động ROLLBACK hoàn toàn.
                                    Ứng dụng khôi phục Snapshot bộ nhớ nếu cần thiết.
```

> **QUY TẮC BẮT BUỘC:** Tuyệt đối không mở các transaction riêng biệt cho từng thao tác `clear` rồi mới mở transaction khác để `add`. Tất cả phải nằm trong **CÙNG MỘT TRANSACTION READWRITE DUY NHẤT** trên toàn bộ 10 stores.

---

## V. MÔ HÌNH OCCURRENCE VÀ QUY TẮC LỊCH LẶP BỀN VỮNG (RECURRING SCHEDULE)

### 1. Kiến trúc phân tách Rule và Occurrence
Hệ thống không sinh trước hàng nghìn bản ghi làm tràn bộ nhớ. Thay vào đó, áp dụng mô hình định danh tất định và lưu trữ bền vững trong `recurrenceOccurrences`:

- Khóa định danh: `occurrenceId = 'occ_${ruleId}_${date}'` (Ví dụ: `occ_rec_abc123_2026-11-25`).
- Mỗi khi cần hiển thị trên Timeline trong khoảng ngày hiển thị (viewport 7 - 30 ngày), hệ thống kiểm tra sự tồn tại của `occurrenceId` trực tiếp trong Object Store `recurrenceOccurrences`.

### 2. Cơ chế chống tạo trùng bền vững sau khi reload và mở nhiều tab:
- **Không chỉ kiểm tra trong bộ nhớ:** Nếu chỉ lưu cache trong memory hoặc `Set`, khi người dùng nhấn F5/reload hoặc mở cùng lúc 2 tab trình duyệt, hai luồng độc lập sẽ cùng sinh hoạt động trùng lặp cho cùng một ngày.
- **Giải pháp bảo vệ bằng IndexedDB Persistence:**
  1. Store `recurrenceOccurrences` sử dụng `occurrenceId` làm khóa chính (`keyPath`) và có unique index `occurrenceId`.
  2. Khi sinh lịch cho ngày `D`, hệ thống thực hiện kiểm tra bản ghi trong store `recurrenceOccurrences`.
  3. Nếu bản ghi đã tồn tại: Hệ thống dùng lại `generatedActivityId` đã lưu, tuyệt đối không tạo thêm bản ghi `activity` mới.
  4. Nếu mở 2 tab cùng lúc và cả hai cùng cố gắng chèn: Nhờ ràng buộc khóa chính của IndexedDB, tab thứ hai sẽ gặp lỗi vi phạm khóa duy nhất (`ConstraintError`), giao dịch của tab thứ hai bị hủy an toàn và tab đó sẽ đọc lại bản ghi vừa được tab thứ nhất tạo thành công.

### 3. Quy tắc Edit Single Occurrence (Bảo toàn quan hệ nguồn):
Khi người dùng chọn "Chỉnh sửa chỉ lần này" (Edit Single Occurrence) tại ngày `D`:
- Activity sinh ra tại ngày `D` được cập nhật các thuộc tính riêng (thay đổi giờ, tiêu đề, mô tả...).
- Bản ghi `recurrenceOccurrences` tương ứng được cập nhật:
  - `isOverridden = true`.
  - `updatedAt = ISO 8601`.
  - **GIỮ NGUYÊN `recurrenceRuleId`** và `originalDate`.
- Hoạt động trong `activities` vẫn lưu trường `recurrenceRuleId` và cờ `isOccurrenceOverridden: true`.
- **Ý nghĩa kiến trúc:** Không làm mất quan hệ với recurrence rule gốc. Khi người dùng xem lịch sử chuỗi hoặc báo cáo dự án, hệ thống vẫn nhận diện chính xác lần lặp này bắt nguồn từ quy tắc nào, đồng thời cờ `isOverridden = true` bảo vệ bản ghi khỏi việc bị ghi đè khi quy tắc gốc bị cập nhật ("Edit All Future Occurrences").

### 4. Quy tắc Bỏ qua ngày (Skip/Cancel Occurrence):
- Khi người dùng chọn "Bỏ qua lần này":
  - Bản ghi `recurrenceOccurrences` cập nhật `isCancelled = true`.
  - Nếu đã có activity tương ứng được sinh ra, activity đó sẽ được đánh dấu `status = 'Cancelled'` hoặc xóa an toàn.
  - Ngày `D` được ghi nhận để không bao giờ tự động tái sinh lại.

### 5. Quy tắc Sửa toàn bộ chuỗi (Edit All Future Occurrences):
- Cập nhật bản mẫu `activityTemplate` trong `recurrenceRules`.
- Cập nhật các activity tương lai thuộc chuỗi mà có `isOverridden === false`. Các lần lặp đã có `isOverridden === true` được bảo vệ nguyên vẹn.

---

## VI. PHÂN BIỆT 5 TẦNG KIẾN TRÚC TRONG GIAI ĐOẠN 1

Nhằm bảo đảm tính minh bạch và kỷ luật kỹ thuật, việc nâng cấp được phân định rành mạch qua 5 tầng. **Giai đoạn 1 chỉ tập trung vào Tầng 1 và Tầng 2**, tuyệt đối không báo cáo tính năng đã hoàn thành khi các tầng trên chưa được triển khai:

| Tầng kiến trúc | Vai trò & Trách nhiệm | Triển khai trong Giai đoạn 1 |
| :--- | :--- | :---: |
| **1. Database Schema** | Định nghĩa 10 Object Stores, cấu hình indexes, viết cursor migration dữ liệu V1 ➔ V2 an toàn | **HOÀN THÀNH TRONG GĐ 1** |
| **2. Repository** | Cung cấp các thao tác CRUD cơ bản nguyên tử trên từng Object Store (`getById`, `getAll`, `put`, `delete`) | **HOÀN THÀNH TRONG GĐ 1** |
| **3. Service** | Xử lý logic nghiệp vụ phức tạp: tính toán window occurrence, giải quyết xung đột, Pomodoro timer, dự án | *Thuộc Giai đoạn 2 & 3* |
| **4. Business Logic** | Điều phối tương tác giữa các service, quản lý state toàn cục, đồng bộ các dòng chảy dữ liệu | *Thuộc Giai đoạn 2 & 3* |
| **5. UI Components** | Giao diện người dùng: Timeline, Modal, Widgets, Sidebar, Trang Focus, Trang Projects | *Thuộc Giai đoạn 2, 3, 4* |

> **LƯU Ý NGHIÊM NGẶT:** Việc tạo Object Store `projects`, `recurrenceRules`, `recurrenceOccurrences`, và `projectJournalEntries` trong Giai đoạn 1 chỉ phục vụ việc sẵn sàng về mặt cấu trúc lưu trữ và đảm bảo di chuyển schema một lần duy nhất. Không được báo cáo tính năng Lịch lặp hoặc Hồ sơ dự án đã hoàn thành khi Tầng Service và Tầng UI chưa được xây dựng.

---

## VII. BỘ TEST CASES MỞ RỘNG CHO MIGRATION VÀ DATA INTEGRITY (18 TEST SCENARIOS)

| Mã Test | Kịch bản kiểm thử | Tiêu chí nghiệm thu |
| :--- | :--- | :--- |
| **MIG-01** | Database V1 rỗng nâng cấp lên V2 | Tạo đủ 10 stores, `DB_VERSION = 2`, không phát sinh exception. |
| **MIG-02** | Database V1 có đầy đủ dữ liệu 6 stores cũ | Toàn bộ số lượng bản ghi của 6 store cũ được bảo toàn 100%. |
| **MIG-03** | Hoạt động trạng thái `Planned` không có timer | `actualDurationSeconds = 0`, `actualDurationMinutes = 0`, `actualDurationSource = 'unperformed'`. |
| **MIG-04** | Hoạt động `Completed` có timerSessions | `actualDurationSeconds` = tổng số giây từ timer, `actualDurationSource = 'timer_verified'`. |
| **MIG-05** | Hoạt động có bằng chứng nhập thủ công tường minh | Có cờ `manuallyConfirmed` hoặc `source === 'manual'`, `actualDurationSource = 'manual_verified'`. |
| **MIG-06** | Hoạt động cũ không có bằng chứng nguồn | `actualDurationMinutes` giữ nguyên không đổi, gắn cờ `actualDurationSource = 'legacy_unverified'`. |
| **MIG-07** | Phân tách Verified Actual Time vs Legacy | Dữ liệu `legacy_unverified` KHÔNG được cộng vào `Verified Actual Time`. |
| **MIG-08** | Không cộng trùng Timer và Manual | Nguồn thời gian được xác định độc lập, không cộng dồn hai lần giữa session và manual. |
| **MIG-09** | Lỗi bất ngờ khi nâng cấp store | Transaction bị abort, DB giữ nguyên version 1, dữ liệu không biến dạng. |
| **MIG-10** | Nhiều tab trình duyệt cùng mở khi upgrade | Xử lý `onversionchange` đóng kết nối tab cũ an toàn, `onblocked` phát cảnh báo rõ ràng. |
| **MIG-11** | Chống tạo trùng Occurrence sau Reload | Sau khi reload trình duyệt / re-init DB, truy vấn `recurrenceOccurrences` không sinh trùng `occurrenceId`. |
| **MIG-12** | Chống tạo trùng Occurrence giữa hai tab đồng thời | Hai transaction ghi cùng một `occurrenceId`, nhờ unique index chỉ 1 bản ghi duy nhất được tạo thành công. |
| **MIG-13** | Sửa một lần lặp (Edit Single Occurrence) | Cập nhật `isOverridden = true`, nhưng GIỮ NGUYÊN `recurrenceRuleId` và `originalDate`. |
| **MIG-14** | Tạo Project mới và liên kết Activity | Activity truy vấn được qua index `projectId`, không mất các trường dữ liệu V1. |
| **MIG-15** | Tạo Project Journal Entry độc lập | Entry lưu vào `projectJournalEntries`, không ảnh hưởng tới `notes` hay `dailyNotes`. |
| **MIG-16** | Xóa Project có cảnh báo an toàn | Không xóa mồ côi activities liên quan; hỗ trợ tùy chọn hủy liên kết dự án an toàn. |
| **MIG-17** | Replace Backup nguyên tử trên cả 10 stores | Toàn bộ 10 store được `clear` và `put` trong duy nhất 1 transaction readwrite; rollback 100% nếu có lỗi. |
| **MIG-18** | Export Backup JSON phiên bản 2.0.0 | File JSON xuất ra chứa đầy đủ dữ liệu của toàn bộ 10 Object Stores và thông tin phiên bản hợp lệ. |
