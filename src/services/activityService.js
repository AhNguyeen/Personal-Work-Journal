/**
 * activityService.js - Business logic for Activity lifecycle
 * Supports V2 Provenance, Whitelist Timer classification, and Project/Recurrence links.
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
   * Helper to resolve actual duration and provenance source
   * @private
   */
  _resolveDurationAndProvenance(rawData, durationMinutes) {
    const status = rawData.status || 'Planned';
    const isCompleted = status === 'Completed';

    // Đã có nguồn chỉ định trước
    if (rawData.actualDurationSource) {
      const seconds = rawData.actualDurationSeconds !== undefined
        ? Number(rawData.actualDurationSeconds)
        : (Number(rawData.actualDurationMinutes) || 0) * 60;
      return {
        actualDurationSeconds: seconds,
        actualDurationMinutes: Math.round(seconds / 60),
        actualDurationSource: rawData.actualDurationSource
      };
    }

    // Bằng chứng nhập tay chủ động
    const hasManualProof = rawData.manuallyConfirmed === true || rawData.manualEntry === true || rawData.source === 'manual';

    if (hasManualProof) {
      const mins = Number(rawData.actualDurationMinutes) || durationMinutes;
      return {
        actualDurationSeconds: mins * 60,
        actualDurationMinutes: mins,
        actualDurationSource: 'manual_verified'
      };
    }

    if (isCompleted) {
      const mins = Number(rawData.actualDurationMinutes) || durationMinutes;
      return {
        actualDurationSeconds: mins * 60,
        actualDurationMinutes: mins,
        actualDurationSource: 'legacy_unverified'
      };
    }

    // Nếu là Planned và không có phút nhập trước
    const plannedMins = Number(rawData.actualDurationMinutes) || 0;
    if (plannedMins > 0) {
      return {
        actualDurationSeconds: plannedMins * 60,
        actualDurationMinutes: plannedMins,
        actualDurationSource: 'legacy_unverified'
      };
    }

    return {
      actualDurationSeconds: 0,
      actualDurationMinutes: 0,
      actualDurationSource: 'unperformed'
    };
  }

  /**
   * Create a new activity
   * @param {Object} rawData
   * @param {boolean} allowOverlap
   */
  async createActivity(rawData, allowOverlap = false) {
    if (rawData.stars === undefined || rawData.stars === null) {
      rawData.stars = 3;
    }
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

    const { actualDurationSeconds, actualDurationMinutes, actualDurationSource } =
      this._resolveDurationAndProvenance(rawData, durationMinutes);

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
      projectId: rawData.projectId || null,
      recurrenceRuleId: rawData.recurrenceRuleId || null,
      isOccurrenceOverridden: rawData.isOccurrenceOverridden || false,
      actualDurationMinutes,
      actualDurationSeconds,
      actualDurationSource
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

    const { actualDurationSeconds, actualDurationMinutes, actualDurationSource } =
      this._resolveDurationAndProvenance(rawData, durationMinutes);

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
      projectId: rawData.projectId !== undefined ? rawData.projectId : existing.projectId || null,
      recurrenceRuleId: rawData.recurrenceRuleId !== undefined ? rawData.recurrenceRuleId : existing.recurrenceRuleId || null,
      isOccurrenceOverridden: rawData.isOccurrenceOverridden !== undefined ? rawData.isOccurrenceOverridden : existing.isOccurrenceOverridden || false,
      actualDurationMinutes,
      actualDurationSeconds,
      actualDurationSource
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
    if (status === 'Completed' && act.actualDurationSource === 'unperformed') {
      act.actualDurationMinutes = act.durationMinutes;
      act.actualDurationSeconds = act.durationMinutes * 60;
      act.actualDurationSource = 'legacy_unverified';
    }
    const saved = await activityRepository.update(act);
    this._notifyChange('update', saved);
    return saved;
  }

  /**
   * Delete an activity
   */
  async deleteActivity(id) {
    const act = await activityRepository.getById(id);
    if (!act) return false;
    await activityRepository.delete(id);
    this._notifyChange('delete', { id });
    return true;
  }

  /**
   * Calculate Verified Actual Duration in minutes
   * Only includes 'timer_verified' and 'manual_verified'
   * Explicitly excludes 'legacy_unverified' and 'unperformed'
   * @param {Array<Object>} activities
   * @returns {number} minutes
   */
  calculateVerifiedActualDuration(activities = []) {
    return activities
      .filter(a => a.actualDurationSource === 'timer_verified' || a.actualDurationSource === 'manual_verified')
      .reduce((sum, a) => sum + (Number(a.actualDurationMinutes) || 0), 0);
  }

  /**
   * Calculate Legacy Unverified Duration in minutes
   * @param {Array<Object>} activities
   * @returns {number} minutes
   */
  calculateLegacyUnverifiedDuration(activities = []) {
    return activities
      .filter(a => a.actualDurationSource === 'legacy_unverified')
      .reduce((sum, a) => sum + (Number(a.actualDurationMinutes) || 0), 0);
  }

  /**
   * Notify window of changes
   * @private
   */
  _notifyChange(type, data) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('activity-changed', { detail: { type, data } }));
    }
  }
}

export const activityService = new ActivityService();
