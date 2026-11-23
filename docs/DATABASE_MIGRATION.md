# 🗄️ DATABASE MIGRATION SPECIFICATION: V1 ➔ V2
> **Chi tiết thiết kế di chuyển cơ sở dữ liệu IndexedDB, phân loại dữ liệu thực tế và đảm bảo toàn vẹn**  
> **Cơ sở dữ liệu:** `PersonalWorkJournalDB`  
> **Phiên bản cũ:** `1` ➔ **Phiên bản mới:** `2`  
> **Nhánh quy chuẩn:** `master`

---

## I. TỔNG QUAN DANH SÁCH 10 OBJECT STORES TRONG V2

Hệ thống nâng cấp từ 6 Object Stores lên **10 Object Stores**. Tất cả 6 store cũ được bảo toàn 100% dữ liệu, cấu trúc và khóa chính:

| STT | Tên Object Store | Tình trạng trong V2 | Mục đích nghiệp vụ | Khóa chính (keyPath) | Giai đoạn triển khai |
| :---: | :--- | :---: | :--- | :--- | :---: |
| 1 | `activities` | **Giữ nguyên & Mở rộng** | Lịch trình công việc thực tế theo ngày | `id` | V1 ➔ V2 (GĐ 1) |
| 2 | `dailyNotes` | **Giữ nguyên (Bảo toàn)** | Nhật ký phản tư tổng hợp theo ngày (1 bản ghi/ngày) | `id` | V1 (GĐ 1) |
| 3 | `notes` | **Giữ nguyên & Mở rộng** | Kho ghi chú chi tiết nhiều bản ghi trong ngày | `id` | V1 ➔ V2 (GĐ 1) |
| 4 | `goals` | **Giữ nguyên (Bảo toàn)** | Mục tiêu giờ làm việc/học tập theo tuần/tháng | `id` | V1 (GĐ 1) |
| 5 | `timerSessions` | **Giữ nguyên & Mở rộng** | Lịch sử các phiên bấm giờ thực tế và log tay | `id` | V1 ➔ V2 (GĐ 1) |
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
> [!NOTE]
> **Tối ưu hóa Index:** Store được cấu hình với `{ keyPath: 'occurrenceId' }`. Vì `occurrenceId` đã là khóa chính nên mặc định đã có ràng buộc duy nhất (Unique Constraint) ở cấp engine IndexedDB. Do đó, **không tạo thêm index `occurrenceId`** nhằm tránh dư thừa chỉ mục và tiết kiệm tài nguyên.
```javascript
if (!db.objectStoreNames.contains('recurrenceOccurrences')) {
  const occStore = db.createObjectStore('recurrenceOccurrences', { keyPath: 'occurrenceId' });
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
  occurrenceId: string;         // 'occ_${recurrenceRuleId}_${originalDate}' (Khóa chính keyPath duy nhất)
  recurrenceRuleId: string;     // Liên kết với recurrenceRules.id (luôn duy trì quan hệ nguồn)
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

## III. CHUẨN HÓA ACTUAL DURATION PROVENANCE: PHÂN BIỆT RÕ RÀNG TIMER THỰC TẾ VÀ NHẬP TAY

### 1. Phân loại 4 nguồn gốc dữ liệu thời gian thực tế
```typescript
type ActualDurationSource = 
  | 'timer_verified'      // Ưu tiên 1: Đo bằng Timer thực tế (Stopwatch / Pomodoro) trong timerSessions
  | 'manual_verified'     // Ưu tiên 2: Nhập tay có bằng chứng (phiên manual trong timerSessions hoặc cờ xác nhận)
  | 'legacy_unverified'   // Ưu tiên 3: Dữ liệu cũ kế thừa từ V1 có số phút > 0 nhưng không rõ bằng chứng nguồn
  | 'unperformed';        // Ưu tiên 4: Hoạt động Planned chưa diễn ra (số phút = 0)
