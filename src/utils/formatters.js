/**
 * formatters.js - String, Number and HTML formatters
 */

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate unique ID with prefix
 * @param {string} prefix
 * @returns {string}
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Truncate string to max length
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function truncate(text, max = 50) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.substr(0, max) + '...';
}

/**
 * Debounce function for auto-save and search inputs
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
