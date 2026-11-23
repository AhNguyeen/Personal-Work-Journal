/**
 * activityService.js - Business logic for Activity lifecycle
 */

import { activityRepository } from '../database/repositories/activityRepository.js';
import { validateActivity } from '../utils/validation.js';
import { calculateDurationMinutes, findOverlappingActivities } from '../utils/timeUtils.js';
import { generateId } from '../utils/formatters.js';

class ActivityService {
  /**
   * Get all activities
   */
  async getAllActivities() {
    return await activityRepository.getAll();
  }

  /**
   * Get activities for a specific date (sorted by startTime)
   * @param {string} dateStr 'YYYY-MM-DD'
   */
  async getActivitiesByDate(dateStr) {
    const list = await activityRepository.getByDate(dateStr);
    return list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  /**
   * Get starred activities sorted by priority (5 stars first, then 4, 3, etc.)
   * @param {number} minStars
   */
  async getStarredActivities(minStars = 1) {
    const all = await activityRepository.getAll();
    return all
      .filter(a => Number(a.stars) >= minStars)
      .sort((a, b) => {
        if (Number(b.stars) !== Number(a.stars)) {
          return Number(b.stars) - Number(a.stars);
        }
        // If equal stars, sort by date desc then start time
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return a.startTime.localeCompare(b.startTime);
      });
  }

  /**
   * Check for potential time overlaps on the given date
   * @param {Object} activityData
   * @returns {Promise<Array>} list of overlapping activities
   */
  async checkOverlaps(activityData) {
    const dayActivities = await this.getActivitiesByDate(activityData.date);
    return findOverlappingActivities(activityData, dayActivities);
  }

  /**
   * Create a new activity
   * @param {Object} rawData
   * @param {boolean} allowOverlap
   */
  async createActivity(rawData, allowOverlap = false) {
    const validation = validateActivity(rawData);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      throw new Error(firstError);
    }

    if (!allowOverlap) {
      const overlaps = await this.checkOverlaps(rawData);
      if (overlaps.length > 0) {
        const conflictNames = overlaps.map(o => `"${o.title}" (${o.startTime}-${o.endTime})`).join(', ');
        const err = new Error(`Hoạt động trùng thời gian với: ${conflictNames}`);
        err.isOverlapConflict = true;
        err.overlappingActivities = overlaps;
        throw err;
      }
    }

    const durationMinutes = calculateDurationMinutes(
      rawData.startTime,
      rawData.endTime,
      rawData.breakMinutes || 0
    );

    const newActivity = {
      id: rawData.id || generateId('act'),
      title: rawData.title.trim(),
      description: (rawData.description || '').trim(),
      category: rawData.category || 'Work',
      date: rawData.date,
      startTime: rawData.startTime,
      endTime: rawData.endTime,
      breakMinutes: Number(rawData.breakMinutes) || 0,
      durationMinutes,
      stars: Number(rawData.stars) || 3,
      status: rawData.status || 'Planned',
      relatedNote: (rawData.relatedNote || '').trim(),
      actualDurationMinutes: Number(rawData.actualDurationMinutes) || durationMinutes
    };

    const saved = await activityRepository.add(newActivity);
    this._notifyChange('create', saved);
    return saved;
  }

  /**
   * Update an existing activity
   * @param {Object} rawData
   * @param {boolean} allowOverlap
   */
  async updateActivity(rawData, allowOverlap = false) {
    const validation = validateActivity(rawData);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      throw new Error(firstError);
    }

    const existing = await activityRepository.getById(rawData.id);
    if (!existing) {
      throw new Error('Hoạt động không tồn tại hoặc đã bị xóa');
    }

    if (!allowOverlap) {
      const overlaps = await this.checkOverlaps(rawData);
      if (overlaps.length > 0) {
        const conflictNames = overlaps.map(o => `"${o.title}" (${o.startTime}-${o.endTime})`).join(', ');
        const err = new Error(`Hoạt động trùng thời gian với: ${conflictNames}`);
        err.isOverlapConflict = true;
        err.overlappingActivities = overlaps;
        throw err;
      }
    }

    const durationMinutes = calculateDurationMinutes(
      rawData.startTime,
      rawData.endTime,
      rawData.breakMinutes || 0
    );

    const updated = {
      ...existing,
      title: rawData.title.trim(),
      description: (rawData.description || '').trim(),
      category: rawData.category || existing.category,
      date: rawData.date,
      startTime: rawData.startTime,
      endTime: rawData.endTime,
      breakMinutes: Number(rawData.breakMinutes) || 0,
      durationMinutes,
      stars: Number(rawData.stars) || existing.stars,
      status: rawData.status || existing.status,
      relatedNote: (rawData.relatedNote || '').trim(),
      actualDurationMinutes: Number(rawData.actualDurationMinutes) || existing.actualDurationMinutes || durationMinutes
    };

    const saved = await activityRepository.update(updated);
    this._notifyChange('update', saved);
    return saved;
  }

  /**
   * Quick update star rating
   */
  async updateStars(id, stars) {
    const act = await activityRepository.getById(id);
    if (!act) throw new Error('Không tìm thấy hoạt động');
    act.stars = Number(stars);
    const saved = await activityRepository.update(act);
    this._notifyChange('update', saved);
    return saved;
  }

  /**
   * Quick update status
   */
  async updateStatus(id, status) {
    const act = await activityRepository.getById(id);
    if (!act) throw new Error('Không tìm thấy hoạt động');
    act.status = status;
    const saved = await activityRepository.update(act);
    this._notifyChange('update', saved);
    return saved;
  }

  /**
   * Delete an activity by ID
   */
  async deleteActivity(id) {
    const act = await activityRepository.getById(id);
    if (!act) return false;
    await activityRepository.delete(id);
    this._notifyChange('delete', { id });
    return true;
  }

  /**
   * Broadcast change event so UI views re-render reactively
   */
  _notifyChange(type, data) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('journal:activity-changed', { detail: { type, data } }));
    }
  }
}

export const activityService = new ActivityService();