```

### 2. Thứ tự ưu tiên và Quy tắc phân biệt nghiêm ngặt Timer vs Manual:

> [!IMPORTANT]
> **Quy định bắt buộc về phân loại `timerSessions`:**
> Store `timerSessions` chứa cả các phiên bấm giờ thực tế (`type === 'timer'` hoặc `'pomodoro'`) và các phiên người dùng tự log tay (`type === 'manual'`).
> **Phiên `type === 'manual'` trong `timerSessions` là hình thức nhập tay, BẮT BUỘC phân loại thành `manual_verified`, TUYỆT ĐỐI KHÔNG ĐƯỢC phân loại nhầm thành `timer_verified`.**
> Nếu gán nhãn sai, báo cáo nguồn gốc thời gian của hệ thống sẽ mất tính xác thực.

1. **Ưu tiên 1: `timer_verified` (Chỉ dành riêng cho phiên bấm giờ thực tế)**
   - **Điều kiện:** Tồn tại ít nhất 1 phiên trong `timerSessions` có:
     - `activityId === a.id`
     - `status === 'completed'`
     - `totalSeconds > 0`
     - **`type !== 'manual'`** (tức là `type === 'timer'` hoặc `type === 'pomodoro'`).
   - **Hành động:**
     - `actualDurationSeconds` = tổng số `totalSeconds` của các phiên có `type !== 'manual'`.
     - `actualDurationMinutes = Math.round(actualDurationSeconds / 60)`.
     - `actualDurationSource = 'timer_verified'`.

2. **Ưu tiên 2: `manual_verified` (Thời gian nhập tay có bằng chứng xác thực)**
   - **Điều kiện:** KHÔNG có phiên bấm giờ thực tế (`type !== 'manual'`), nhưng thỏa mãn một trong các bằng chứng:
     - **Bằng chứng A:** Tồn tại phiên hoàn tất trong `timerSessions` có `activityId === a.id` và **`type === 'manual'`** (`totalSeconds > 0`).
     - **Bằng chứng B:** Activity có cờ xác nhận chủ động: `manuallyConfirmed === true`, `manualEntry === true`, hoặc `source === 'manual'`.
   - **Quy tắc bắt buộc:** Tuyệt đối không nhận diện `manual_verified` chỉ bằng điều kiện `actualDurationMinutes !== durationMinutes`.
   - **Hành động:**
     - Nếu có phiên `type === 'manual'`: `actualDurationSeconds` = tổng `totalSeconds` của các phiên manual đó.
     - Nếu theo cờ xác nhận: `actualDurationSeconds = (Number(a.actualDurationMinutes) || 0) * 60`.
     - `actualDurationMinutes = Math.round(actualDurationSeconds / 60)`.
     - `actualDurationSource = 'manual_verified'`.

3. **Xử lý hoạt động có cả phiên Timer thực tế và phiên Manual Log:**
   - Nếu một Activity có cả phiên `type === 'timer'` VÀ phiên `type === 'manual'`:
     - Nhãn nguồn gốc chính được gán: `actualDurationSource = 'timer_verified'`.
     - Thời lượng `actualDurationSeconds` = tổng giây của tất cả các phiên hợp lệ (`timer` + `manual`).
     - **Bổ sung metadata bóc tách:** Lưu trữ thuộc tính chi tiết `timerSeconds` (tổng giây bấm giờ) và `manualSeconds` (tổng giây nhập tay) trong Activity để báo cáo thống kê hiển thị minh bạch từng thành phần, **không đánh đồng thời gian manual thành thời gian đo bằng timer thực tế**.

4. **Ưu tiên 3: `legacy_unverified` (Dữ liệu cũ có thời lượng nhưng không có bằng chứng nguồn)**
   - **Áp dụng cho:**
     - Case A: Hoạt động trạng thái `Completed` có `actualDurationMinutes > 0` nhưng không có phiên timer và không có bằng chứng cờ nhập thủ công.
     - Case B: **Hoạt động V1 trạng thái `Planned` nhưng có `actualDurationMinutes > 0` cũ** (do logic phiên bản 1 gán mặc định thời lượng dự kiến vào).
   - **Quy tắc bảo tồn tuyệt đối:**
     - **TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý XÓA HOẶC LÀM MẤT GIÁ TRỊ LỊCH SỬ NÀY.**
     - Giữ nguyên số phút cũ: `actualDurationMinutes = Number(a.actualDurationMinutes)`.
     - Gán `actualDurationSeconds = actualDurationMinutes * 60`.
     - Gán nhãn `actualDurationSource = 'legacy_unverified'`.
   - **Quy tắc tính toán thời gian:**
     - Dữ liệu `legacy_unverified` **tuyệt đối KHÔNG được tính chung** vào tổng thời gian thực tế đã xác minh (**Verified Actual Time**).
     - Trong báo cáo thống kê, số liệu này được tách thành chỉ số riêng biệt: "Thời gian ước tính cũ / Chưa xác minh" (Unverified Legacy Time) kèm chú thích giải thích để bảo vệ tính trung thực của báo cáo hiệu suất.

5. **Ưu tiên 4: `unperformed` (Hoạt động chưa diễn ra)**
   - **Điều kiện:** Activity có trạng thái `status === 'Planned'` VÀ `(Number(a.actualDurationMinutes) || 0) === 0` và không có bất kỳ phiên timer hay manual session nào.
   - **Hành động:**
     - `actualDurationSeconds = 0`.
     - `actualDurationMinutes = 0`.
     - `actualDurationSource = 'unperformed'`.

### 3. Ma trận giải quyết xung đột điều kiện (Conflict Resolution Matrix)

| Trạng thái Activity | Phiên Timer thực tế (`type !== 'manual'`) | Phiên Manual Session (`type === 'manual'`) | Bằng chứng cờ Manual Proof | Số phút cũ `actualDurationMinutes` | Kết quả phân loại (`actualDurationSource`) | Nguồn tính `actualDurationSeconds` | Tính vào Verified Actual Time? |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Completed` | Có (`totalSeconds > 0`) | Có | Bất kỳ | **`timer_verified`** | Tổng giây Timer + Manual (lưu chi tiết `timerSeconds` / `manualSeconds`) | **CÓ** |
| `Completed` | Có (`totalSeconds > 0`) | Không | Bất kỳ | **`timer_verified`** | Tổng giây Timer thực tế | **CÓ** |
| `Completed` | **Không** | **Có (`totalSeconds > 0`)** | Bất kỳ | **`manual_verified`** *(Không nhầm thành timer!)* | Tổng giây phiên Manual | **CÓ** |
| `Completed` | Không | Không | **Có** | `> 0` | **`manual_verified`** | `actualDurationMinutes * 60` | **CÓ** |
| `Completed` | Không | Không | Không | `> 0` | **`legacy_unverified`** | Giữ nguyên: `phút * 60` | **KHÔNG** |
| `Planned` | Có (`totalSeconds > 0`) | Bất kỳ | Bất kỳ | **`timer_verified`** | Tổng giây Timer thực tế | **CÓ** |
| **`Planned` (V1 cũ)** | **Không** | **Không** | **Không** | **`> 0` (số phút cũ)** | **`legacy_unverified`** | **Giữ nguyên: `phút * 60` (Bảo toàn lịch sử)** | **KHÔNG** |
| `Planned` | Không | Không | Không | `=== 0` hoặc rỗng | **`unperformed`** | `0` | **KHÔNG** |

