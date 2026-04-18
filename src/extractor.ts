import type { Page, Locator } from "playwright";
import { createLinkedInContext } from "./browser.js";

import {
  LinkedInProfileExport,
  ExperienceItem,
  EducationItem
} from "./types";

function sanitizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function textOrEmpty(locator: Locator): Promise<string> {
  try {
    const txt = await locator.textContent();
    return txt ? sanitizeText(txt) : "";
  } catch {
    return "";
  }
}

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => sanitizeText(l))
    .filter(Boolean);
}

function splitHighlights(text: string): string[] {
  return splitLines(text).filter((l) => l.length > 0 && l.length < 200);
}

function dedupeExperience(items: ExperienceItem[]): ExperienceItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.company}-${i.role}-${i.start_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();

  const noiseFragments = [
    "video player",
    "play video",
    "skip backward",
    "skip forward",
    "mute",
    "current time",
    "duration",
    "loaded:",
    "stream type",
    "seek to live",
    "remaining time",
    "playback rate",
    "chapters",
    "descriptions",
    "descriptions off",
    "subtitles",
    "subtitles settings",
    "audio track",
    "picture-in-picture",
    "fullscreen",
    "modal window",
    "dialog window",
    "escape will cancel",
    "textcolor",
    "text backgroundcolor",
    "caption area backgroundcolor",
    "font size",
    "text edge style",
    "font family",
    "reset",
    "done",
    "close modal dialog",
    "invia messaggio",
    "collegati",
    "mostra tutto",
    "visibile solo a te",
    "persone che potresti conoscere",
    "pagine per te",
    "privacy e condizioni",
    "opzioni per gli annunci pubblicitari",
    "centro sicurezza",
    "linkedin corporation",
    "domande?",
    "visita il nostro centro assistenza",
    "gestisci il tuo account e la tua privacy",
    "vai alle impostazioni",
    "trasparenza sui contenuti consigliati",
    "seleziona lingua",
    "consiglia",
    "commenta",
    "diffondi il post",
    "visualizza offerta di lavoro",
    "ha diffuso questo post"
  ];

  return noiseFragments.some((fragment) => lower.includes(fragment));
}

function cleanLines(lines: string[]): string[] {
  return lines.filter((line) => {
    if (!line) return false;
    if (line.length > 500) return false;
    if (isNoiseLine(line)) return false;
    return true;
  });
}

async function getProfileRoot(page: Page): Promise<Locator> {
  return page.locator("main").first();
}

async function autoScrollProfile(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 2200 });

  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 600);
    });
  });

  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
}

async function findSectionByTitle(page: Page, titles: string[]): Promise<Locator | null> {
  const root = await getProfileRoot(page);
  const sections = root.locator("section");
  const count = await sections.count();

  for (let i = 0; i < count; i++) {
    const section = sections.nth(i);

    const headingTexts = await section
      .locator("h2, h3, span[aria-hidden='true'], div[aria-hidden='true']")
      .evaluateAll((els) =>
        els.map((el) => (el.textContent || "").trim()).filter(Boolean)
      );

    const normalized = headingTexts.map((t) => t.toLowerCase());

    if (
      titles.some((title) =>
        normalized.some(
          (h) => h === title.toLowerCase() || h.includes(title.toLowerCase())
        )
      )
    ) {
      return section;
    }
  }

  return null;
}

async function maybeOpenSection(page: Page, sectionTitle: string): Promise<Page> {
  const linkTexts = [
    `Show all ${sectionTitle}`,
    `Mostra tutti i ${sectionTitle}`,
    `Mostra tutte le ${sectionTitle}`
  ];

  for (const text of linkTexts) {
    const links = page.locator(`a:has-text("${text}")`);
    if ((await links.count()) > 0) {
      const popupPromise = page.waitForEvent("popup").catch(() => null);
      await links.first().click().catch(() => null);
      const popup = await popupPromise;

      if (popup) {
        await popup.waitForLoadState("domcontentloaded").catch(() => null);
        return popup;
      }

      const pages = page.context().pages();
      return pages[pages.length - 1] ?? page;
    }
  }

  return page;
}

// ---------------- CORE ----------------

async function extractCore(page: Page) {
  const root = await getProfileRoot(page);
  const topSection = root.locator("section").first();

  const fullName = await textOrEmpty(topSection.locator("h1").first());

  const raw = await textOrEmpty(topSection);
  const lines = cleanLines(splitLines(raw));

  const headline =
    lines.find(
      (line) =>
        /vp|vice president|engineering|software|technology/i.test(line) &&
        !line.includes("Video Player") &&
        line !== fullName
    ) ?? "";

  const location =
    lines.find((line) =>
      /firenze|toscana|italia|italy|europe|europa/i.test(line)
    ) ?? "";

  return {
    profile_metadata: {
      full_name: fullName,
      linkedin_url: page.url(),
      extracted_at: new Date().toISOString(),
      source: "linkedin_playwright_mcp"
    },
    profile_core: {
      headline: sanitizeText(headline),
      location: sanitizeText(location.replace(/·.*$/, "")),
      industry: "",
      about: ""
    }
  };
}

// ---------------- ABOUT ----------------

async function extractAbout(page: Page): Promise<string> {
  const root = await getProfileRoot(page);
  const sections = root.locator("section");
  const count = await sections.count();

  for (let i = 0; i < count; i++) {
    const section = sections.nth(i);
    const raw = await textOrEmpty(section);

    if (!raw.includes("Informazioni") && !raw.includes("About")) {
      continue;
    }

    const lines = splitLines(raw);
    const cleaned = cleanLines(lines).filter(
      (line) =>
        line !== "Informazioni" &&
        line !== "About" &&
        !line.includes("Mostra altro") &&
        !line.includes("Mostra meno")
    );

    return cleaned.join("\n").trim();
  }

  return "";
}

