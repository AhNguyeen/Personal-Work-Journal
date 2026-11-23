# 🗄️ DATABASE MIGRATION SPECIFICATION: V1 ➔ V2
> **Chi tiết thiết kế di chuyển cơ sở dữ liệu IndexedDB, phân loại dữ liệu thực tế và đảm bảo toàn vẹn**  
> **Cơ sở dữ liệu:** `PersonalWorkJournalDB`  
> **Phiên bản cũ:** `1` ➔ **Phiên bản mới:** `2`

---

## I. TỔNG QUAN DANH SÁCH 9 OBJECT STORES TRONG V2

Hệ thống nâng cấp từ 6 Object Stores lên **9 Object Stores**. Tất cả 6 store cũ được bảo toàn 100% dữ liệu và khóa:

| STT | Tên Object Store | Tình trạng trong V2 | Mục đích nghiệp vụ | Khóa chính (keyPath) |
| :---: | :--- | :---: | :--- | :--- |
| 1 | `activities` | **Giữ nguyên & Mở rộng** | Lịch trình công việc thực tế theo ngày | `id` |
| 2 | `dailyNotes` | **Giữ nguyên (Bảo toàn)** | Nhật ký phản tư tổng hợp theo ngày | `id` |
| 3 | `notes` | **Giữ nguyên & Mở rộng** | Kho ghi chú chi tiết nhiều bản ghi | `id` |
| 4 | `goals` | **Giữ nguyên (Bảo toàn)** | Mục tiêu giờ làm việc/học tập | `id` |
| 5 | `timerSessions` | **Giữ nguyên & Mở rộng** | Lịch sử các phiên bấm giờ thực tế | `id` |
| 6 | `settings` | **Giữ nguyên (Bảo toàn)** | Cài đặt hệ thống, theme, active timer | `key` |
| 7 | `projects` | **MỚI (Giai đoạn 3)** | Quản lý hồ sơ dự án cá nhân | `id` |
| 8 | `recurrenceRules` | **MỚI (Giai đoạn 2)** | Quản lý các quy tắc lịch lặp lại định kỳ | `id` |
| 9 | `projectJournalEntries`| **MỚI (Giai đoạn 3)** | Nhật ký tiến độ và giải pháp của dự án | `id` |

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
  icon: string;             // Tên icon đại diện
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
  excludedDates?: string[]; // Các ngày bị bỏ qua (skip occurrence)
  createdAt: string;
  updatedAt: string;
}
```

### 3. Store mới: `projectJournalEntries` (Riêng biệt, không nhân bản Notes)
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
  title: string;            // Tiêu đề bài viết nhật ký
  content: string;          // Nội dung chi tiết tiến độ
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

### 4. Bổ sung Indexes vào các Store hiện có (Non-destructive)
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

## III. CHUẨN HÓA ACTUAL DURATION & PHÂN LOẠI DỮ LIỆU CŨ (DATA INTEGRITY)

### 1. Phân loại mức độ tin cậy của dữ liệu (Data Provenance & Reliability)
Không được mặc định rằng một Activity có trạng thái `Completed` thì `actualDurationMinutes` là số liệu thực tế tin cậy. Dữ liệu được phân thành 3 cấp độ:

```typescript
type ActualDurationSource = 
  | 'timer_verified'      // Có phiên bấm giờ thực tế trong timerSessions
  | 'manual_verified'     // Do người dùng chủ động nhập thủ công và xác nhận
  | 'legacy_unverified'   // Dữ liệu cũ tự động copy từ durationMinutes
  | 'unperformed';        // Hoạt động chưa diễn ra (Planned), thời gian = 0
