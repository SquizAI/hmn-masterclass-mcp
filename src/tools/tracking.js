/**
 * Tracking control tools — hmn_pause_tracking and hmn_resume_tracking.
 */

const { z } = require('zod');
const { loadConfig, saveConfig } = require('../util/config');

function registerTrackingTools(server, http, logger) {

  // ─── hmn_pause_tracking ───────────────────────────────────────────────
  server.tool(
    'hmn_pause_tracking',
    'Pause passive activity tracking — your explicit actions (log_build, submit_homework) still work',
    {},
    async () => {
      try {
        saveConfig({ tracking_enabled: false });
        logger.setTracking(false);

        let text = `## Tracking Paused\n\n`;
        text += `Passive activity tracking is now **disabled**.\n\n`;
        text += `**What still works:**\n`;
        text += `- \`hmn_log_build\` — explicitly log something you built\n`;
        text += `- \`hmn_submit_homework\` — submit homework assignments\n`;
        text += `- \`hmn_check_progress\` — check your progress\n`;
        text += `- All other MCP tools\n\n`;
        text += `**What's paused:**\n`;
        text += `- Automatic logging of tasks, sessions, and tool usage\n\n`;
        text += `Use \`hmn_resume_tracking\` to re-enable passive tracking.\n`;

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error pausing tracking: ${err.message}` }] };
      }
    }
  );

  // ─── hmn_resume_tracking ──────────────────────────────────────────────
  server.tool(
    'hmn_resume_tracking',
    'Resume passive activity tracking',
    {},
    async () => {
      try {
        saveConfig({ tracking_enabled: true });
        logger.setTracking(true);

        let text = `## Tracking Resumed\n\n`;
        text += `Passive activity tracking is now **enabled**.\n\n`;
        text += `Your activity (tasks, tool usage, sessions) will be logged locally `;
        text += `and synced to the platform to help personalize your learning experience.\n\n`;
        text += `**Privacy:** Only metadata is tracked (tool names, task counts, session durations). `;
        text += `File contents and full prompts are never logged. `;
        text += `Prompts are truncated to 200 characters and secrets are redacted.\n`;

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error resuming tracking: ${err.message}` }] };
      }
    }
  );
}

module.exports = { registerTrackingTools };