// ---------------- EXPERIENCE ----------------

async function extractExperience(page: Page): Promise<ExperienceItem[]> {
  const pageWithExp = await maybeOpenSection(page, "experiences");

  try {
    const section = await findSectionByTitle(pageWithExp, ["Esperienza", "Experience"]);
    if (!section) return [];

    const items = section.locator("li");
    const count = Math.min(await items.count(), 12);

    const results: ExperienceItem[] = [];

    for (let i = 0; i < count; i++) {
      const text = await textOrEmpty(items.nth(i));
      if (!text || text.length < 20) continue;

      const lines = cleanLines(splitLines(text));
      if (lines.length < 2) continue;

      const joined = lines.join(" ").toLowerCase();
      if (
        joined.includes("ha diffuso questo post") ||
        joined.includes("consiglia") ||
        joined.includes("commenta") ||
        joined.includes("diffondi il post") ||
        joined.includes("visualizza offerta di lavoro")
      ) {
        continue;
      }

      const role = lines[0] ?? "";
      const company = lines[1] ?? "";

      const date = lines.find((l) => /\d{4}|Present|Presente/.test(l)) ?? "";
      const location = lines.find((l) =>
        /Italia|Italy|Remote|Hybrid|On-site|Europe|Europa|Toscana|Firenze/i.test(l)
      ) ?? "";

      const description = lines
        .filter((l) => l !== role && l !== company && l !== date && l !== location)
        .join("\n");

      results.push({
        company,
        role,
        employment_type: "",
        start_date: date,
        end_date: "",
        location,
        description,
        highlights: splitHighlights(description)
      });
    }

    return dedupeExperience(results);
  } finally {
    if (pageWithExp !== page) {
      await pageWithExp.close().catch(() => null);
    }
  }
}

// ---------------- EDUCATION ----------------

async function extractEducation(page: Page): Promise<EducationItem[]> {
  const pageWithEdu = await maybeOpenSection(page, "education");

  try {
    const section = await findSectionByTitle(pageWithEdu, ["Formazione", "Education"]);
    if (!section) return [];

    const items = section.locator("li");
    const count = Math.min(await items.count(), 8);

    const results: EducationItem[] = [];

    for (let i = 0; i < count; i++) {
      const text = await textOrEmpty(items.nth(i));
      if (!text) continue;

      const lines = cleanLines(splitLines(text));
      if (lines.length < 1) continue;

      const joined = lines.join(" ").toLowerCase();
      if (
        joined.includes("ha diffuso questo post") ||
        joined.includes("consiglia") ||
        joined.includes("commenta") ||
        joined.includes("diffondi il post") ||
        joined.includes("visualizza offerta di lavoro")
      ) {
        continue;
      }

      results.push({
        school: lines[0] ?? "",
        degree: lines[1] ?? "",
        field_of_study: lines[2] ?? "",
        start_date: lines.find((l) => /\d{4}/.test(l)) ?? "",
        end_date: "",
        description: lines.slice(3).join("\n")
      });
    }

    return results;
  } finally {
    if (pageWithEdu !== page) {
      await pageWithEdu.close().catch(() => null);
    }
  }
}

// ---------------- SKILLS ----------------

async function extractSkills(page: Page): Promise<string[]> {
  const pageWithSkills = await maybeOpenSection(page, "skills");

  try {
    const section = await findSectionByTitle(pageWithSkills, ["Competenze", "Skills"]);
    if (!section) return [];

    const items = section.locator("li");
    const count = Math.min(await items.count(), 40);

    const skills = new Set<string>();

    for (let i = 0; i < count; i++) {
      const text = await textOrEmpty(items.nth(i));
      if (!text) continue;

      const lines = cleanLines(splitLines(text));
      const first = lines[0] ?? "";

      if (
        first &&
        first.length > 1 &&
        first.length < 80 &&
        !/commenti|diffusioni|reazioni|post|follower/i.test(first)
      ) {
        skills.add(first);
      }
    }

    return Array.from(skills).slice(0, 30);
  } finally {
    if (pageWithSkills !== page) {
      await pageWithSkills.close().catch(() => null);
    }
  }
}

// ---------------- MAIN EXPORT ----------------

export async function extractLinkedInProfile(profileUrl: string): Promise<LinkedInProfileExport> {
  const context = await createLinkedInContext();

  try {
    const page = await context.newPage();
    await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await autoScrollProfile(page);

    const root = await getProfileRoot(page);
    const sections = root.locator("section");
    const sectionCount = await sections.count();

    console.log("\n=== PROFILE SECTIONS DEBUG ===");
    for (let i = 0; i < sectionCount; i++) {
      const txt = await sections.nth(i).textContent();
      console.log(`\n[SECTION ${i}]`);
      console.log((txt || "").slice(0, 250));
    }
    console.log("\n=== END DEBUG ===\n");

    const core = await extractCore(page);
    const about = await extractAbout(page);
    const experience = await extractExperience(page);
    const education = await extractEducation(page);
    const skills = await extractSkills(page);

    return {
      ...core,
      profile_core: {
        ...core.profile_core,
        about
      },
      branding_context: {
        target_positioning: "",
        core_topics: [],
        tone_of_voice: "",
        audience: [],
        do_not_emphasize: []
      },
      experience,
      education,
      skills,
      certifications: [],
      featured: [],
      recent_posts: []
    };
  } finally {
    await context.close().catch(() => null);
  }
}