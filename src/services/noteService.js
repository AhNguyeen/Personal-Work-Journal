/**
 * noteService.js - Business logic for Daily Notes (comprehensive) and Multiple Notes
 */

import { dailyNoteRepository } from '../database/repositories/dailyNoteRepository.js';
import { noteRepository } from '../database/repositories/noteRepository.js';
import { validateNote } from '../utils/validation.js';
import { generateId } from '../utils/formatters.js';

class NoteService {
  // ================= Daily Note Section =================

  /**
   * Get or initialize daily note for a given date
   * @param {string} dateStr 'YYYY-MM-DD'
   */
  async getDailyNote(dateStr) {
    let note = await dailyNoteRepository.getByDate(dateStr);
    if (!note) {
      note = {
        id: generateId('daily'),
        date: dateStr,
        whatDone: '',
        whatLearned: '',
        achievements: '',
        obstacles: '',
        unfinished: '',
        tomorrowPlan: '',
        rating: 4,
        isNew: true
      };
    }
    return note;
  }

  /**
   * Save Daily Note
   */
  async saveDailyNote(dailyNote) {
    if (!dailyNote.date) throw new Error('Ngày của Daily Note không được để trống');
    const noteToSave = { ...dailyNote };
    delete noteToSave.isNew;

    const saved = await dailyNoteRepository.save(noteToSave);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('journal:dailynote-changed', { detail: saved }));
    }
    return saved;
  }

  // ================= Multiple Notes Section =================

  async getAllNotes() {
    const notes = await noteRepository.getAll();
    return notes.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
  }

  async getNotesByDate(dateStr) {
    const list = await noteRepository.getByDate(dateStr);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createNote(data) {
    const validation = validateNote(data);
    if (!validation.isValid) {
      throw new Error(Object.values(validation.errors)[0]);
    }

    const newNote = {
      id: data.id || generateId('note'),
      title: data.title.trim(),
      content: data.content || '',
      category: data.category || 'General',
      date: data.date,
      isPinned: Boolean(data.isPinned)
    };

    const saved = await noteRepository.add(newNote);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('journal:notes-changed', { detail: { type: 'create', data: saved } }));
    }
    return saved;
  }

  async updateNote(data) {
    const validation = validateNote(data);
    if (!validation.isValid) {
      throw new Error(Object.values(validation.errors)[0]);
    }

    const existing = await noteRepository.getById(data.id);
    if (!existing) throw new Error('Ghi chú không tồn tại');

    const updated = {
      ...existing,
      title: data.title.trim(),
      content: data.content !== undefined ? data.content : existing.content,
      category: data.category || existing.category,
      date: data.date || existing.date,
      isPinned: data.isPinned !== undefined ? Boolean(data.isPinned) : existing.isPinned
    };

    const saved = await noteRepository.update(updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('journal:notes-changed', { detail: { type: 'update', data: saved } }));
    }
    return saved;
  }

  async togglePin(id) {
    const note = await noteRepository.getById(id);
    if (!note) throw new Error('Không tìm thấy ghi chú');
    note.isPinned = !note.isPinned;
    const saved = await noteRepository.update(note);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('journal:notes-changed', { detail: { type: 'update', data: saved } }));
    }
    return saved;
  }

  async deleteNote(id) {
    await noteRepository.delete(id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('journal:notes-changed', { detail: { type: 'delete', id } }));
    }
    return true;
  }
}

export const noteService = new NoteService();
