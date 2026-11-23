/**
 * goalRepository.js - Data access for Goals
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class GoalRepository {
  async getAll() {
    return await databaseService.getAll(STORES.GOALS);
  }

  async getById(id) {
    return await databaseService.getById(STORES.GOALS, id);
  }

  async getByPeriod(period) {
    return await databaseService.getByIndex(STORES.GOALS, 'period', period);
  }

  async add(goal) {
    return await databaseService.add(STORES.GOALS, goal);
  }

  async update(goal) {
    return await databaseService.update(STORES.GOALS, goal);
  }

  async delete(id) {
    return await databaseService.delete(STORES.GOALS, id);
  }
}

export const goalRepository = new GoalRepository();
