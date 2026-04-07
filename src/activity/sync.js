/**
 * Background sync engine — reads events from activity.jsonl after sync_cursor,
 * batches them, and POSTs to the platform API.
 *
 * Non-blocking: sync failures never affect MCP tool responses.
 * Exponential backoff: 60s -> 120s -> 240s -> 600s max on failure.
 */

const fs = require('fs');
const path = require('path');
const { getConfigPath } = require('../util/config');

const SYNC_CURSOR_FILE = 'sync_cursor.txt';
const ACTIVITY_FILE = 'activity.jsonl';
const MAX_BATCH_SIZE = 100;
const MAX_BACKOFF_MS = 600000; // 10 minutes

class SyncEngine {
  constructor(config, httpClient, logger) {
    this.config = config;
    this.http = httpClient;
    this.logger = logger;
    this.intervalId = null;
    this.currentIntervalMs = config.sync_interval_ms || 60000;
    this.baseIntervalMs = this.currentIntervalMs;
    this.backoffMultiplier = 1;
    this.authError = false;

    const configDir = getConfigPath();
    this.cursorPath = path.join(configDir, SYNC_CURSOR_FILE);
    this.activityPath = path.join(configDir, ACTIVITY_FILE);
  }

  /**
   * Start the background sync interval.
   */
  start() {
    // Run an initial sync after a short delay to catch any pending events
    setTimeout(() => this.sync(), 5000);

    this.intervalId = setInterval(() => {
      this.sync();
    }, this.currentIntervalMs);

    return this;
  }

  /**
   * Stop the background sync.
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Trigger an immediate sync (used after log_build, submit_homework).
   */
  async syncNow() {
    return this.sync();
  }

  /**
   * Read the current sync cursor (line number of last synced line).
   */
  readCursor() {
    try {
      if (fs.existsSync(this.cursorPath)) {
        const raw = fs.readFileSync(this.cursorPath, 'utf-8').trim();
        const num = parseInt(raw, 10);
        return isNaN(num) ? 0 : num;
      }
    } catch {
      // Ignore
    }
    return 0;
  }

  /**
   * Write the sync cursor.
   */
  writeCursor(lineNumber) {
    try {
      fs.writeFileSync(this.cursorPath, String(lineNumber), 'utf-8');
    } catch (err) {
      process.stderr.write(`[hmn-mcp] Failed to write sync cursor: ${err.message}\n`);
    }
  }

  /**
   * Read unsynced lines from activity.jsonl.
   */
  readUnsyncedEvents() {
    try {
      if (!fs.existsSync(this.activityPath)) {
        return { events: [], totalLines: 0 };
      }

      const content = fs.readFileSync(this.activityPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);
      const cursor = this.readCursor();

      // Get lines after the cursor
      const unsyncedLines = lines.slice(cursor);
      const events = [];

      for (const line of unsyncedLines.slice(0, MAX_BATCH_SIZE)) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }

      return { events, totalLines: lines.length, cursor };
    } catch (err) {
      process.stderr.write(`[hmn-mcp] Failed to read activity log: ${err.message}\n`);
      return { events: [], totalLines: 0, cursor: 0 };
    }
  }

  /**
   * Core sync method — reads unsynced events and POSTs them to the API.
   */
  async sync() {
    // Don't retry if we got a 401
    if (this.authError) return;

    try {
      const { events, totalLines, cursor } = this.readUnsyncedEvents();

      if (events.length === 0) return;

      await this.http.post('/api/masterclass/activity', {
        participant_email: this.config.email,
        events
      });

      // Success — advance cursor
      const newCursor = cursor + events.length;
      this.writeCursor(newCursor);

      // Reset backoff on success
      this.resetBackoff();

      process.stderr.write(
        `[hmn-mcp] Synced ${events.length} events (cursor: ${newCursor}/${totalLines})\n`
      );
    } catch (err) {
      // Check for auth errors — don't retry
      if (err.message && err.message.includes('401')) {
        this.authError = true;
        process.stderr.write(
          `[hmn-mcp] Auth error during sync — will not retry until next manual trigger.\n`
        );
        return;
      }

      // Apply exponential backoff
      this.applyBackoff();
      process.stderr.write(
        `[hmn-mcp] Sync failed (next retry in ${this.currentIntervalMs / 1000}s): ${err.message}\n`
      );
    }
  }

  /**
   * Apply exponential backoff — doubles the interval up to MAX_BACKOFF_MS.
   */
  applyBackoff() {
    this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, MAX_BACKOFF_MS / this.baseIntervalMs);
    this.currentIntervalMs = Math.min(this.baseIntervalMs * this.backoffMultiplier, MAX_BACKOFF_MS);

    // Restart interval with new timing
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.sync(), this.currentIntervalMs);
    }
  }

  /**
   * Reset backoff to base interval after a successful sync.
   */
  resetBackoff() {
    if (this.backoffMultiplier !== 1) {
      this.backoffMultiplier = 1;
      this.currentIntervalMs = this.baseIntervalMs;

      // Restart interval with base timing
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.sync(), this.currentIntervalMs);
      }
    }
  }

  /**
   * Reset auth error flag (called when user manually triggers sync).
   */
  resetAuthError() {
    this.authError = false;
  }
}

/**
 * Factory: create and start the sync engine.
 */
function startSync(config, httpClient, logger) {
  const engine = new SyncEngine(config, httpClient, logger);
  engine.start();
  return engine;
}

module.exports = { SyncEngine, startSync };
