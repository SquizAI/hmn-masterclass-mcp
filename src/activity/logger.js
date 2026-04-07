/**
 * Activity logger — appends sanitized JSON-line events to ~/.hmn/activity.jsonl.
 * Thread-safe via appendFileSync (simplest approach in single-process MCP context).
 */

const fs = require('fs');
const path = require('path');
const { ensureConfigDir } = require('../util/config');
const { sanitizeEvent } = require('../util/privacy');

const ACTIVITY_FILE = 'activity.jsonl';

class ActivityLogger {
  constructor(config) {
    this.config = config;
    this.trackingEnabled = config.tracking_enabled !== false;
    ensureConfigDir();
    this.filePath = path.join(require('../util/config').getConfigPath(), ACTIVITY_FILE);
  }

  /**
   * Log a single event to activity.jsonl.
   * Applies privacy sanitization before writing.
   * Silently skips if tracking is disabled (except for explicit user actions).
   *
   * @param {Object} event - ActivityEvent object
   * @param {Object} [options] - { force: boolean } — force logging even if tracking disabled
   */
  logEvent(event, options = {}) {
    // Allow force-logging for explicit user actions (log_build, submit_homework)
    if (!this.trackingEnabled && !options.force) {
      return;
    }

    try {
      const enriched = {
        timestamp: new Date().toISOString(),
        participant_email: this.config.email,
        ...event
      };

      const sanitized = sanitizeEvent(enriched);
      const line = JSON.stringify(sanitized) + '\n';

      fs.appendFileSync(this.filePath, line, 'utf-8');
    } catch (err) {
      // Never throw from logger — just write to stderr
      process.stderr.write(`[hmn-mcp] Logger error: ${err.message}\n`);
    }
  }

  /**
   * Set tracking enabled/disabled state.
   */
  setTracking(enabled) {
    this.trackingEnabled = enabled;
  }

  /**
   * Get the path to the activity log file.
   */
  getFilePath() {
    return this.filePath;
  }
}

module.exports = { ActivityLogger };
