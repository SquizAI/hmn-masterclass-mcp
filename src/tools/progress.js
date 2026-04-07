/**
 * Progress tools — hmn_check_progress and hmn_whats_next.
 */

const { z } = require('zod');

function registerProgressTools(server, http, logger) {

  // ─── hmn_check_progress ───────────────────────────────────────────────
  server.tool(
    'hmn_check_progress',
    'Check your masterclass progress — current level, completed sections, what\'s next',
    {},
    async () => {
      try {
        const profile = await http.get('/api/masterclass/me');

        const maturityLevel = profile.maturity_level || profile.maturityLevel || 0;
        const maturityLabel = getLevelLabel(maturityLevel);
        const modules = profile.modules || [];
        const totalSections = modules.reduce(
          (acc, m) => acc + (m.sections?.length || 0), 0
        );
        const completedSections = modules.reduce(
          (acc, m) => acc + (m.sections?.filter((s) => s.completed).length || 0), 0
        );
        const completionPct = totalSections > 0
          ? Math.round((completedSections / totalSections) * 100)
          : 0;

        // Find next uncompleted sections
        const nextSections = [];
        for (const mod of modules) {
          for (const section of (mod.sections || [])) {
            if (!section.completed && nextSections.length < 3) {
              nextSections.push({
                module: mod.module_number || mod.number,
                title: mod.title,
                section: section.id || section.title,
                sectionTitle: section.title
              });
            }
          }
        }

        let text = `## Your Masterclass Progress\n\n`;
        text += `**Maturity Level:** ${maturityLevel} — ${maturityLabel}\n`;
        text += `**Completion:** ${completedSections}/${totalSections} sections (${completionPct}%)\n\n`;

        if (nextSections.length > 0) {
          text += `### Up Next\n`;
          for (const ns of nextSections) {
            text += `- **Module ${ns.module}** (${ns.title}): ${ns.sectionTitle}\n`;
          }
        } else if (completionPct === 100) {
          text += `You've completed all sections! Check with your instructor about next steps.\n`;
        }

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error checking progress: ${err.message}` }] };
      }
    }
  );

  // ─── hmn_whats_next ───────────────────────────────────────────────────
  server.tool(
    'hmn_whats_next',
    'Get a personalized recommendation for what to work on next',
    {},
    async () => {
      try {
        const [profile, activitySummary] = await Promise.all([
          http.get('/api/masterclass/me'),
          http.get('/api/masterclass/activity/summary').catch(() => null)
        ]);

        const modules = profile.modules || [];
        const maturityLevel = profile.maturity_level || profile.maturityLevel || 0;

        // Find incomplete sections
        const incompleteSections = [];
        for (const mod of modules) {
          for (const section of (mod.sections || [])) {
            if (!section.completed) {
              incompleteSections.push({
                module: mod.module_number || mod.number,
                moduleTitle: mod.title,
                sectionId: section.id || section.title,
                sectionTitle: section.title
              });
            }
          }
        }

        // Analyze activity patterns
        const toolsUsed = activitySummary?.tools_used || [];
        const toolsNeverUsed = activitySummary?.tools_never_used || [];
        const totalBuilds = activitySummary?.total_builds || 0;
        const homeworkStatus = activitySummary?.homework_submitted || [];
        const pendingHomework = homeworkStatus.filter((h) => !h.submitted);

        let text = `## What to Work on Next\n\n`;

        // Priority 1: Pending homework
        if (pendingHomework.length > 0) {
          const hw = pendingHomework[0];
          text += `### Priority: Submit Homework\n`;
          text += `You have outstanding homework for **Module ${hw.module}**. `;
          text += `Use \`hmn_submit_homework\` when you're ready to submit.\n\n`;
        }

        // Priority 2: Next incomplete section
        if (incompleteSections.length > 0) {
          const next = incompleteSections[0];
          text += `### Next Section\n`;
          text += `**Module ${next.module}** (${next.moduleTitle}): ${next.sectionTitle}\n`;
          text += `Use \`hmn_get_prompt\` to get personalized prompts for this section.\n\n`;
        }

        // Priority 3: Try unused tools
        if (toolsNeverUsed.length > 0) {
          text += `### Try Something New\n`;
          text += `You haven't used these tools yet: **${toolsNeverUsed.slice(0, 3).join(', ')}**. `;
          text += `Experimenting with new tools is key to advancing your maturity level.\n\n`;
        }

        // Priority 4: Build more
        if (totalBuilds < 3) {
          text += `### Build Challenge\n`;
          text += `You've logged ${totalBuilds} build${totalBuilds !== 1 ? 's' : ''} so far. `;
          text += `Try building something with AI and log it with \`hmn_log_build\`.\n\n`;
        }

        // Maturity hint
        if (activitySummary?.maturity_evidence?.suggested_level &&
            activitySummary.maturity_evidence.suggested_level > maturityLevel) {
          text += `### Level Up Potential\n`;
          text += `Your activity suggests you might be ready for **Level ${activitySummary.maturity_evidence.suggested_level}**. `;
          text += `Keep building — your instructor will review your progress.\n`;
        }

        if (incompleteSections.length === 0 && pendingHomework.length === 0) {
          text += `You've completed all assigned work! Talk to your instructor about advanced challenges.\n`;
        }

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error generating recommendation: ${err.message}` }] };
      }
    }
  );
}

/**
 * Map maturity level number to label.
 */
function getLevelLabel(level) {
  const labels = {
    0: 'Not Assessed',
    1: 'AI Curious',
    2: 'AI Experimenting',
    3: 'AI Connecting',
    4: 'AI Collaborating',
    5: 'AI Leading'
  };
  return labels[level] || `Level ${level}`;
}

module.exports = { registerProgressTools };
