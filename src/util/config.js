/**
 * Configuration management — reads from env vars + ~/.hmn/config.json.
 * Env vars always take precedence over the config file.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.hmn');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Ensure ~/.hmn/ directory exists.
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Get the path to the ~/.hmn/ directory.
 */
function getConfigPath() {
  ensureConfigDir();
  return CONFIG_DIR;
}

/**
 * Load config from env vars + ~/.hmn/config.json.
 * Env vars take precedence over file values.
 */
function loadConfig() {
  ensureConfigDir();

  // Read file config if it exists
  let fileConfig = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch {
      // Corrupted config file — ignore it
    }
  }

  // Merge: env vars override file config
  const config = {
    email: process.env.HMN_EMAIL || fileConfig.email || '',
    api_key: process.env.HMN_API_KEY || fileConfig.api_key || '',
    api_host: process.env.HMN_API_HOST || fileConfig.api_host || 'https://behmn.com',
    tracking_enabled:
      fileConfig.tracking_enabled !== undefined
        ? fileConfig.tracking_enabled
        : true,
    sync_interval_ms:
      fileConfig.sync_interval_ms !== undefined
        ? fileConfig.sync_interval_ms
        : 60000
  };

  return config;
}

/**
 * Write updates to ~/.hmn/config.json.
 * Merges with existing config — does not overwrite unrelated keys.
 */
function saveConfig(updates) {
  ensureConfigDir();

  let existing = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      existing = JSON.parse(raw);
    } catch {
      // Start fresh
    }
  }

  const merged = { ...existing, ...updates };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  return merged;
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfigPath,
  ensureConfigDir
};
