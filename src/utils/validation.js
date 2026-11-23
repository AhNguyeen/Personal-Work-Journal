/**
 * validation.js - Strict data validation rules before database commits
 */

import { timeToMinutes } from './timeUtils.js';

/**
 * Validate Activity form data
 * @param {Object} data
 * @returns {{isValid: boolean, errors: Object}}
 */
export function validateActivity(data) {
  const errors = {};

  if (!data.title || !data.title.trim()) {
    errors.title = 'Tên hoạt động không được để trống';
  }

  if (!data.date) {
    errors.date = 'Ngày thực hiện không được để trống';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.date = 'Định dạng ngày không hợp lệ (YYYY-MM-DD)';
  }

  if (!data.startTime) {
    errors.startTime = 'Giờ bắt đầu không được để trống';
  }

  if (!data.endTime) {
    errors.endTime = 'Giờ kết thúc không được để trống';
  }

  if (data.startTime && data.endTime) {
    const startMin = timeToMinutes(data.startTime);
    const endMin = timeToMinutes(data.endTime);

    if (startMin >= endMin) {
      errors.endTime = 'Giờ kết thúc phải lớn hơn giờ bắt đầu';
    }
  }

  if (data.stars === undefined || data.stars === null) {
    errors.stars = 'Mức độ sao không được để trống';
  } else {
    const starsNum = Number(data.stars);
    if (isNaN(starsNum) || starsNum < 1 || starsNum > 5) {
      errors.stars = 'Đánh giá sao phải từ 1 đến 5 sao';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate Note data
 * @param {Object} data
 * @returns {{isValid: boolean, errors: Object}}
 */
export function validateNote(data) {
  const errors = {};

  if (!data.title || !data.title.trim()) {
    errors.title = 'Tiêu đề ghi chú không được để trống';
  }

  if (!data.date) {
    errors.date = 'Ngày ghi chú không được để trống';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validate Goal data
 * @param {Object} data
 * @returns {{isValid: boolean, errors: Object}}
 */
export function validateGoal(data) {
  const errors = {};

  if (!data.title || !data.title.trim()) {
    errors.title = 'Tên mục tiêu không được để trống';
  }

  if (!data.targetHours || Number(data.targetHours) <= 0) {
    errors.targetHours = 'Số giờ mục tiêu phải lớn hơn 0';
  }

  if (!data.category) {
    errors.category = 'Vui lòng chọn danh mục';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
