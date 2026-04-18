import type { BrowserContext, Locator, Page } from 'playwright';
import { createLinkedInContext } from './browser.js';
import type { LinkedInProfileExport, ExperienceItem, EducationItem, RecentPostItem, FeaturedItem } from './types.js';
import { sanitizeText, sanitizeMultilineText, splitHighlights } from './utils.js';

const DEFAULT_BRANDING_CONTEXT = {
  target_positioning: 'VP Software Engineering with evolution toward broader R&D executive leadership',
  core_topics: [
    'software engineering leadership',
    'organizational effectiveness',
    'AI adoption in software teams',
    'fuel retail technology',
    'leadership and people development',
    'innovation and transformation'
  ],
  tone_of_voice: 'professional but informal',
  audience: [
    'engineering leaders',
    'technology managers',
    'fuel retail professionals',
    'future leaders'
  ],
  do_not_emphasize: [
    'internal sensitive organizational details',
    'unclear strategic messages',
    'overly promotional language'
  ]
} as const;

async function textOrEmpty(locator: Locator): Promise<string> {
  try {
    const count = await locator.count();
    if (count === 0) return '';
    return sanitizeMultilineText(await locator.first().innerText({ timeout: 3000 }));
  } catch {
    return '';
  }
}

async function hrefOrEmpty(locator: Locator): Promise<string> {
  try {
    const count = await locator.count();
    if (count === 0) return '';
    return sanitizeText(await locator.first().getAttribute('href'));
  } catch {
    return '';
  }
}

async function loadPage(context: BrowserContext, profileUrl: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  return page;
}

async function extractCore(page: Page): Promise<Pick<LinkedInProfileExport, 'profile_metadata' | 'profile_core'>> {
  const fullName = await textOrEmpty(page.locator('h1'));
  const headline = await textOrEmpty(page.locator('.text-body-medium').first());

  const topSectionText = await textOrEmpty(page.locator('main section').first());
  const topLines = topSectionText.split('\n').filter(Boolean);
  const location = topLines.find((line) => line.includes(',') || /area|province|metropolitan/i.test(line)) ?? '';

  return {
    profile_metadata: {
      full_name: fullName,
      linkedin_url: page.url(),
      extracted_at: new Date().toISOString(),
      source: 'linkedin_playwright_mcp'
    },
    profile_core: {
      headline,
      location,
      industry: '',
      about: ''
    }
  };
}

async function maybeOpenSection(page: Page, sectionTitle: string): Promise<Page> {
  const links = page.locator(`a:has-text("Show all ${sectionTitle}")`);
  if ((await links.count()) > 0) {
    await Promise.all([
      page.waitForEvent('popup').catch(() => null),
      links.first().click().catch(() => null)
    ]);
  }

  const pages = page.context().pages();
  return pages[pages.length - 1] ?? page;
}

async function extractAbout(page: Page): Promise<string> {
  const aboutSection = page.locator('section').filter({ has: page.locator('#about, div[id*=about]') }).first();
  let about = await textOrEmpty(aboutSection.locator('.display-flex.ph5.pv3, .full-width[dir="ltr"], .inline-show-more-text').first());

  if (!about) {
    const pageWithAbout = await maybeOpenSection(page, 'about');
    about = await textOrEmpty(pageWithAbout.locator('main'));
    if (pageWithAbout !== page) await pageWithAbout.close().catch(() => null);
  }

  return about;
}

async function extractExperience(page: Page): Promise<ExperienceItem[]> {
  const results: ExperienceItem[] = [];
  const pageWithExperience = await maybeOpenSection(page, 'experiences');
  const items = pageWithExperience.locator('main li, section li');
  const count = Math.min(await items.count(), 12);

  for (let i = 0; i < count; i += 1) {
    const item = items.nth(i);
    const text = await textOrEmpty(item);
    if (!text || text.length < 12) continue;

    const lines = text.split('\n').map((line) => sanitizeText(line)).filter(Boolean);
    const role = lines[0] ?? '';
    const company = lines[1] ?? '';
    const datesLine = lines.find((line) => /\d{4}|Present|Presente|attuale/i.test(line)) ?? '';
    const locationLine = lines.find((line) => /Remote|On-site|Hybrid|Italy|Italia|Europe|Europa/i.test(line)) ?? '';
    const description = lines.slice(3).join('\n');

    results.push({
      company,
      role,
      employment_type: '',
      start_date: datesLine,
      end_date: '',
      location: locationLine,
      description,
      highlights: splitHighlights(description)
    });
  }

  if (pageWithExperience !== page) await pageWithExperience.close().catch(() => null);
  return dedupeExperience(results);
}

