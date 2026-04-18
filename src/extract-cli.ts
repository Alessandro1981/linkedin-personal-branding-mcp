import path from 'node:path';
import { config } from './config.js';
import { extractLinkedInProfile } from './extractor.js';
import { ensureDir, timestampForFile, writePrettyJson } from './utils.js';

async function main(): Promise<void> {
  const profileUrl = process.argv[2] || config.defaultProfileUrl;
  if (!profileUrl) {
    throw new Error('Missing profile URL. Pass it as first argument or set LINKEDIN_PROFILE_URL in .env');
  }

  const result = await extractLinkedInProfile(profileUrl);
  ensureDir(config.exportDir);
  const filename = `linkedin_profile_${timestampForFile()}.json`;
  const targetPath = path.join(config.exportDir, filename);
  writePrettyJson(targetPath, result);

  console.error(`Profile export saved to ${targetPath}`);
}

main().catch((error) => {
  console.error('Extraction failed:', error);
  process.exit(1);
});
