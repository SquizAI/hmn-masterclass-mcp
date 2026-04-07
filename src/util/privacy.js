/**
 * Privacy utilities — truncation, path stripping, secret redaction.
 * All sanitization happens before any event is written to disk or sent to the API.
 */

const path = require('path');

const SECRET_PATTERNS = [
  // Generic API keys / tokens
  /(?:api[_-]?key|apikey|token|secret|password|passwd|authorization|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{8,}['"]?/gi,
  // AWS
  /AKIA[0-9A-Z]{16}/g,
  // GitHub
  /gh[pso]_[A-Za-z0-9_]{36,}/g,
  // Slack
  /xox[bporas]-[A-Za-z0-9-]+/g,
  // Generic long hex/base64 strings that look like secrets (32+ chars)
  /(?:sk|pk|key|token|secret)[_-][A-Za-z0-9]{32,}/gi,
  // HMN API keys
  /hmn_ak_[A-Za-z0-9_\-]{16,}/g,
  // Bearer tokens in text
  /Bearer\s+[A-Za-z0-9_\-./+=]{20,}/gi,
  // Connection strings
  /(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/gi
];

/**
 * Truncate prompt text to 200 characters.
 */
function sanitizePrompt(text) {
  if (!text || typeof text !== 'string') return '';
  return text.length > 200 ? text.slice(0, 200) + '...' : text;
}

/**
 * Extract only the last folder name from a full path.
 * /Users/matty/Documents/my-project/src/index.js → my-project
 */
function sanitizePath(fullPath) {
  if (!fullPath || typeof fullPath !== 'string') return '';
  // Normalize and split
  const normalized = path.normalize(fullPath);
  const parts = normalized.split(path.sep).filter(Boolean);
  // If it looks like a file path, return the parent folder name
  if (parts.length === 0) return '';
  // Check if last segment has an extension (it's a file)
  const last = parts[parts.length - 1];
  if (last.includes('.') && parts.length > 1) {
    return parts[parts.length - 2] + '/';
  }
  return last + '/';
}

/**
 * Strip patterns matching API keys, tokens, passwords from text.
 */
function redactSecrets(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;
  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  return cleaned;
}

/**
 * Apply all sanitization to an ActivityEvent before logging.
 */
function sanitizeEvent(event) {
  if (!event) return event;

  const sanitized = { ...event };

  if (sanitized.data) {
    sanitized.data = { ...sanitized.data };

    // Truncate prompt summaries
    if (sanitized.data.prompt_summary) {
      sanitized.data.prompt_summary = redactSecrets(
        sanitizePrompt(sanitized.data.prompt_summary)
      );
    }

    // Strip file paths to folder names
    if (sanitized.data.project_dir) {
      sanitized.data.project_dir = sanitizePath(sanitized.data.project_dir);
    }

    // Sanitize file names — keep names but redact any secret-looking names
    if (Array.isArray(sanitized.data.file_names)) {
      sanitized.data.file_names = sanitized.data.file_names.map((f) =>
        redactSecrets(path.basename(f))
      );
    }

    // Redact secrets from description
    if (sanitized.data.description) {
      sanitized.data.description = redactSecrets(sanitized.data.description);
    }

    // Redact secrets from tool names (unlikely but safe)
    if (Array.isArray(sanitized.data.tools_used)) {
      sanitized.data.tools_used = sanitized.data.tools_used.map((t) =>
        redactSecrets(t)
      );
    }
  }

  return sanitized;
}

module.exports = {
  sanitizePrompt,
  sanitizePath,
  redactSecrets,
  sanitizeEvent
};
