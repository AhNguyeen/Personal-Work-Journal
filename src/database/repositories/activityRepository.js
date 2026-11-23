/**
 * activityRepository.js - Data access for Activity entity
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class ActivityRepository {
  async getAll() {
    return await databaseService.getAll(STORES.ACTIVITIES);
  }

  async getById(id) {
    return await databaseService.getById(STORES.ACTIVITIES, id);
  }

  async getByDate(dateStr) {
    return await databaseService.getByIndex(STORES.ACTIVITIES, 'date', dateStr);
  }

  async getByCategory(category) {
    return await databaseService.getByIndex(STORES.ACTIVITIES, 'category', category);
  }

  async getByStatus(status) {
    return await databaseService.getByIndex(STORES.ACTIVITIES, 'status', status);
  }

  async getByProjectId(projectId) {
    return await databaseService.getByIndex(STORES.ACTIVITIES, 'projectId', projectId);
  }

  async getByRecurrenceRuleId(ruleId) {
    return await databaseService.getByIndex(STORES.ACTIVITIES, 'recurrenceRuleId', ruleId);
  }

  async getStarred(minStars = 4) {
    const all = await this.getAll();
    return all.filter(a => Number(a.stars) >= minStars).sort((a, b) => Number(b.stars) - Number(a.stars));
  }

  async add(activity) {
    return await databaseService.add(STORES.ACTIVITIES, activity);
  }

  async update(activity) {
    return await databaseService.update(STORES.ACTIVITIES, activity);
  }

  async delete(id) {
    return await databaseService.delete(STORES.ACTIVITIES, id);
  }

  async deleteMany(ids) {
    return await databaseService.deleteMany(STORES.ACTIVITIES, ids);
  }
}

export const activityRepository = new ActivityRepository();
