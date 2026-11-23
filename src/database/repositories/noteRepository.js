/**
 * noteRepository.js - Data access for Multiple Notes in a day or project
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class NoteRepository {
  async getAll() {
    return await databaseService.getAll(STORES.NOTES);
  }

  async getById(id) {
    return await databaseService.getById(STORES.NOTES, id);
  }

  async getByDate(dateStr) {
    return await databaseService.getByIndex(STORES.NOTES, 'date', dateStr);
  }

  async getPinned() {
    const all = await this.getAll();
    return all.filter(n => n.isPinned);
  }

  async add(note) {
    return await databaseService.add(STORES.NOTES, note);
  }

  async update(note) {
    return await databaseService.update(STORES.NOTES, note);
  }

  async delete(id) {
    return await databaseService.delete(STORES.NOTES, id);
  }
}

export const noteRepository = new NoteRepository();
