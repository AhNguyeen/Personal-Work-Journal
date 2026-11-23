/**
 * settingsRepository.js - Data access for user preferences & active state in IndexedDB
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class SettingsRepository {
  async get(key, defaultValue = null) {
    const record = await databaseService.getById(STORES.SETTINGS, key);
    return record ? record.value : defaultValue;
  }

  async set(key, value) {
    return await databaseService.update(STORES.SETTINGS, { key, value });
  }

  async getAll() {
    return await databaseService.getAll(STORES.SETTINGS);
  }
}

export const settingsRepository = new SettingsRepository();