---

## IV. HOÀN THIỆN MÔ HÌNH OCCURRENCE VÀ XỬ LÝ CONSTRAINTERROR KHI MỞ NHIỀU TAB

### 1. Nguyên tắc Giao dịch Nguyên tử (Atomic Transaction Scope)
Việc kiểm tra và tạo Occurrence cùng Activity bắt buộc phải thực hiện trong **CÙNG MỘT TRANSACTION READWRITE** bao gồm cả hai store:
```javascript
const tx = db.transaction(['recurrenceOccurrences', 'activities'], 'readwrite');
const occStore = tx.objectStore('recurrenceOccurrences');
const actStore = tx.objectStore('activities');
```

### 2. Sử dụng `add()` và Cơ chế Xử lý `ConstraintError` chuẩn xác:
Để phát hiện sự cạnh tranh ghi (Race Condition) giữa 2 tab mở đồng thời, hệ thống **bắt buộc sử dụng `occStore.add(occurrenceRecord)`** (thay vì `put()`). 

> [!CAUTION]
> **Vấn đề kỹ thuật với `ConstraintError` trong IndexedDB:**
> Khi một IndexedDB request (như `add()`) phát sinh lỗi `ConstraintError`, theo mặc định sự kiện error sẽ nổi bọt (bubble) lên transaction và khiến transaction **tự động bị abort**. Khi transaction đã abort thì không thể tiếp tục thực thi request đọc nào trên transaction đó.

Hệ thống quy định hai phương án xử lý chuẩn mực, kết hợp chặt chẽ:

