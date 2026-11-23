/**
 * dailyNoteRepository.js - Data access for Daily Notes (one comprehensive reflection per day)
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class DailyNoteRepository {
  async getAll() {
    return await databaseService.getAll(STORES.DAILY_NOTES);
  }

  async getById(id) {
    return await databaseService.getById(STORES.DAILY_NOTES, id);
  }

  async getByDate(dateStr) {
    const records = await databaseService.getByIndex(STORES.DAILY_NOTES, 'date', dateStr);
    return records.length > 0 ? records[0] : null;
  }

  async save(dailyNote) {
    if (dailyNote.id) {
      const existing = await this.getById(dailyNote.id);
      if (existing) {
        return await databaseService.update(STORES.DAILY_NOTES, dailyNote);
      }
    }
    return await databaseService.add(STORES.DAILY_NOTES, dailyNote);
  }

  async delete(id) {
    return await databaseService.delete(STORES.DAILY_NOTES, id);
  }
}

export const dailyNoteRepository = new DailyNoteRepository();
