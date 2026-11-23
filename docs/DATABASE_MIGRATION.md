# 🗄️ DATABASE MIGRATION SPECIFICATION: V1 ➔ V2
> **Chi tiết thiết kế di chuyển cơ sở dữ liệu IndexedDB và bảo toàn dữ liệu**  
> **Cơ sở dữ liệu:** `PersonalWorkJournalDB`  
> **Phiên bản cũ:** `1` ➔ **Phiên bản mới:** `2`

---

## I. SO SÁNH SCHEMA GIỮA PHIÊN BẢN 1 VÀ PHIÊN BẢN 2

### 1. Bảng đối chiếu Object Stores

| Tên Object Store | Tình trạng trong V2 | Mục đích sử dụng | Khóa chính (keyPath) |
| :--- | :---: | :--- | :--- |
| `activities` | **Giữ nguyên (Bảo toàn 100%)** | Lưu lịch trình công việc thực tế theo ngày | `id` |
| `dailyNotes` | **Giữ nguyên (Bảo toàn 100%)** | Lưu nhật ký phản tư theo ngày (1 bản ghi/ngày) | `id` |
| `notes` | **Giữ nguyên (Bảo toàn 100%)** | Lưu kho ghi chú chi tiết nhiều bản ghi | `id` |
| `goals` | **Giữ nguyên (Bảo toàn 100%)** | Lưu mục tiêu giờ làm việc/học tập | `id` |
| `timerSessions` | **Giữ nguyên (Bảo toàn 100%)** | Lưu lịch sử các phiên bấm giờ thực tế | `id` |
| `settings` | **Giữ nguyên (Bảo toàn 100%)** | Lưu tùy chọn giao diện, theme, active timer | `key` |
| `projects` | **MỚI (Bổ sung)** | Quản lý hồ sơ dự án cá nhân | `id` |
| `recurrenceRules` | **MỚI (Bổ sung)** | Quản lý các quy tắc lịch lặp lại định kỳ | `id` |

---

## II. CHI TIẾT CÁC THAY ĐỔI SCHEMA TRONG V2

### 1. Thêm mới Store `projects`
```javascript
const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
projectStore.createIndex('status', 'status', { unique: false });
projectStore.createIndex('category', 'category', { unique: false });
projectStore.createIndex('createdAt', 'createdAt', { unique: false });
```
**Cấu trúc bản ghi:**
```typescript
interface Project {
  id: string;               // 'proj_...'
  name: string;             // Tên dự án (ví dụ: HondaAuto DMS, Mercedes Garage)
  description: string;      // Mô tả mục tiêu dự án
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

### 2. Thêm mới Store `recurrenceRules`
```javascript
const recStore = db.createObjectStore('recurrenceRules', { keyPath: 'id' });
recStore.createIndex('recurrenceType', 'recurrenceType', { unique: false });
recStore.createIndex('startDate', 'startDate', { unique: false });
recStore.createIndex('createdAt', 'createdAt', { unique: false });
```
**Cấu trúc bản ghi:**
```typescript
interface RecurrenceRule {
  id: string;               // 'rec_...'
  activityTemplate: {       // Bản mẫu để sinh các lần lặp
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
  selectedWeekdays?: number[]; // [1, 3, 5] (Thứ 2, Thứ 4, Thứ 6)
  startDate: string;        // 'YYYY-MM-DD'
  endDate?: string;         // 'YYYY-MM-DD'
  repeatUntil?: string;     // 'YYYY-MM-DD'
  excludedDates?: string[]; // Danh sách các ngày bị bỏ qua
  createdAt: string;
  updatedAt: string;
}
```

### 3. Bổ sung Indexes vào các Store hiện có
Trong sự kiện `onupgradeneeded` khi nâng cấp từ version 1 lên 2:
```javascript
// Bổ sung vào store 'activities'
if (event.oldVersion < 2) {
  const actStore = tx.objectStore('activities');
  if (!actStore.indexNames.contains('projectId')) {
    actStore.createIndex('projectId', 'projectId', { unique: false });
  }
  if (!actStore.indexNames.contains('recurrenceRuleId')) {
    actStore.createIndex('recurrenceRuleId', 'recurrenceRuleId', { unique: false });
  }

  // Bổ sung vào store 'notes'
  const noteStore = tx.objectStore('notes');
  if (!noteStore.indexNames.contains('projectId')) {
    noteStore.createIndex('projectId', 'projectId', { unique: false });
  }

  // Bổ sung vào store 'timerSessions'
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

## III. CHIẾN LƯỢC DI CHUYỂN DỮ LIỆU TẠI CHỖ (IN-PLACE DATA MIGRATION)

### 1. Chuẩn hóa trường Actual Duration trong `activities`
- **Thực trạng dữ liệu V1:** Một số bản ghi có `actualDurationMinutes` được gán bằng `durationMinutes` dù chưa từng được thực hiện.
- **Quy tắc di chuyển trong Migration V2:**
  - Nếu bản ghi đã có phiên bấm giờ trong `timerSessions`: Tính tổng số giây thực tế từ các phiên liên kết và gán vào `actualDurationSeconds`.
  - Nếu bản ghi chưa có `actualDurationSeconds`:
    - Nếu trạng thái là `Completed` và có `actualDurationMinutes`: Gán `actualDurationSeconds = actualDurationMinutes * 60`.
    - Nếu trạng thái là `Planned` và chưa có ghi nhận thực tế: Khởi tạo `actualDurationSeconds = 0`.
  - Giữ nguyên trường `actualDurationMinutes` = `Math.round(actualDurationSeconds / 60)` để tương thích 100% với các hàm cũ.

---

## IV. NGUYÊN TẮC BẢO VỆ DỮ LIỆU VÀ KHÔI PHỤC KHI LỖI (ROLLBACK STRATEGY)

1. **Tính nguyên tử (Atomicity):**
   - Sự kiện `onupgradeneeded` của IndexedDB tự động chạy trong một versionchange transaction đặc biệt.
   - Nếu xảy ra bất kỳ ngoại lệ (exception) nào trong quá trình tạo store hoặc index, trình duyệt tự động hủy bỏ (abort) toàn bộ transaction và trả cơ sở dữ liệu về phiên bản cũ (Version 1) với dữ liệu nguyên vẹn.
2. **Kiểm tra trước khi tạo (`contains` check):**
   - Luôn sử dụng `if (!db.objectStoreNames.contains(storeName))` trước khi tạo store.
   - Luôn sử dụng `if (!store.indexNames.contains(indexName))` trước khi tạo index.
3. **Tuyệt đối không xóa:**
   - Không gọi `db.deleteObjectStore()` trên bất kỳ store cũ nào.
   - Không gọi `store.deleteIndex()` trên bất kỳ index cũ nào.
   - Không bao giờ gọi `indexedDB.deleteDatabase()` khi khởi động ứng dụng.
