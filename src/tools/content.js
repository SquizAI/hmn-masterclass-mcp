/**
 * Content tools — hmn_get_prompt and hmn_my_profile.
 */

const { z } = require('zod');

function registerContentTools(server, http, logger) {

  // ─── hmn_get_prompt ───────────────────────────────────────────────────
  server.tool(
    'hmn_get_prompt',
    'Get personalized prompts for a specific module and section',
    {
      module_number: z.number().describe('Module number (e.g. 1, 2, 3)'),
      section_id: z.string().describe('Section identifier (e.g. "competitive-intel", "client-brief")')
    },
    async ({ module_number, section_id }) => {
      try {
        const profile = await http.get('/api/masterclass/me');
        const modules = profile.modules || [];

        // Find the matching module
        const mod = modules.find(
          (m) => (m.module_number || m.number) === module_number
        );

        if (!mod) {
          return {
            content: [{
              type: 'text',
              text: `Module ${module_number} not found. Available modules: ${modules.map((m) => m.module_number || m.number).join(', ')}`
            }]
          };
        }

        // Find the matching section
        const section = (mod.sections || []).find(
          (s) => s.id === section_id || s.title?.toLowerCase().includes(section_id.toLowerCase())
        );

        if (!section) {
          const sectionIds = (mod.sections || []).map((s) => s.id || s.title);
          return {
            content: [{
              type: 'text',
              text: `Section "${section_id}" not found in Module ${module_number}. Available sections: ${sectionIds.join(', ')}`
            }]
          };
        }

        // Get personalized content for this section
        const personalizedContent = profile.personalizedContent || profile.personalized_content || {};
        const moduleKey = `module_${module_number}`;
        const sectionContent = personalizedContent[moduleKey]?.[section_id] ||
                               personalizedContent[section_id] ||
                               null;

        let text = `## Module ${module_number}: ${mod.title}\n`;
        text += `### ${section.title || section_id}\n\n`;

        if (section.description) {
          text += `${section.description}\n\n`;
        }

        // Format personalized examples
        if (sectionContent) {
          if (sectionContent.examples && sectionContent.examples.length > 0) {
            text += `### Personalized Examples\n\n`;
            for (const example of sectionContent.examples) {
              text += `**${example.title || 'Example'}**\n`;
              if (example.context) text += `_Context:_ ${example.context}\n`;
              if (example.prompt) {
                text += `\n\`\`\`\n${example.prompt}\n\`\`\`\n\n`;
              }
              if (example.expected_outcome) {
                text += `_Expected outcome:_ ${example.expected_outcome}\n\n`;
              }
            }
          }

          if (sectionContent.homework) {
            text += `### Homework\n\n`;
            text += `${sectionContent.homework.description || sectionContent.homework}\n\n`;

            if (sectionContent.homework.checklist) {
              text += `**Checklist:**\n`;
              for (const item of sectionContent.homework.checklist) {
                text += `- [ ] ${item}\n`;
              }
              text += `\n`;
            }
          }

          if (sectionContent.callouts && sectionContent.callouts.length > 0) {
            text += `### Key Notes\n\n`;
            for (const callout of sectionContent.callouts) {
              text += `> ${callout}\n\n`;
            }
          }
        } else {
          text += `_No personalized content available for this section yet. `;
          text += `Complete the section activities and your content will be generated based on your profile._\n`;
        }

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error fetching prompt: ${err.message}` }] };
      }
    }
  );

  // ─── hmn_my_profile ───────────────────────────────────────────────────
  server.tool(
    'hmn_my_profile',
    'View your full AI profile — maturity level, pain points, use cases, learning goals',
    {},
    async () => {
      try {
        const profile = await http.get('/api/masterclass/me');

        const profileData = profile.profile_data || profile.profileData || profile;
        const maturityLevel = profile.maturity_level || profile.maturityLevel || 0;

        let text = `## Your AI Profile\n\n`;

        // Basic info
        text += `**Name:** ${profile.name || profile.full_name || 'N/A'}\n`;
        text += `**Email:** ${profile.email || 'N/A'}\n`;
        text += `**Organization:** ${profile.organization || profile.company || 'N/A'}\n`;
        text += `**Role:** ${profile.role || profile.job_title || 'N/A'}\n\n`;

        // Maturity level
        text += `### AI Maturity Level\n`;
        text += `**Level ${maturityLevel}** — ${getLevelLabel(maturityLevel)}\n\n`;

        // Background
        if (profileData.background || profileData.experience) {
          text += `### Background\n`;
          text += `${profileData.background || profileData.experience}\n\n`;
        }

        // Pain points
        if (profileData.pain_points || profileData.painPoints) {
          const pains = profileData.pain_points || profileData.painPoints;
          text += `### Pain Points\n`;
          if (Array.isArray(pains)) {
            for (const pain of pains) {
              text += `- ${pain}\n`;
            }
          } else {
            text += `${pains}\n`;
          }
          text += `\n`;
        }

        // Use cases
        if (profileData.use_cases || profileData.useCases) {
          const cases = profileData.use_cases || profileData.useCases;
          text += `### Use Cases\n`;
          if (Array.isArray(cases)) {
            for (const uc of cases) {
              text += `- ${uc}\n`;
            }
          } else {
            text += `${cases}\n`;
          }
          text += `\n`;
        }

        // Wants to learn
        if (profileData.wants_to_learn || profileData.wantsToLearn || profileData.learning_goals) {
          const goals = profileData.wants_to_learn || profileData.wantsToLearn || profileData.learning_goals;
          text += `### Wants to Learn\n`;
          if (Array.isArray(goals)) {
            for (const goal of goals) {
              text += `- ${goal}\n`;
            }
          } else {
            text += `${goals}\n`;
          }
          text += `\n`;
        }

        // Tools already using
        if (profileData.tools_using || profileData.toolsUsing || profileData.current_tools) {
          const tools = profileData.tools_using || profileData.toolsUsing || profileData.current_tools;
          text += `### Tools Currently Using\n`;
          if (Array.isArray(tools)) {
            for (const tool of tools) {
              text += `- ${tool}\n`;
            }
          } else {
            text += `${tools}\n`;
          }
          text += `\n`;
        }

        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error fetching profile: ${err.message}` }] };
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

module.exports = { registerContentTools };
