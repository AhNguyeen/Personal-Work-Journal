/**
 * timeUtils.js - Time conversions, overlap check, duration formatting
 */

/**
 * Convert HH:MM string to minutes from 00:00
 * @param {string} timeStr '08:30'
 * @returns {number} 510
 */
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Convert minutes from 00:00 to HH:MM string
 * @param {number} totalMinutes
 * @returns {string} '08:30'
 */
export function minutesToTime(totalMinutes) {
  const clamped = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Calculate duration in minutes between start and end (HH:MM), minus break minutes
 * @param {string} startTime '09:00'
 * @param {string} endTime '11:30'
 * @param {number} breakMinutes 15
 * @returns {number} 135
 */
export function calculateDurationMinutes(startTime, endTime, breakMinutes = 0) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const duration = end - start - (Number(breakMinutes) || 0);
  return Math.max(0, duration);
}

/**
 * Format minutes into friendly Vietnamese string (e.g., 2 giờ 30 phút or 45 phút)
 * @param {number} totalMinutes
 * @returns {string}
 */
export function formatDuration(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0 phút';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}p`;
  } else if (hours > 0) {
    return `${hours} giờ`;
  }
  return `${minutes} phút`;
}

/**
 * Format seconds to HH:MM:SS for Stopwatch/Timer
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatSecondsToTimer(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Check if two time intervals overlap (same day)
 * [start1, end1) and [start2, end2)
 * @param {string} s1
 * @param {string} e1
 * @param {string} s2
 * @param {string} e2
 * @returns {boolean}
 */
export function checkTimesOverlap(s1, e1, s2, e2) {
  const start1 = timeToMinutes(s1);
  const end1 = timeToMinutes(e1);
  const start2 = timeToMinutes(s2);
  const end2 = timeToMinutes(e2);

  return Math.max(start1, start2) < Math.min(end1, end2);
}

/**
 * Find all overlapping activities in a list for a given candidate activity
 * @param {Object} candidate { id, startTime, endTime }
 * @param {Array} activities
 * @returns {Array} overlapping activities
 */
export function findOverlappingActivities(candidate, activities) {
  if (!candidate || !candidate.startTime || !candidate.endTime) return [];
  return activities.filter(act => {
    if (candidate.id && act.id === candidate.id) return false;
    return checkTimesOverlap(candidate.startTime, candidate.endTime, act.startTime, act.endTime);
  });
}
