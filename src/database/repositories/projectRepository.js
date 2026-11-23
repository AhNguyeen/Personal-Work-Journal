/**
 * projectRepository.js - Data access for Project entity
 */

import { databaseService } from '../databaseService.js';
import { STORES } from '../db.js';

class ProjectRepository {
  async getAll() {
    return await databaseService.getAll(STORES.PROJECTS);
  }

  async getById(id) {
    return await databaseService.getById(STORES.PROJECTS, id);
  }

  async getByStatus(status) {
    return await databaseService.getByIndex(STORES.PROJECTS, 'status', status);
  }

  async getByCategory(category) {
    return await databaseService.getByIndex(STORES.PROJECTS, 'category', category);
  }

  async add(project) {
    return await databaseService.add(STORES.PROJECTS, project);
  }

  async update(project) {
    return await databaseService.update(STORES.PROJECTS, project);
  }

  async delete(id) {
    return await databaseService.delete(STORES.PROJECTS, id);
  }
}

export const projectRepository = new ProjectRepository();
