import 'dotenv/config';

export const config = {
  defaultProfileUrl: process.env.LINKEDIN_PROFILE_URL ?? '',
  headless: process.env.HEADLESS === 'true',
  userAgent: process.env.LINKEDIN_USER_AGENT || undefined,
  statePath: 'state.json',
  exportDir: 'exports'
};