#### Phương án 1 (Chính thức): Ngăn lỗi làm abort transaction bằng `event.preventDefault()`
Xử lý sự kiện `onerror` trực tiếp tại request `add()` của Occurrence:
```javascript
const addOccReq = occStore.add(occurrenceRecord);

addOccReq.onerror = (event) => {
  if (event.target.error?.name === 'ConstraintError') {
    // 1. QUAN TRỌNG: Gọi preventDefault() và stopPropagation() để ngăn error nổi bọt lên transaction,
    // giữ cho transaction 'readwrite' tiếp tục hoạt động mà KHÔNG bị auto-abort.
    event.preventDefault();
    event.stopPropagation();
    
    // 2. Vì bản ghi đã được tab kia tạo thành công, tab này KHÔNG tạo thêm Activity mới.
    // 3. Đọc lại bản ghi Occurrence đã tồn tại ngay trong transaction hiện tại:
    const getReq = occStore.get(occurrenceId);
    getReq.onsuccess = () => {
      const existingOcc = getReq.result;
      // Trả về existingOcc.generatedActivityId để UI sử dụng lại Activity có sẵn.
    };
  }
};

addOccReq.onsuccess = () => {
  // Bản ghi Occurrence được tạo thành công lần đầu -> Tiến hành tạo Activity tương ứng trong cùng transaction:
  const newActivity = createActivityFromTemplate(rule, date, occurrenceId);
  actStore.add(newActivity);
};
```

#### Phương án 2 (Dự phòng chuẩn mực): Mở Transaction mới khi Transaction đã Abort
Nếu engine trình duyệt vẫn tự động abort transaction khi gặp `ConstraintError` (hoặc trong trường hợp transaction bị đóng do timeout):
```javascript
tx.onabort = async (event) => {
  // Bắt sự kiện abort do ConstraintError gây ra:
  if (tx.error?.name === 'ConstraintError' || isConstraintConflict) {
    // Không báo lỗi crash hệ thống.
    // Mở ngay một transaction 'readonly' mới để đọc lại bản ghi đã được tab kia tạo thành công:
    const readTx = db.transaction('recurrenceOccurrences', 'readonly');
    const existingOcc = await readTx.objectStore('recurrenceOccurrences').get(occurrenceId);
    if (existingOcc && existingOcc.generatedActivityId) {
      // Tái sử dụng Activity của tab kia, đảm bảo 0 activity trùng lặp.
      return existingOcc.generatedActivityId;
    }
  }
};
```

**Kết quả nghiệm thu:** Dù triển khai theo Phương án 1 hay Phương án 2, hệ thống **tuyệt đối không bao giờ tạo Activity trùng lặp giữa hai tab** và không để lộ lỗi crash ra giao diện người dùng.

### 3. Quy tắc Edit Single Occurrence (Bảo toàn trọn vẹn quan hệ nguồn):
Khi người dùng chọn "Chỉnh sửa chỉ lần này" (Edit Single Occurrence) tại ngày `D`:
- Activity tương ứng trong store `activities` được cập nhật các thuộc tính riêng (thay đổi giờ, tiêu đề, mô tả...).
- Bản ghi trong store `recurrenceOccurrences` tương ứng được cập nhật:
  - **`recurrenceRuleId`:** **GIỮ NGUYÊN** (bảo toàn quan hệ nguồn với quy tắc lặp).
  - **`originalDate`:** **GIỮ NGUYÊN** (bảo toàn ngày lịch ban đầu).
  - **`generatedActivityId`:** **GIỮ NGUYÊN** (vẫn trỏ đúng Activity đó).
  - **`isOverridden = true`** (đánh dấu đã được chỉnh sửa độc lập).
  - **`updatedAt = ISO 8601`**.
- Trong Activity: giữ nguyên `recurrenceRuleId`, giữ nguyên `occurrenceId`, và đánh dấu `isOccurrenceOverridden: true`.
- **Ý nghĩa kiến trúc:** Lần lặp này vẫn thuộc về chuỗi nguồn trong các báo cáo tiến độ, nhưng cờ `isOverridden = true` bảo vệ bản ghi khỏi việc bị ghi đè khi quy tắc gốc bị cập nhật ("Edit All Future Occurrences").

---

## V. CƠ CHẾ GIAO DỊCH ATOMIC CHO BACKUP & RESTORE TRÊN 10 OBJECT STORES

### 1. Phân biệt rõ hai tầng bảo vệ và Giới hạn của RAM Snapshot:
- **Tầng 1 (IndexedDB Engine Transaction Rollback - CỐT LÕI & DUY NHẤT ĐÁNG TIN CẬY):**
  - Mọi thao tác `clear` và `put` của cả 10 Object Stores đều diễn ra trong 1 transaction `readwrite` duy nhất.
  - Khi có lỗi hoặc người dùng hủy, IndexedDB engine đảm bảo tính ACID, rollback toàn bộ trạng thái cơ sở dữ liệu trên ổ đĩa về trước phiên làm việc.
