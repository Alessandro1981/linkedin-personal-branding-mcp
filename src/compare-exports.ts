import fs from 'node:fs';
import path from 'node:path';
import type { LinkedInProfileExport } from './types.js';

function readJson(filePath: string): LinkedInProfileExport {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as LinkedInProfileExport;
}

function main(): void {
  const before = process.argv[2];
  const after = process.argv[3];

  if (!before || !after) {
    throw new Error('Usage: npm run compare -- exports/old.json exports/new.json');
  }

  const oldProfile = readJson(path.resolve(before));
  const newProfile = readJson(path.resolve(after));

  const summary = {
    headline_changed: oldProfile.profile_core.headline !== newProfile.profile_core.headline,
    about_changed: oldProfile.profile_core.about !== newProfile.profile_core.about,
    experience_count_before: oldProfile.experience.length,
    experience_count_after: newProfile.experience.length,
    featured_count_before: oldProfile.featured.length,
    featured_count_after: newProfile.featured.length,
    skills_count_before: oldProfile.skills.length,
    skills_count_after: newProfile.skills.length
  };

  console.log(JSON.stringify(summary, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