```

### 2. Quy tắc đối soát và di chuyển trong Migration:
Duyệt cursor qua toàn bộ store `activities` trong migration version 2:

1. **Ưu tiên 1 (Timer Verified):**
   - Truy vấn tất cả phiên có `activityId === a.id` và `status === 'completed'` trong `timerSessions`.
   - Nếu có ít nhất 1 phiên hợp lệ:
     - `actualDurationSeconds = sum(session.totalSeconds)`.
     - `actualDurationSource = 'timer_verified'`.
     - `actualDurationMinutes = Math.round(actualDurationSeconds / 60)`.
2. **Ưu tiên 2 (Manual Verified):**
   - Nếu không có timer session nhưng trước đây người dùng đã ghi nhận thời gian thủ công (hoặc `actualDurationMinutes` khác biệt với `durationMinutes`):
     - `actualDurationSeconds = a.actualDurationMinutes * 60`.
     - `actualDurationSource = 'manual_verified'`.
3. **Ưu tiên 3 (Legacy Unverified - Bảo toàn không xóa):**
   - Nếu `a.status === 'Completed'` và `a.actualDurationMinutes === a.durationMinutes` mà không có timer session nào ghi nhận:
     - **Không xóa số phút cũ.**
     - Gán `actualDurationSeconds = a.actualDurationMinutes * 60`.
     - Gắn cờ `actualDurationSource = 'legacy_unverified'`.
     - Trong báo cáo thống kê, số liệu này sẽ được gắn nhãn chú thích để người dùng nhận biết đây là số liệu ước tính cũ.
4. **Ưu tiên 4 (Unperformed):**
   - Nếu `a.status === 'Planned'` và không có timer session:
     - Gán `actualDurationSeconds = 0`.
     - `actualDurationMinutes = 0`.
     - `actualDurationSource = 'unperformed'`.

### 3. Tương thích ngược (Backward Compatibility):
- Giữ nguyên trường `actualDurationMinutes` trong tất cả các record.
- Mọi logic cũ đọc `a.actualDurationMinutes` tiếp tục chạy bình thường, trong khi logic mới sẽ ưu tiên `a.actualDurationSeconds` để đạt độ chính xác đến từng giây.

---

## IV. CƠ CHẾ GIAO DỊCH ATOMIC CHO BACKUP & RESTORE

### 1. Phân biệt rõ hai tầng bảo vệ:
- **Tầng 1 (IndexedDB Engine Transaction Rollback):** Đảm bảo tính nguyên tử (Atomicity) trong phiên ghi cơ sở dữ liệu. Nếu có lỗi xảy ra, toàn bộ thay đổi tự động bị đảo ngược (rollback) về trạng thái trước đó.
- **Tầng 2 (Application-level In-Memory Snapshot Backup):** Bản chụp dữ liệu đầy đủ được lưu tạm vào bộ nhớ ứng dụng trước khi thực thi Replace, hỗ trợ phục hồi độc lập nếu transaction gặp sự cố bất ngờ.

### 2. Quy trình Replace chuẩn mực trong 1 Transaction duy nhất:

```
[Bắt đầu Import]
       │
       ▼
[1. Deep Schema Validation] ──(Không hợp lệ)──► [Báo lỗi & Dừng, Giữ nguyên DB]
       │ (Hợp lệ)
       ▼
[2. Snapshot Backup In-Memory] (Lưu trữ toàn bộ 9 stores vào bộ nhớ tạm)
       │
       ▼
[3. Mở 1 Single readwrite Transaction duy nhất]
       tx = db.transaction([activities, dailyNotes, notes, goals, timerSessions, 
                            settings, projects, recurrenceRules, projectJournalEntries], 'readwrite')
       │
       ├──► Trong cùng 1 transaction: clearStore() cho cả 9 stores
       │
       ├──► Trong cùng 1 transaction: put() từng bản ghi hợp lệ vào từng store
       │
       ▼
[4. Lắng nghe kết quả Transaction]
   ├─── tx.oncomplete ──► Thông báo Thành công & Cập nhật UI
   │
   └─── tx.onerror / tx.onabort ──► Tự động ROLLBACK về dữ liệu cũ, khôi phục Snapshot nếu cần
