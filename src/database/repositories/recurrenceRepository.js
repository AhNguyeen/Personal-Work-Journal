/**
 * recurrenceRepository.js - Data access for RecurrenceRule entity
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class RecurrenceRepository {
  async getAll() {
    return await databaseService.getAll(STORES.RECURRENCE_RULES);
  }

  async getById(id) {
    return await databaseService.getById(STORES.RECURRENCE_RULES, id);
  }

  async getByType(recurrenceType) {
    return await databaseService.getByIndex(STORES.RECURRENCE_RULES, 'recurrenceType', recurrenceType);
  }

  async add(rule) {
    return await databaseService.add(STORES.RECURRENCE_RULES, rule);
  }

  async update(rule) {
    return await databaseService.update(STORES.RECURRENCE_RULES, rule);
  }

  async delete(id) {
    return await databaseService.delete(STORES.RECURRENCE_RULES, id);
  }
}

export const recurrenceRepository = new RecurrenceRepository();