function dedupeExperience(items: ExperienceItem[]): ExperienceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.role}|${item.company}|${item.start_date}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function extractEducation(page: Page): Promise<EducationItem[]> {
  const results: EducationItem[] = [];
  const pageWithEducation = await maybeOpenSection(page, 'education');
  const items = pageWithEducation.locator('main li, section li');
  const count = Math.min(await items.count(), 8);

  for (let i = 0; i < count; i += 1) {
    const text = await textOrEmpty(items.nth(i));
    if (!text || text.length < 12) continue;
    const lines = text.split('\n').map((line) => sanitizeText(line)).filter(Boolean);
    results.push({
      school: lines[0] ?? '',
      degree: lines[1] ?? '',
      field_of_study: lines[2] ?? '',
      start_date: lines.find((line) => /\d{4}/.test(line)) ?? '',
      end_date: '',
      description: lines.slice(3).join('\n')
    });
  }

  if (pageWithEducation !== page) await pageWithEducation.close().catch(() => null);
  return results;
}

async function extractFeatured(page: Page): Promise<FeaturedItem[]> {
  const featured: FeaturedItem[] = [];
  const section = page.locator('section').filter({ hasText: 'Featured' }).first();
  const cards = section.locator('a[href]');
  const count = Math.min(await cards.count(), 6);

  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    const title = await textOrEmpty(card);
    const url = await hrefOrEmpty(card);
    if (!title && !url) continue;

    featured.push({
      type: url.includes('/posts/') ? 'post' : url.includes('/pulse/') ? 'article' : 'link',
      title: title.split('\n')[0] ?? '',
      url,
      date: '',
      summary: title
    });
  }

  return featured;
}

async function extractSkills(page: Page): Promise<string[]> {
  const skillsPage = await maybeOpenSection(page, 'skills');
  const candidates = skillsPage.locator('main span[aria-hidden="true"], section span[aria-hidden="true"]');
  const count = Math.min(await candidates.count(), 80);
  const skills = new Set<string>();

  for (let i = 0; i < count; i += 1) {
    const value = sanitizeText(await candidates.nth(i).innerText().catch(() => ''));
    if (value && value.length > 2 && value.length < 60) {
      skills.add(value);
    }
  }

  if (skillsPage !== page) await skillsPage.close().catch(() => null);
  return Array.from(skills).slice(0, 30);
}

async function extractRecentPosts(page: Page): Promise<RecentPostItem[]> {
  const results: RecentPostItem[] = [];
  const activityLink = page.locator('a[href*="/details/recent-activity/"]').first();
  if ((await activityLink.count()) === 0) return results;

  await Promise.all([
    page.waitForEvent('popup').catch(() => null),
    activityLink.click().catch(() => null)
  ]);

  const pages = page.context().pages();
  const activityPage = pages[pages.length - 1];
  if (!activityPage || activityPage === page) return results;

  await activityPage.waitForLoadState('domcontentloaded');
  await activityPage.waitForTimeout(1200);

  const items = activityPage.locator('main .feed-shared-update-v2, main li');
  const count = Math.min(await items.count(), 5);
  for (let i = 0; i < count; i += 1) {
    const item = items.nth(i);
    const text = await textOrEmpty(item);
    if (!text) continue;
    const link = await hrefOrEmpty(item.locator('a[href*="/posts/"]'));
    results.push({
      date: '',
      url: link,
      text,
      engagement_hint: ''
    });
  }

  await activityPage.close().catch(() => null);
  return results;
}

export async function extractLinkedInProfile(profileUrl: string): Promise<LinkedInProfileExport> {
  const context = await createLinkedInContext();
  try {
    const page = await loadPage(context, profileUrl);
    const core = await extractCore(page);
    const about = await extractAbout(page);
    const experience = await extractExperience(page);
    const education = await extractEducation(page);
    const featured = await extractFeatured(page);
    const skills = await extractSkills(page);
    const recent_posts = await extractRecentPosts(page);

    await page.close();

    return {
      ...core,
      branding_context: { ...DEFAULT_BRANDING_CONTEXT },
      profile_core: {
        ...core.profile_core,
        about
      },
      experience,
      education,
      skills,
      certifications: [],
      featured,
      recent_posts
    };
  } finally {
    await context.close();
  }
}
