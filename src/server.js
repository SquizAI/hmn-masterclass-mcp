/**
 * @hmn/masterclass-mcp — MCP Server
 *
 * Adaptive learning server for HMN Masterclass participants.
 * Exposes tools for progress tracking, personalized prompts, build logging,
 * and homework submission. Passively logs activity and syncs to the platform.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { loadConfig } = require('./util/config');
const { createHttpClient } = require('./util/http-client');
const { ActivityLogger } = require('./activity/logger');
const { startSync } = require('./activity/sync');
const { registerProgressTools } = require('./tools/progress');
const { registerContentTools } = require('./tools/content');
const { registerLoggingTools } = require('./tools/logging');
const { registerTrackingTools } = require('./tools/tracking');

function createServer(config) {
  const server = new McpServer({
    name: 'hmn-masterclass',
    version: '1.0.0'
  });

  // Initialize HTTP client
  const http = createHttpClient(config);

  // Initialize activity logger
  const logger = new ActivityLogger(config);

  // Initialize sync engine (background interval)
  const syncEngine = startSync(config, http, logger);

  // Register all tool groups
  registerProgressTools(server, http, logger);
  registerContentTools(server, http, logger);
  registerLoggingTools(server, http, logger, syncEngine);
  registerTrackingTools(server, http, logger);

  // Log session_start event
  logger.logEvent({
    event_type: 'session_start',
    data: {
      timestamp: new Date().toISOString()
    }
  });

  // Handle process exit — log session_end and stop sync
  const cleanup = () => {
    logger.logEvent({
      event_type: 'session_end',
      data: {
        timestamp: new Date().toISOString()
      }
    }, { force: true });
    syncEngine.stop();
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  process.on('exit', () => {
    // Best-effort — synchronous only at this point
    try {
      logger.logEvent({
        event_type: 'session_end',
        data: {
          timestamp: new Date().toISOString()
        }
      }, { force: true });
    } catch {
      // Can't do anything here
    }
  });

  return server;
}

async function main() {
  const config = loadConfig();

  // Validate required config
  if (!config.email) {
    process.stderr.write(
      'Error: HMN_EMAIL environment variable is required.\n' +
      'Set it in your MCP server config:\n' +
      '  "env": { "HMN_EMAIL": "your.email@company.com" }\n'
    );
    process.exit(1);
  }

  if (!config.api_key) {
    process.stderr.write(
      'Error: HMN_API_KEY environment variable is required.\n' +
      'Generate one at https://behmn.com/dashboard → Settings → API Key\n' +
      'Then set it in your MCP server config:\n' +
      '  "env": { "HMN_API_KEY": "hmn_ak_..." }\n'
    );
    process.exit(1);
  }

  process.stderr.write(
    `[hmn-mcp] Starting HMN Masterclass MCP server for ${config.email}\n` +
    `[hmn-mcp] API host: ${config.api_host}\n` +
    `[hmn-mcp] Tracking: ${config.tracking_enabled ? 'enabled' : 'disabled'}\n` +
    `[hmn-mcp] Sync interval: ${config.sync_interval_ms / 1000}s\n`
  );

  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

module.exports = { createServer, main };
