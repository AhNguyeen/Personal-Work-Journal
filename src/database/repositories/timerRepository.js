/**
 * timerRepository.js - Data access for Timer Sessions
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class TimerRepository {
  async getAll() {
    return await databaseService.getAll(STORES.TIMER_SESSIONS);
  }

  async getById(id) {
    return await databaseService.getById(STORES.TIMER_SESSIONS, id);
  }

  async getByActivityId(activityId) {
    return await databaseService.getByIndex(STORES.TIMER_SESSIONS, 'activityId', activityId);
  }

  async getActiveSession() {
    const all = await this.getAll();
    return all.find(s => s.status === 'running' || s.status === 'paused') || null;
  }

  async add(session) {
    return await databaseService.add(STORES.TIMER_SESSIONS, session);
  }

  async update(session) {
    return await databaseService.update(STORES.TIMER_SESSIONS, session);
  }

  async delete(id) {
    return await databaseService.delete(STORES.TIMER_SESSIONS, id);
  }
}

export const timerRepository = new TimerRepository();