- **Tầng 2 (Application In-Memory Snapshot Backup - CHỈ LÀ BIỆN PHÁP HỖ TRỢ):**
  - Bản chụp dữ liệu trong RAM chỉ là lớp hỗ trợ ở tầng ứng dụng JavaScript để hoàn tác nhanh trong phiên làm việc còn sống.
  - **LƯU Ý KỸ THUẬT:** Snapshot trong RAM **KHÔNG THỂ BẢO ĐẢM KHÔI PHỤC** nếu tab trình duyệt bị crash, tiến trình bị tắt đột ngột (killed) hoặc mất điện trong lúc đang ghi. Vì vậy, sự an toàn toàn vẹn dữ liệu phải dựa hoàn toàn vào tính nguyên tử của Transaction IndexedDB.

### 2. Quy tắc Không có khoảng trễ Bất đồng bộ (No Async Gap in Transaction):
> [!CAUTION]
> **Quy tắc sống còn của IndexedDB:** Trình duyệt sẽ tự động commit và đóng transaction (`auto-commit`) ngay khi hàng đợi sự kiện (event loop) quay lại mà không còn request IndexedDB nào đang chờ.
> **TUYỆT ĐỐI KHÔNG ĐƯỢC** thực hiện các thao tác bất đồng bộ như `await fetch()`, `await new Promise(...)`, `setTimeout` hoặc đọc file async ở giữa các câu lệnh của transaction.

### 3. Quy trình Replace chuẩn mực:

```
[Nhận file Backup JSON]
       │
       ▼
[1. Deep Schema Validation] ──(Lỗi cấu trúc/dữ liệu)──► [Báo lỗi chi tiết & DỪNG NGAY. Không mở DB]
       │ (Hợp lệ 100%)
       ▼
[2. Chuẩn bị trước toàn bộ mảng dữ liệu trong RAM] (Bóc tách dữ liệu 10 stores thành mảng sẵn sàng)
       │
       ▼
[3. Mở duy nhất 1 Single readwrite Transaction qua CẢ 10 OBJECT STORES]
       tx = db.transaction([
         'activities', 'dailyNotes', 'notes', 'goals', 'timerSessions', 
         'settings', 'projects', 'recurrenceRules', 'recurrenceOccurrences', 
         'projectJournalEntries'
       ], 'readwrite')
       │
       ├──► Gọi đồng bộ liên tục: tx.objectStore(name).clear() cho cả 10 stores
       │
       ├──► Gọi đồng bộ liên tục: tx.objectStore(name).put(item) cho toàn bộ bản ghi
       │
       ▼
[4. Xác định kết quả qua các sự kiện giao dịch]
    ├─── tx.oncomplete ──► Toàn bộ 10 store đã ghi bền vững vào đĩa.
    │                      Phát sự kiện cập nhật UI & thông báo Thành công cho người dùng.
    │
    ├─── tx.onerror ─────► Giao dịch phát sinh lỗi (I/O, quota, constraint...).
    │                      Gọi tx.abort() (nếu chưa tự abort).
    │
    └─── tx.onabort ─────► Toàn bộ thay đổi của cả 10 store bị hủy bỏ hoàn toàn.
                           Dữ liệu tự động quay về trạng thái ban đầu trước khi Restore.
```

---

## VI. PHÂN ĐỊNH 5 TẦNG KIẾN TRÚC TRONG GIAI ĐOẠN 1

| Tầng kiến trúc | Vai trò | Phạm vi triển khai trong Giai đoạn 1 |
| :--- | :--- | :---: |
| **1. Database Schema** | Tạo 10 Object Stores, cấu hình indexes chuẩn (bỏ index trùng keyPath), cursor migration V1 ➔ V2 an toàn | **HOÀN THÀNH 100% TRONG GĐ 1** |
| **2. Repository** | Cung cấp CRUD nguyên tử cơ bản cho 10 stores độc lập | **HOÀN THÀNH 100% TRONG GĐ 1** |
| **3. Service** | Business logic: tính occurrence window, pomodoro cycles, project progress | *Thuộc Giai đoạn 2 và 3* |
| **4. Business Logic** | Điều phối luồng dữ liệu liên service, state toàn cục | *Thuộc Giai đoạn 2 và 3* |
| **5. UI Components** | Giao diện Timeline, Modal, Widgets, Focus Page, Projects Page | *Thuộc Giai đoạn 2, 3, 4* |

