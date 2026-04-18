import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { config } from './config.js';
import { extractLinkedInProfile } from './extractor.js';
import { timestampForFile, writePrettyJson } from './utils.js';

const server = new McpServer({
  name: 'linkedin-personal-branding-mcp',
  version: '0.1.0'
});

server.tool(
  'extract_profile',
  'Read a LinkedIn public profile with Playwright and return structured JSON suitable for personal branding analysis.',
  {
    profile_url: z.string().url().optional().describe('LinkedIn profile URL to read. Defaults to LINKEDIN_PROFILE_URL from the environment.'),
    save_to_exports: z.boolean().default(true).describe('Whether to save a timestamped JSON file under exports/.'),
    include_recent_posts: z.boolean().default(true).describe('Currently reserved for future extractor variations. The extractor tries to fetch recent posts when visible.')
  },
  async ({ profile_url, save_to_exports }) => {
    const profileUrl = profile_url || config.defaultProfileUrl;
    if (!profileUrl) {
      throw new Error('No LinkedIn profile URL provided. Set LINKEDIN_PROFILE_URL or pass profile_url.');
    }

    const result = await extractLinkedInProfile(profileUrl);

    if (save_to_exports) {
      const filename = `exports/linkedin_profile_${timestampForFile()}.json`;
      writePrettyJson(filename, result);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
