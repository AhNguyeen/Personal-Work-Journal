/**
 * statisticsService.js - Comprehensive metrics, trends and analytical insights
 */

import { activityRepository } from '../database/repositories/activityRepository.js';
import { goalRepository } from '../database/repositories/goalRepository.js';
import { getTodayDateString, addDays, getStartOfWeek, parseISODate, formatDateISO } from '../utils/dateUtils.js';

class StatisticsService {
  /**
   * Get Dashboard high-level KPIs for today
   */
  async getTodayDashboardStats() {
    const today = getTodayDateString();
    const todayActivities = await activityRepository.getByDate(today);

    let totalDurationMinutes = 0;
    let workMinutes = 0;
    let studyMinutes = 0;
    let projectMinutes = 0;
    let breakMinutes = 0;
    let personalMinutes = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let plannedCount = 0;
    let fiveStarCount = 0;

    for (const act of todayActivities) {
      const duration = act.actualDurationMinutes || act.durationMinutes || 0;
      totalDurationMinutes += duration;

      if (act.category === 'Work') workMinutes += duration;
      else if (act.category === 'Study') studyMinutes += duration;
      else if (act.category === 'Project') projectMinutes += duration;
      else if (act.category === 'Break') breakMinutes += duration;
      else if (act.category === 'Personal') personalMinutes += duration;

      if (act.status === 'Completed') completedCount++;
      else if (act.status === 'In Progress') inProgressCount++;
      else if (act.status === 'Planned') plannedCount++;

      if (Number(act.stars) === 5) fiveStarCount++;
    }

    const uncompletedCount = todayActivities.length - completedCount;

    return {
      totalActivities: todayActivities.length,
      completedCount,
      uncompletedCount,
      inProgressCount,
      plannedCount,
      fiveStarCount,
      totalDurationMinutes,
      workMinutes,
      studyMinutes,
      projectMinutes,
      breakMinutes,
      personalMinutes,
      completionRate: todayActivities.length > 0 ? Math.round((completedCount / todayActivities.length) * 100) : 0
    };
  }

  /**
   * Get filtered analytics for Statistics page
   * @param {'today'|'7days'|'thisweek'|'thismonth'|'3months'|'custom'} period
   * @param {string} customStart YYYY-MM-DD
   * @param {string} customEnd YYYY-MM-DD
   */
  async getAnalytics(period = '7days', customStart = null, customEnd = null) {
    const allActivities = await activityRepository.getAll();
    const today = getTodayDateString();

    let startDateStr;
    let endDateStr = today;

    if (period === 'today') {
      startDateStr = today;
    } else if (period === '7days') {
      startDateStr = addDays(today, -6);
    } else if (period === 'thisweek') {
      startDateStr = formatDateISO(getStartOfWeek(today));
    } else if (period === 'thismonth') {
      const now = new Date();
      startDateStr = formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
    } else if (period === '3months') {
      startDateStr = addDays(today, -90);
    } else if (period === 'custom') {
      startDateStr = customStart || addDays(today, -30);
      endDateStr = customEnd || today;
    }

    // Filter activities within range
    const filtered = allActivities.filter(a => a.date >= startDateStr && a.date <= endDateStr);

    // Aggregate by category
    const categoryMinutes = {
      Work: 0,
      Study: 0,
      Project: 0,
      Personal: 0,
      Break: 0,
      Other: 0
    };

    // Aggregate by date (for trend charts)
    const dailyMinutesMap = {};
    const dailyCompletedMap = {};

    // Star distribution
    const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    let totalDuration = 0;
    let completedCount = 0;

    for (const act of filtered) {
      const mins = act.actualDurationMinutes || act.durationMinutes || 0;
      totalDuration += mins;

      if (categoryMinutes[act.category] !== undefined) {
        categoryMinutes[act.category] += mins;
      } else {
        categoryMinutes.Other += mins;
      }

      dailyMinutesMap[act.date] = (dailyMinutesMap[act.date] || 0) + mins;

      if (act.status === 'Completed') {
        completedCount++;
        dailyCompletedMap[act.date] = (dailyCompletedMap[act.date] || 0) + 1;
      }

      const s = Number(act.stars) || 3;
      if (starCounts[s] !== undefined) starCounts[s]++;
    }

    // Find peak productivity day
    let peakDay = null;
    let maxDayMins = 0;
    for (const [date, mins] of Object.entries(dailyMinutesMap)) {
      if (mins > maxDayMins) {
        maxDayMins = mins;
        peakDay = date;
      }
    }

    // Find top category
    let topCategory = 'Work';
    let topCategoryMins = 0;
    for (const [cat, mins] of Object.entries(categoryMinutes)) {
      if (mins > topCategoryMins) {
        topCategoryMins = mins;
        topCategory = cat;
      }
    }

    return {
      period,
      startDateStr,
      endDateStr,
      totalActivities: filtered.length,
      completedCount,
      completionRate: filtered.length > 0 ? Math.round((completedCount / filtered.length) * 100) : 0,
      totalDurationMinutes: totalDuration,
      categoryMinutes,
      dailyMinutesMap,
      dailyCompletedMap,
      starCounts,
      peakDay,
      peakDayMinutes: maxDayMins,
      topCategory,
      topCategoryMinutes: topCategoryMins
    };
  }
}

export const statisticsService = new StatisticsService();