> **Cam kết:** Giai đoạn 1 chỉ bàn giao Database Schema (10 stores) và Repositories nền tảng, cùng với cơ chế toàn vẹn dữ liệu và vá lỗi XSS. Tuyệt đối không báo cáo tính năng Lịch lặp hoặc Hồ sơ dự án đã hoàn thành khi Tầng Service và Tầng UI chưa hoàn thiện.

---

## VII. BỘ TEST CASES MỞ RỘNG (20 TEST SCENARIOS)

| Mã Test | Kịch bản kiểm thử | Tiêu chí nghiệm thu |
| :--- | :--- | :--- |
| **MIG-01** | Database V1 rỗng nâng cấp lên V2 | Tạo đủ 10 stores, `DB_VERSION = 2`, không phát sinh exception. |
| **MIG-02** | Database V1 có đầy đủ dữ liệu 6 stores cũ | Toàn bộ số lượng bản ghi của 6 store cũ được bảo toàn 100%. |
| **MIG-03** | Hoạt động trạng thái `Planned` có số phút cũ = 0 | `actualDurationSeconds = 0`, `actualDurationMinutes = 0`, `actualDurationSource = 'unperformed'`. |
| **MIG-04** | Hoạt động `Completed` có timerSessions (`type !== 'manual'`) | `actualDurationSeconds` = tổng giây Timer thực tế, `actualDurationSource = 'timer_verified'`. |
| **MIG-05** | **Hoạt động chỉ có phiên `timerSessions` loại `type === 'manual'`** | **Phân loại chính xác `manual_verified`, TUYỆT ĐỐI KHÔNG gán nhầm thành `timer_verified`.** |
| **MIG-06** | Hoạt động có cả phiên Timer thực tế và Manual Session | Gán nhãn chính `timer_verified`, bóc tách chi tiết `timerSeconds` và `manualSeconds`. |
| **MIG-07** | Hoạt động `Completed` có phút cũ nhưng thiếu bằng chứng | Giữ nguyên số phút cũ, gán `actualDurationSource = 'legacy_unverified'`. |
| **MIG-08** | **Hoạt động `Planned` V1 có số phút cũ `> 0`** | **Giữ nguyên số phút cũ (không reset về 0), gán `legacy_unverified`.** |
| **MIG-09** | **Phân tách Verified Actual Time vs Legacy** | **Dữ liệu `legacy_unverified` KHÔNG được cộng vào `Verified Actual Time`.** |
| **MIG-10** | Lỗi bất ngờ khi nâng cấp store | Transaction bị abort, DB giữ nguyên version 1, dữ liệu không biến dạng. |
| **MIG-11** | Nhiều tab trình duyệt cùng mở khi upgrade | Xử lý `onversionchange` đóng kết nối tab cũ an toàn, `onblocked` phát cảnh báo rõ ràng. |
| **MIG-12** | Chống tạo trùng Occurrence sau Reload | Sau khi reload trình duyệt / re-init DB, truy vấn `recurrenceOccurrences` không sinh trùng `occurrenceId`. |
| **MIG-13** | **Hai tab cùng ghi đồng thời một Occurrence (`ConstraintError`)** | Ngăn abort bằng `preventDefault()` hoặc mở transaction mới; không crash, 0 activity trùng lặp. |
| **MIG-14** | **Sửa một lần lặp (Edit Single Occurrence)** | Cập nhật `isOverridden = true`, GIỮ NGUYÊN `recurrenceRuleId`, `originalDate`, `generatedActivityId`. |
| **MIG-15** | Tạo Project mới và liên kết Activity | Activity truy vấn được qua index `projectId`, không mất các trường dữ liệu V1. |
| **MIG-16** | Tạo Project Journal Entry độc lập | Entry lưu vào `projectJournalEntries`, không ảnh hưởng tới `notes` hay `dailyNotes`. |
| **MIG-17** | Xóa Project có cảnh báo an toàn | Không xóa mồ côi activities liên quan; hỗ trợ tùy chọn hủy liên kết dự án an toàn. |
| **MIG-18** | **Replace Backup nguyên tử trên cả 10 stores** | Toàn bộ 10 store được `clear` và `put` trong duy nhất 1 transaction readwrite; rollback 100% nếu có lỗi. |
| **MIG-19** | **Không có async gap trong transaction** | Chuẩn bị dữ liệu xong trước khi mở transaction, ngăn ngừa lỗi transaction auto-commit ngoài ý muốn. |
| **MIG-20** | Export Backup JSON phiên bản 2.0.0 | File JSON xuất ra chứa đầy đủ dữ liệu của toàn bộ 10 Object Stores và thông tin phiên bản hợp lệ. |
