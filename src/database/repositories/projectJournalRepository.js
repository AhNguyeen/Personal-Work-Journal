/**
 * projectJournalRepository.js - Data access for ProjectJournalEntry entity
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class ProjectJournalRepository {
  async getAll() {
    return await databaseService.getAll(STORES.PROJECT_JOURNAL_ENTRIES);
  }

  async getById(id) {
    return await databaseService.getById(STORES.PROJECT_JOURNAL_ENTRIES, id);
  }

  async getByProjectId(projectId) {
    return await databaseService.getByIndex(STORES.PROJECT_JOURNAL_ENTRIES, 'projectId', projectId);
  }

  async getByDate(dateStr) {
    return await databaseService.getByIndex(STORES.PROJECT_JOURNAL_ENTRIES, 'date', dateStr);
  }

  async add(entry) {
    return await databaseService.add(STORES.PROJECT_JOURNAL_ENTRIES, entry);
  }

  async update(entry) {
    return await databaseService.update(STORES.PROJECT_JOURNAL_ENTRIES, entry);
  }

  async delete(id) {
    return await databaseService.delete(STORES.PROJECT_JOURNAL_ENTRIES, id);
  }
}

export const projectJournalRepository = new ProjectJournalRepository();
