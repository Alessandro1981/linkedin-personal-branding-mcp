import { createFreshLoginContext } from './browser.js';
import { config } from './config.js';

async function main(): Promise<void> {
  const context = await createFreshLoginContext();
  const page = await context.newPage();

  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  console.error('Complete the LinkedIn login in the opened browser window.');
  console.error('After login lands on your feed or profile, press Enter in this terminal.');

  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });

  await context.storageState({ path: config.statePath });
  await context.close();
  console.error(`Saved authenticated browser session to ${config.statePath}`);
}

main().catch((error) => {
  console.error('Login bootstrap failed:', error);
  process.exit(1);
});