```

> **QUY TẮC BẮT BUỘC:** Tuyệt đối không mở các transaction riêng biệt cho từng thao tác `clear` rồi mới mở transaction khác để `add`. Tất cả phải nằm trong **CÙNG MỘT TRANSACTION DUY NHẤT**.

---

## V. MÔ HÌNH OCCURRENCE VÀ QUY TẮC LỊCH LẶP (RECURRING SCHEDULE)

Để tránh sinh ra hàng nghìn bản ghi làm phình to IndexedDB, hệ thống áp dụng mô hình **Quy tắc lặp (Rule) + Lần xuất hiện định danh (Occurrence)**:

```typescript
interface ScheduleOccurrence {
  occurrenceId: string;         // 'occ_${ruleId}_${date}' (Định danh tất định)
  recurrenceRuleId: string;     // Liên kết với recurrenceRules.id
  originalDate: string;         // 'YYYY-MM-DD' (Ngày lịch dự kiến)
  generatedActivityId?: string; // ID của activity thực tế sinh ra trong Timeline
  isOverridden: boolean;        // true nếu người dùng đã chỉnh sửa riêng lần lặp này
  isCancelled: boolean;         // true nếu người dùng chọn bỏ qua ngày này
}
```

### Các thao tác xử lý nghiệp vụ:
1. **Chống tạo trùng (Idempotency):** Trước khi hiển thị hoặc sinh activity cho ngày `D`, kiểm tra xem `occurrenceId = 'occ_${ruleId}_${D}'` đã tồn tại trong IndexedDB chưa. Nếu đã có thì không sinh mới.
2. **Sửa một lần (Edit Single Occurrence):** 
   - Tách lần xuất hiện tại ngày `D` thành một Activity độc lập (`recurrenceRuleId = null`).
   - Đánh dấu `isOverridden = true` cho `occurrenceId` đó để quy tắc gốc không ghi đè lại.
3. **Bỏ qua một ngày (Skip/Exclude Date):**
   - Thêm ngày `D` vào mảng `rule.excludedDates`.
   - Nếu đã sinh Activity cho ngày đó thì xóa Activity đó đi.
4. **Sửa toàn bộ chuỗi (Edit All Occurrences):**
   - Cập nhật trường `activityTemplate` trong `recurrenceRules`.
   - Các lần xuất hiện trong tương lai chưa bị `isOverridden` sẽ tự động cập nhật theo mẫu mới.
5. **Xóa chuỗi lặp (Delete Series):**
   - Xóa `recurrenceRules` tương ứng.
   - Xóa các hoạt động trong tương lai được sinh từ chuỗi này mà chưa hoàn thành (`status !== 'Completed'`). Giữ nguyên các hoạt động trong quá khứ đã hoàn tất để bảo tồn lịch sử.

---

## VI. BỘ TEST CASES BẮT BUỘC CHO MIGRATION (12 TEST SCENARIOS)

| Test Case ID | Kịch bản kiểm thử | Kỳ vọng nghiệm thu |
| :--- | :--- | :--- |
| **MIG-01** | Database V1 rỗng nâng cấp lên V2 | Tạo đủ 9 stores, version = 2, không có lỗi runtime. |
| **MIG-02** | Database V1 có đầy đủ dữ liệu 6 stores cũ | Toàn bộ record count của 6 store cũ giữ nguyên 100%. |
| **MIG-03** | Hoạt động trạng thái `Planned` không có timer | `actualDurationSeconds = 0`, `actualDurationSource = 'unperformed'`. |
| **MIG-04** | Hoạt động trạng thái `Completed` có timerSessions | `actualDurationSeconds` = tổng số giây từ timer, `actualDurationSource = 'timer_verified'`. |
| **MIG-05** | Hoạt động có thời gian nhập thủ công | `actualDurationSeconds` = số phút * 60, `actualDurationSource = 'manual_verified'`. |
| **MIG-06** | Hoạt động cũ kế thừa không rõ nguồn | `actualDurationMinutes` giữ nguyên, `actualDurationSource = 'legacy_unverified'`. |
| **MIG-07** | Không cộng trùng Timer và Manual | Nguồn thời gian được xác định độc lập, không cộng dồn hai lần. |
| **MIG-08** | Lỗi xảy ra giữa chừng khi nâng cấp store | Transaction bị abort, DB giữ nguyên version 1, dữ liệu không biến dạng. |
| **MIG-09** | Nhiều tab trình duyệt cùng mở khi upgrade | Xử lý `onversionchange` đóng kết nối tab cũ an toàn, `onblocked` cảnh báo rõ ràng. |
| **MIG-10** | Tạo Project mới và liên kết Activity | Activity truy vấn được theo index `projectId`, không mất trường cũ. |
| **MIG-11** | Tạo Project Journal Entry độc lập | Entry lưu vào `projectJournalEntries`, không ảnh hưởng tới `notes`/`dailyNotes`. |
| **MIG-12** | Export/Import dữ liệu V2 sau migration | File JSON chứa đủ 9 stores, Replace Mode chạy trong 1 transaction an toàn. |
