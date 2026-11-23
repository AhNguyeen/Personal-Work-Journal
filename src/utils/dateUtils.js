/**
 * dateUtils.js - Comprehensive date calculations formatted for Vietnam locale
 * Default timezone: Asia/Ho_Chi_Minh
 */

/**
 * Format Date object to YYYY-MM-DD string
 * @param {Date} date
 * @returns {string}
 */
export function formatDateISO(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today as YYYY-MM-DD
 * @returns {string}
 */
export function getTodayDateString() {
  return formatDateISO(new Date());
}

/**
 * Parse YYYY-MM-DD to Date object at local midnight
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseISODate(dateStr) {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format date string to Vietnamese friendly text (e.g. Thứ Hai, 23/11/2026)
 * @param {string|Date} date
 * @param {boolean} showWeekday
 * @returns {string}
 */
export function formatVietnameseDate(date, showWeekday = true) {
  const d = typeof date === 'string' ? parseISODate(date) : new Date(date);
  const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const weekday = weekdays[d.getDay()];

  if (showWeekday) {
    return `${weekday}, ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/**
 * Get start of week (Monday) for a given date
 * @param {Date|string} date
 * @returns {Date}
 */
export function getStartOfWeek(date) {
  const d = typeof date === 'string' ? parseISODate(date) : new Date(date);
  const day = d.getDay();
  // In JS: 0 is Sunday, 1 is Monday. We want Monday as start of week.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

/**
 * Get 7 days array for the week containing date
 * @param {Date|string} date
 * @returns {Array<{date: Date, dateStr: string, weekday: string, dayNum: number, isToday: boolean}>}
 */
export function getWeekDays(date) {
  const start = getStartOfWeek(date);
  const todayStr = getTodayDateString();
  const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const fullWeekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateStr = formatDateISO(d);
    days.push({
      date: d,
      dateStr,
      shortWeekday: weekdays[i],
      weekday: fullWeekdays[i],
      dayNum: d.getDate(),
      monthNum: d.getMonth() + 1,
      isToday: dateStr === todayStr
    });
  }
  return days;
}

/**
 * Add or subtract days from a date string
 * @param {string} dateStr
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
export function addDays(dateStr, days) {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateISO(d);
}

/**
 * Check if date string is today
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isToday(dateStr) {
  return dateStr === getTodayDateString();
}
