/**
 * timerService.js - Robust Stopwatch and Time Tracking with full IndexedDB persistence
 * Survives page reloads without losing a single second.
 */

import { timerRepository } from '../database/repositories/timerRepository.js';
import { settingsRepository } from '../database/repositories/settingsRepository.js';
import { activityRepository } from '../database/repositories/activityRepository.js';
import { generateId } from '../utils/formatters.js';

const TIMER_STORAGE_KEY = 'active_stopwatch_state';

class TimerService {
  constructor() {
    this.state = {
      status: 'idle', // 'idle' | 'running' | 'paused'
      sessionId: null,
      activityId: null,
      activityTitle: '',
      startTimestamp: null, // Date.now() when last started/resumed
      accumulatedSeconds: 0 // total seconds accumulated before current run stretch
    };
    this.intervalId = null;
    this.listeners = new Set();
  }

  /**
   * Initialize timer from IndexedDB on app startup
   */
  async initTimer() {
    try {
      const savedState = await settingsRepository.get(TIMER_STORAGE_KEY, null);
      if (savedState && savedState.status && savedState.status !== 'idle') {
        this.state = savedState;
        if (this.state.status === 'running') {
          this._startTicker();
        }
        this._notifyListeners();
      }
    } catch (err) {
      console.warn('Could not restore timer state:', err);
    }
  }

  /**
   * Subscribe to timer tick updates
   * @param {Function} callback (state, currentSeconds) => void
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.state, this.getCurrentSeconds());
    return () => this.listeners.delete(callback);
  }

  /**
   * Calculate current accurate elapsed seconds
   */
  getCurrentSeconds() {
    if (this.state.status === 'idle') return 0;
    let total = this.state.accumulatedSeconds || 0;
    if (this.state.status === 'running' && this.state.startTimestamp) {
      const elapsed = Math.floor((Date.now() - this.state.startTimestamp) / 1000);
      total += Math.max(0, elapsed);
    }
    return total;
  }

  /**
   * Start timer for an activity
   * @param {Object} activity { id, title }
   */
  async start(activity) {
    if (this.state.status === 'running' || this.state.status === 'paused') {
      if (this.state.activityId === activity.id && this.state.status === 'paused') {
        return this.resume();
      }
      throw new Error('Đang có một phiên Timer khác hoạt động. Vui lòng dừng phiên hiện tại trước khi bắt đầu phiên mới.');
    }

    const sessionId = generateId('session');
    const now = Date.now();

    this.state = {
      status: 'running',
      sessionId,
      activityId: activity.id,
      activityTitle: activity.title,
      startTimestamp: now,
      accumulatedSeconds: 0
    };

    // Save session in DB
    await timerRepository.add({
      id: sessionId,
      activityId: activity.id,
      activityTitle: activity.title,
      startTime: new Date(now).toISOString(),
      endTime: null,
      status: 'running',
      type: 'timer',
      totalSeconds: 0
    });

    await this._persistState();
    this._startTicker();
    this._notifyListeners();
    return this.state;
  }

  /**
   * Pause the active timer
   */
  async pause() {
    if (this.state.status !== 'running') return;

    const currentTotal = this.getCurrentSeconds();
    this.state.status = 'paused';
    this.state.accumulatedSeconds = currentTotal;
    this.state.startTimestamp = null;

    this._stopTicker();
    await this._persistState();

    if (this.state.sessionId) {
      const session = await timerRepository.getById(this.state.sessionId);
      if (session) {
        session.status = 'paused';
        session.totalSeconds = currentTotal;
        await timerRepository.update(session);
      }
    }

    this._notifyListeners();
  }

  /**
   * Resume paused timer
   */
  async resume() {
    if (this.state.status !== 'paused') return;

    this.state.status = 'running';
    this.state.startTimestamp = Date.now();

    await this._persistState();
    this._startTicker();

    if (this.state.sessionId) {
      const session = await timerRepository.getById(this.state.sessionId);
      if (session) {
        session.status = 'running';
        await timerRepository.update(session);
      }
    }

    this._notifyListeners();
  }

  /**
   * Stop timer, record session, and update target activity's actual duration
   */
  async stop() {
    if (this.state.status === 'idle') return null;

    const totalSecs = this.getCurrentSeconds();
    const finalActivityId = this.state.activityId;
    const finalSessionId = this.state.sessionId;

    this._stopTicker();

    // Complete session record in DB
    if (finalSessionId) {
      const session = await timerRepository.getById(finalSessionId);
      if (session) {
        session.status = 'completed';
        session.endTime = new Date().toISOString();
        session.totalSeconds = totalSecs;
        session.type = session.type || 'timer';
        await timerRepository.update(session);
      }
    }

    // Attach actual logged minutes to activity with strict provenance separation
    if (finalActivityId && totalSecs > 0) {
      const act = await activityRepository.getById(finalActivityId);
      if (act) {
        // Query all completed sessions to calculate accurate verified durations
        const allSessions = await timerRepository.getByActivityId(finalActivityId);
        let timerSeconds = 0;
        let manualSeconds = 0;

        for (const s of allSessions) {
          const sType = s.type || 'timer';
          const sSecs = s.status === 'completed' ? (Number(s.totalSeconds) || 0) : 0;
          if (sType === 'timer' || sType === 'pomodoro') {
            timerSeconds += sSecs;
          } else if (sType === 'manual') {
            manualSeconds += sSecs;
          }
        }

        const totalVerifiedSecs = timerSeconds + manualSeconds;
        act.actualDurationSeconds = totalVerifiedSecs;
        act.actualDurationMinutes = Math.round(totalVerifiedSecs / 60);
        act.actualDurationSource = timerSeconds > 0 ? 'timer_verified' : (manualSeconds > 0 ? 'manual_verified' : 'timer_verified');
        act.timerSeconds = timerSeconds;
        act.manualSeconds = manualSeconds;
        act.status = 'Completed';
        await activityRepository.update(act);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('journal:activity-changed', { detail: { type: 'update', data: act } }));
        }
      }
    }

    const completedSummary = {
      sessionId: finalSessionId,
      activityId: finalActivityId,
      totalSeconds: totalSecs,
      totalMinutes: Math.round(totalSecs / 60)
    };

    // Reset state to idle
    this.state = {
      status: 'idle',
      sessionId: null,
      activityId: null,
      activityTitle: '',
      startTimestamp: null,
      accumulatedSeconds: 0
    };

    await this._persistState();
    this._notifyListeners();
    return completedSummary;
  }

  /**
   * Reset without saving
   */
  async reset() {
    this._stopTicker();
    if (this.state.sessionId) {
      await timerRepository.delete(this.state.sessionId);
    }

    this.state = {
      status: 'idle',
      sessionId: null,
      activityId: null,
      activityTitle: '',
      startTimestamp: null,
      accumulatedSeconds: 0
    };

    await this._persistState();
    this._notifyListeners();
  }

  _startTicker() {
    this._stopTicker();
    this.intervalId = setInterval(() => {
      this._notifyListeners();
    }, 1000);
  }

  _stopTicker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async _persistState() {
    await settingsRepository.set(TIMER_STORAGE_KEY, this.state);
  }

  _notifyListeners() {
    const currentSecs = this.getCurrentSeconds();
    for (const listener of this.listeners) {
      try {
        listener(this.state, currentSecs);
      } catch (e) {
        console.error('Error in timer listener:', e);
      }
    }
  }
}

export const timerService = new TimerService();
