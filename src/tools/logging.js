/**
 * Logging tools — hmn_log_build and hmn_submit_homework.
 */

const { z } = require('zod');

function registerLoggingTools(server, http, logger, syncEngine) {

  // ─── hmn_log_build ────────────────────────────────────────────────────
  server.tool(
    'hmn_log_build',
    'Log something you built — tell the system what you created',
    {
      description: z.string().describe('What you built — describe it in plain language'),
      tools_used: z.array(z.string()).optional().describe('Tools you used (e.g. ["Firecrawl", "Claude", "Chrome DevTools"])')
    },
    async ({ description, tools_used }) => {
      try {
        // Write build_logged event to activity log
        logger.logEvent({
          event_type: 'build_logged',
          data: {
            description,
            tools_used: tools_used || []
          }
        }, { force: true });

        // Trigger immediate sync so the platform sees it right away
        if (syncEngine) {
          syncEngine.resetAuthError();
          syncEngine.syncNow().catch(() => {
            // Non-blocking — ignore sync errors
          });
        }

        let text = `## Build Logged\n\n`;
        text += `**What you built:** ${description}\n`;
        if (tools_used && tools_used.length > 0) {
          text += `**Tools used:** ${tools_used.join(', ')}\n`;
        }
        text += `\nYour build has been recorded and will be synced to the platform. `;
        text += `Builds like this help demonstrate your AI maturity growth.\n`;

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error logging build: ${err.message}` }] };
      }
    }
  );

  // ─── hmn_submit_homework ──────────────────────────────────────────────
  server.tool(
    'hmn_submit_homework',
    'Submit your homework assignment',
    {
      module_number: z.number().describe('Module number (e.g. 1, 2, 3)'),
      description: z.string().describe('Describe what you did for the homework'),
      files_created: z.array(z.string()).optional().describe('File paths or names you created for this assignment')
    },
    async ({ module_number, description, files_created }) => {
      try {
        // POST to platform to mark progress
        let progressResult = null;
        try {
          progressResult = await http.post('/api/masterclass/progress', {
            module_number,
            description,
            files_created: files_created || []
          });
        } catch (apiErr) {
          // Log the event even if the API call fails
          process.stderr.write(
            `[hmn-mcp] Progress API error (event still logged locally): ${apiErr.message}\n`
          );
        }

        // Write homework_submitted event to activity log
        logger.logEvent({
          event_type: 'homework_submitted',
          data: {
            module_number,
            description,
            file_names: files_created || [],
            success: progressResult !== null
          }
        }, { force: true });

        // Trigger immediate sync
        if (syncEngine) {
          syncEngine.resetAuthError();
          syncEngine.syncNow().catch(() => {
            // Non-blocking
          });
        }

        let text = `## Homework Submitted\n\n`;
        text += `**Module ${module_number}**\n`;
        text += `**Description:** ${description}\n`;
        if (files_created && files_created.length > 0) {
          text += `**Files:** ${files_created.join(', ')}\n`;
        }
        text += `\n`;

        if (progressResult) {
          text += `Your submission has been recorded on the platform.\n`;
          if (progressResult.next_assignment) {
            text += `\n### Next Assignment\n`;
            text += `${progressResult.next_assignment}\n`;
          }
        } else {
          text += `Your submission has been logged locally and will sync when the platform is available.\n`;
        }

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error submitting homework: ${err.message}` }] };
      }
    }
  );
}

module.exports = { registerLoggingTools };
