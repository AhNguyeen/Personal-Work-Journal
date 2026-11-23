/**
 * constants.js - System constants for categories, statuses, ratings
 */

export const CATEGORIES = {
  Work: {
    id: 'Work',
    label: 'Làm việc',
    color: '#2563eb', // Blue
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: 'briefcase'
  },
  Study: {
    id: 'Study',
    label: 'Học tập',
    color: '#7c3aed', // Violet
    bg: '#f5f3ff',
    border: '#ddd6fe',
    icon: 'book-open'
  },
  Project: {
    id: 'Project',
    label: 'Phát triển dự án',
    color: '#059669', // Emerald
    bg: '#ecfdf5',
    border: '#a7f3d0',
    icon: 'code'
  },
  Personal: {
    id: 'Personal',
    label: 'Cá nhân',
    color: '#d97706', // Amber
    bg: '#fffbeb',
    border: '#fde68a',
    icon: 'user'
  },
  Break: {
    id: 'Break',
    label: 'Nghỉ ngơi',
    color: '#db2777', // Pink
    bg: '#fdf2f8',
    border: '#fbcfe8',
    icon: 'coffee'
  },
  Other: {
    id: 'Other',
    label: 'Khác',
    color: '#475569', // Slate
    bg: '#f8fafc',
    border: '#e2e8f0',
    icon: 'more-horizontal'
  }
};

export const STATUSES = {
  Planned: {
    id: 'Planned',
    label: 'Đã lên lịch',
    color: '#64748b',
    bg: '#f1f5f9'
  },
  'In Progress': {
    id: 'In Progress',
    label: 'Đang thực hiện',
    color: '#2563eb',
    bg: '#dbeafe'
  },
  Completed: {
    id: 'Completed',
    label: 'Hoàn thành',
    color: '#059669',
    bg: '#d1fae5'
  },
  Cancelled: {
    id: 'Cancelled',
    label: 'Đã hủy',
    color: '#dc2626',
    bg: '#fee2e2'
  }
};

export const STAR_RATINGS = {
  1: { stars: 1, label: 'Ít quan trọng' },
  2: { stars: 2, label: 'Bình thường' },
  3: { stars: 3, label: 'Cần chú ý' },
  4: { stars: 4, label: 'Quan trọng' },
  5: { stars: 5, label: 'Rất quan trọng' }
};

export const GOAL_PERIODS = {
  daily: { id: 'daily', label: 'Hàng ngày' },
  weekly: { id: 'weekly', label: 'Hàng tuần' },
  monthly: { id: 'monthly', label: 'Hàng tháng' }
};
