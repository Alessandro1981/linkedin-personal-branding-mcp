import { chromium, type BrowserContext } from 'playwright';
import { config } from './config.js';

export async function createLinkedInContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({ headless: config.headless });

  const context = await browser.newContext({
    storageState: config.statePath,
    userAgent: config.userAgent
  });

  context.on('close', async () => {
    await browser.close();
  });

  return context;
}

export async function createFreshLoginContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({ headless: false });

  const context = await browser.newContext({
    userAgent: config.userAgent
  });

  context.on('close', async () => {
    await browser.close();
  });

  return context;
}
