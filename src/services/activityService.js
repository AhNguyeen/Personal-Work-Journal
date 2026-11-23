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
   * Helper to resolve actual duration and provenance source with strict whitelist and proof verification
   * @private
   */
  _resolveDurationAndProvenance(rawData, durationMinutes) {
    const status = rawData.status || 'Planned';
    const isCompleted = status === 'Completed';

    // Bằng chứng Timer thực tế (type === 'timer' || 'pomodoro')
    const timerSeconds = Number(rawData.timerSeconds) || 0;
    const hasTimerProof = timerSeconds > 0 || rawData.hasTimerProof === true || rawData.isTimerLogged === true;

    // Bằng chứng nhập tay chủ động
    const manualSeconds = Number(rawData.manualSeconds) || 0;
    const hasManualProof = manualSeconds > 0 ||
      rawData.manuallyConfirmed === true ||
      rawData.manualEntry === true ||
      rawData.source === 'manual';

    // 1. Nếu rawData có khai báo actualDurationSource -> BẮT BUỘC xác thực bằng chứng
    if (rawData.actualDurationSource) {
      const declared = rawData.actualDurationSource;
      const declaredSecs = rawData.actualDurationSeconds !== undefined
        ? Number(rawData.actualDurationSeconds)
        : (Number(rawData.actualDurationMinutes) || 0) * 60;

      if (declared === 'timer_verified') {
        // Chỉ chấp nhận timer_verified khi có bằng chứng timer thực tế
        if (hasTimerProof) {
          const tSecs = timerSeconds > 0 ? timerSeconds : declaredSecs;
          const totalSecs = tSecs + manualSeconds;
          return {
            actualDurationSeconds: totalSecs,
            actualDurationMinutes: Math.round(totalSecs / 60),
            actualDurationSource: 'timer_verified',
            timerSeconds: tSecs,
            manualSeconds
          };
        }
        // Không có bằng chứng timer -> kiểm tra manual proof
        if (hasManualProof) {
          const mSecs = manualSeconds > 0 ? manualSeconds : declaredSecs;
          return {
            actualDurationSeconds: mSecs,
            actualDurationMinutes: Math.round(mSecs / 60),
            actualDurationSource: 'manual_verified',
            timerSeconds: 0,
            manualSeconds: mSecs
          };
        }
        // Khai khống hoặc không rõ nguồn nhưng có số phút/giây -> hạ cấp về legacy_unverified
        if (declaredSecs > 0) {
          return {
            actualDurationSeconds: declaredSecs,
            actualDurationMinutes: Math.round(declaredSecs / 60),
            actualDurationSource: 'legacy_unverified',
            timerSeconds: 0,
            manualSeconds: 0
          };
        }
        return {
          actualDurationSeconds: 0,
          actualDurationMinutes: 0,
          actualDurationSource: 'unperformed',
          timerSeconds: 0,
          manualSeconds: 0
        };
      }

      if (declared === 'manual_verified') {
        if (hasManualProof || declaredSecs > 0) {
          const mSecs = manualSeconds > 0 ? manualSeconds : declaredSecs;
          return {
            actualDurationSeconds: mSecs,
            actualDurationMinutes: Math.round(mSecs / 60),
            actualDurationSource: hasManualProof ? 'manual_verified' : 'legacy_unverified',
            timerSeconds: 0,
            manualSeconds: hasManualProof ? mSecs : 0
          };
        }
        return {
          actualDurationSeconds: 0,
          actualDurationMinutes: 0,
          actualDurationSource: 'unperformed',
          timerSeconds: 0,
          manualSeconds: 0
        };
      }

      if (declared === 'legacy_unverified') {
        return {
          actualDurationSeconds: declaredSecs,
          actualDurationMinutes: Math.round(declaredSecs / 60),
          actualDurationSource: declaredSecs > 0 ? 'legacy_unverified' : 'unperformed',
          timerSeconds: 0,
          manualSeconds: 0
        };
      }

      if (declared === 'unperformed') {
        return {
          actualDurationSeconds: 0,
          actualDurationMinutes: 0,
          actualDurationSource: 'unperformed',
          timerSeconds: 0,
          manualSeconds: 0
        };
      }
    }

    // 2. Không chỉ định trước source -> đánh giá theo thứ tự ưu tiên
    // Ưu tiên 1: Có bằng chứng timer
    if (hasTimerProof) {
      const tSecs = timerSeconds > 0 ? timerSeconds : (Number(rawData.actualDurationSeconds) || 0);
      const totalSecs = tSecs + manualSeconds;
      return {
        actualDurationSeconds: totalSecs,
        actualDurationMinutes: Math.round(totalSecs / 60),
        actualDurationSource: 'timer_verified',
        timerSeconds: tSecs,
        manualSeconds
      };
    }

    // Ưu tiên 2: Có bằng chứng manual nhập tay
    if (hasManualProof) {
      const mins = Number(rawData.actualDurationMinutes) || durationMinutes;
      const mSecs = manualSeconds > 0 ? manualSeconds : mins * 60;
      return {
        actualDurationSeconds: mSecs,
        actualDurationMinutes: Math.round(mSecs / 60),
        actualDurationSource: 'manual_verified',
        timerSeconds: 0,
        manualSeconds: mSecs
      };
    }

    // Ưu tiên 3: Completed có phút cũ nhưng không có bằng chứng
    if (isCompleted) {
      const mins = Number(rawData.actualDurationMinutes) || durationMinutes;
      return {
        actualDurationSeconds: mins * 60,
        actualDurationMinutes: mins,
        actualDurationSource: 'legacy_unverified',
        timerSeconds: 0,
        manualSeconds: 0
      };
    }

    // Ưu tiên 3 (tiếp): Planned có phút cũ > 0 từ V1 (bảo toàn lịch sử)
    const plannedMins = Number(rawData.actualDurationMinutes) || 0;
    if (plannedMins > 0) {
      return {
        actualDurationSeconds: plannedMins * 60,
        actualDurationMinutes: plannedMins,
        actualDurationSource: 'legacy_unverified',
        timerSeconds: 0,
        manualSeconds: 0
      };
    }

    // Ưu tiên 4: Chưa thực hiện
    return {
      actualDurationSeconds: 0,
      actualDurationMinutes: 0,
      actualDurationSource: 'unperformed',
      timerSeconds: 0,
      manualSeconds: 0
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

    const {
      actualDurationSeconds,
      actualDurationMinutes,
      actualDurationSource,
      timerSeconds,
      manualSeconds
    } = this._resolveDurationAndProvenance(rawData, durationMinutes);

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
      actualDurationSource,
      timerSeconds: timerSeconds || 0,
      manualSeconds: manualSeconds || 0
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
    const existing = await activityRepository.getById(rawData.id);
    if (!existing) {
      throw new Error('Hoạt động không tồn tại hoặc đã bị xóa');
    }

    if (rawData.stars === undefined || rawData.stars === null) {
      rawData.stars = existing.stars !== undefined ? existing.stars : 3;
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

    // BẢO VỆ PROVENANCE: Hòa trộn context bản ghi hiện có (existing)
    // Nếu form chỉnh sửa chỉ sửa tiêu đề, ngày, giờ hoặc danh mục mà không truyền lại provenance,
    // giữ nguyên 100% nguồn gốc và thời gian đã được xác minh (timer_verified, manual_verified, legacy_unverified).
    const mergedData = {
      ...existing,
      ...rawData,
      actualDurationSource: rawData.actualDurationSource !== undefined ? rawData.actualDurationSource : existing.actualDurationSource,
      actualDurationSeconds: rawData.actualDurationSeconds !== undefined ? rawData.actualDurationSeconds : existing.actualDurationSeconds,
      actualDurationMinutes: rawData.actualDurationMinutes !== undefined ? rawData.actualDurationMinutes : existing.actualDurationMinutes,
      timerSeconds: rawData.timerSeconds !== undefined ? rawData.timerSeconds : existing.timerSeconds,
      manualSeconds: rawData.manualSeconds !== undefined ? rawData.manualSeconds : existing.manualSeconds,
      hasTimerProof: rawData.hasTimerProof !== undefined ? rawData.hasTimerProof : ((existing.timerSeconds || 0) > 0 || existing.actualDurationSource === 'timer_verified'),
      manuallyConfirmed: rawData.manuallyConfirmed !== undefined ? rawData.manuallyConfirmed : existing.manuallyConfirmed
    };

    const {
      actualDurationSeconds,
      actualDurationMinutes,
      actualDurationSource,
      timerSeconds,
      manualSeconds
    } = this._resolveDurationAndProvenance(mergedData, durationMinutes);

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
      actualDurationSource,
      timerSeconds: timerSeconds !== undefined ? timerSeconds : (existing.timerSeconds || 0),
      manualSeconds: manualSeconds !== undefined ? manualSeconds : (existing.manualSeconds || 0)
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
