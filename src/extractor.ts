import type { Page, Locator } from "playwright";
import { createLinkedInContext } from "./browser.js";

import {
  LinkedInProfileExport,
  ExperienceItem,
  EducationItem,
  CertificationItem,
  LanguageItem
} from "./types";

function sanitizeInlineText(text: string): string {
  return text.replace(/[ \t]+/g, " ").trim();
}

function normalizeMultilineText(text: string): string {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => sanitizeInlineText(line))
    .filter(Boolean)
    .join("\n");
}

async function rawTextOrEmpty(locator: Locator): Promise<string> {
  try {
    const txt = await locator.innerText();
    return txt ?? "";
  } catch {
    try {
      const fallback = await locator.textContent();
      return fallback ?? "";
    } catch {
      return "";
    }
  }
}

async function textOrEmpty(locator: Locator): Promise<string> {
  try {
    const txt = await locator.innerText();
    return txt ? sanitizeInlineText(txt) : "";
  } catch {
    try {
      const fallback = await locator.textContent();
      return fallback ? sanitizeInlineText(fallback) : "";
    } catch {
      return "";
    }
  }
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((l) => sanitizeInlineText(l))
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

function cleanExperienceField(text: string): string {
  return text
    .replace(/🌐|✔|🛠️|🔍|🗓️/g, "")
    .replace(/Responsabilità.*$/i, "")
    .replace(/\+\d+ competenze?.*$/i, "")
    .replace(/\d+ anni.*$/i, "")
    .trim();
}

function isDateLine(line: string): boolean {
  return (
    /\d{4}/.test(line) &&
    /\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line)
  );
}

function isCompanyLine(line: string): boolean {
  const cleaned = line.trim().toLowerCase();

  if (!cleaned) return false;

  return (
    cleaned.startsWith("invenco") ||
    cleaned.startsWith("gilbarco") ||
    cleaned.startsWith("rcproject") ||
    cleaned.startsWith("vontier") ||
    cleaned.includes(" · a contratto") ||
    cleaned.includes(" · contract")
  );
}

function isLocationLine(line: string): boolean {
  const cleaned = line.trim().toLowerCase();

  return (
    cleaned.startsWith("firenze") ||
    cleaned.startsWith("italia") ||
    cleaned.startsWith("toscana") ||
    cleaned.includes("ibrido") ||
    cleaned.includes("ibrida") ||
    cleaned.includes("hybrid") ||
    cleaned.includes("remote") ||
    cleaned.includes("da remoto") ||
    cleaned.includes("on-site") ||
    cleaned.includes("in sede")
  );
}

function isCompanyDurationLine(line: string): boolean {
  return /^\d+\s+anni/i.test(line.trim());
}

function isLinkedInSkillMetadataLine(line: string): boolean {
  const cleaned = line.trim();
  const lower = cleaned.toLowerCase();

  if (!cleaned) return false;

  if (/^\+?\d+\s+(competenz|skills)/i.test(cleaned)) return true;
  if (/\be\s*\+\d+\s+competenz/i.test(lower)) return true;
  if (/\band\s*\+\d+\s+skills/i.test(lower)) return true;
  if (/\+\d+\s+competenz/i.test(lower)) return true;
  if (/\+\d+\s+skills/i.test(lower)) return true;

  // LinkedIn relationship/context metadata, e.g.:
  // "4 esperienze presso Invenco e altre 2 aziende"
  // "4 experiences at Invenco and 2 other companies"
  if (/\d+\s+esperienze?\s+presso/i.test(lower)) return true;
  if (/esperienze?\s+presso/i.test(lower)) return true;
  if (/altre?\s+\d+\s+aziende/i.test(lower)) return true;
  if (/\d+\s+experiences?\s+at/i.test(lower)) return true;
  if (/other\s+\d+\s+companies/i.test(lower)) return true;
  if (/and\s+\d+\s+other\s+companies/i.test(lower)) return true;

  if (/confermat[aoe]? da/i.test(lower)) return true;
  if (/conferme? di competenza/i.test(lower)) return true;
  if (/endorsements?/i.test(lower)) return true;

  return false;
}

function isRoleCandidateLine(line: string): boolean {
  const cleaned = cleanExperienceField(line).trim();
  const lower = cleaned.toLowerCase();

  if (!cleaned || cleaned.length < 3) return false;
  if (cleaned === "… altro") return false;
  if (isNoiseLine(cleaned)) return false;
  if (isDateLine(cleaned)) return false;
  if (isCompanyLine(cleaned)) return false;
  if (isLocationLine(cleaned)) return false;
  if (isCompanyDurationLine(cleaned)) return false;
  if (isLinkedInSkillMetadataLine(cleaned)) return false;
  if (/responsabilità|fornitori|competenze|skills|clienti interni/i.test(lower)) return false;

  return true;
}

async function getProfileRoot(page: Page): Promise<Locator> {
  return page.locator("main").first();
}

async function autoScrollMain(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 2200 });

  await page.evaluate(async () => {
    const main = document.querySelector("main") as HTMLElement | null;
    if (!main) return;

    await new Promise<void>((resolve) => {
      let previousTop = -1;
      const distance = 800;

      const timer = setInterval(() => {
        main.scrollBy(0, distance);

        const currentTop = main.scrollTop;
        const maxTop = main.scrollHeight - main.clientHeight;

        if (currentTop === previousTop || currentTop >= maxTop - 5) {
          clearInterval(timer);
          resolve();
        }

        previousTop = currentTop;
      }, 700);
    });
  });

  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    const main = document.querySelector("main") as HTMLElement | null;
    if (main) main.scrollTo(0, 0);
  });

  await page.waitForTimeout(1500);
}

async function findSectionByTitle(page: Page, titles: string[]): Promise<Locator | null> {
  const root = await getProfileRoot(page);
  const sections = root.locator("section");
  const count = await sections.count();

  for (let i = 0; i < count; i++) {
    const section = sections.nth(i);
    const raw = await rawTextOrEmpty(section);
    const firstLine = splitLines(raw)[0] ?? "";

    if (
      titles.some((title) =>
        firstLine.toLowerCase() === title.toLowerCase() ||
        firstLine.toLowerCase().startsWith(title.toLowerCase())
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

  let fullName = await textOrEmpty(topSection.locator("h1").first());

  const raw = await rawTextOrEmpty(topSection);

  console.log("\n=== TOP SECTION RAW ===");
  console.log(raw.slice(0, 1200));
  console.log("=== END TOP SECTION RAW ===\n");

  const lines = cleanLines(splitLines(raw));

  if (!fullName) {
    fullName =
      lines.find((line) =>
        /^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’.-]+\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’.-]+/.test(line)
      ) ?? "";
  }

  const headline =
    lines.find(
      (line) =>
        /vp|vice president|engineering|software|technology/i.test(line) &&
        line !== fullName &&
        !isNoiseLine(line)
    ) ?? "";

  const location =
    lines.find((line) =>
      /firenze|toscana|italia|italy|europe|europa/i.test(line)
    ) ?? "";

  return {
    profile_metadata: {
      full_name: sanitizeInlineText(fullName),
      linkedin_url: page.url(),
      extracted_at: new Date().toISOString(),
      source: "linkedin_playwright_mcp"
    },
    profile_core: {
      headline: sanitizeInlineText(location === headline ? "" : headline),
      location: sanitizeInlineText(location.replace(/·.*$/, "")),
      industry: "",
      about: ""
    }
  };
}

// ---------------- ABOUT ----------------

async function extractAbout(page: Page): Promise<string> {
  const section = await findSectionByTitle(page, ["Informazioni", "About"]);
  if (!section) return "";

  const raw = await rawTextOrEmpty(section);
  const lines = cleanLines(splitLines(raw)).filter(
    (line) =>
      line !== "Informazioni" &&
      line !== "About" &&
      !line.includes("Mostra altro") &&
      !line.includes("Mostra meno")
  );

  return lines.join("\n").trim();
}

// ---------------- EXPERIENCE ----------------

async function expandSeeMoreButtons(root: Locator): Promise<void> {
  const buttons = root.locator(
    'button:has-text("Mostra altro"), button:has-text("mostra altro"), button:has-text("See more"), button:has-text("see more")'
  );

  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    try {
      if (await button.isVisible()) {
        await button.click();
        await button.page().waitForTimeout(250);
      }
    } catch {
      // LinkedIn can re-render the DOM while expanding content.
    }
  }
}

function getRoleDateOffset(lines: string[], roleIndex: number): number {
  const next = lines[roleIndex + 1] ?? "";
  const next2 = lines[roleIndex + 2] ?? "";

  // Pattern:
  // Role
  // Date
  // Location
  if (isDateLine(next)) {
    return 1;
  }

  // Pattern:
  // Role
  // Company
  // Date
  // Location
  if (isCompanyLine(next) && isDateLine(next2)) {
    return 2;
  }

  return -1;
}

function isExperienceDescriptionNoise(line: string): boolean {
  const lower = line.toLowerCase();

  if (line === "Esperienza" || line === "Experience") return true;
  if (line === "… altro") return true;
  if (lower.includes("mostra altro") || lower.includes("mostra meno")) return true;
  if (lower.includes("show more") || lower.includes("show less")) return true;
  if (lower.includes("competenze:")) return true;
  if (lower.includes("skills:")) return true;
  if (/^\+?\d+ competenze?/i.test(line)) return true;
  if (/^\+?\d+ skills?/i.test(line)) return true;
  if (isLinkedInSkillMetadataLine(line)) return true;
  if (isCompanyDurationLine(line)) return true;
  if (isCompanyLine(line)) return true;
  if (isDateLine(line)) return true;
  if (isLocationLine(line)) return true;
  if (/responsabilità|fornitori|clienti interni/i.test(line) && /competenz/i.test(line)) return true;
  if (/conferme? di competenza/i.test(line)) return true;
  if (/endorsements?/i.test(line)) return true;

  return isNoiseLine(line);
}

function extractExperienceDetailsFromLines(
  lines: string[],
  startIndex: number,
  nextRoleIndex: number
): { description: string; highlights: string[] } {
  const roleDateOffset = getRoleDateOffset(lines, startIndex);
  const safeOffset = roleDateOffset > 0 ? roleDateOffset : 1;
  const detailStart = startIndex + safeOffset + 2;
  const detailEnd = nextRoleIndex > -1 ? nextRoleIndex : lines.length;

  const detailLines = cleanLines(lines.slice(detailStart, detailEnd))
    .filter((line) => !isExperienceDescriptionNoise(line))
    .filter((line) => !line.match(/^A tempo pieno|^Full-time/i));

  const description = normalizeMultilineText(detailLines.join("\n"));
  const highlights = splitHighlights(description);

  return { description, highlights };
}

async function extractExperience(page: Page): Promise<ExperienceItem[]> {
  const section = await findSectionByTitle(page, ["Esperienza", "Experience"]);
  if (!section) return [];

  await expandSeeMoreButtons(section);

  const raw = await rawTextOrEmpty(section);

  const lines = cleanLines(splitLines(raw)).filter(
    (line) =>
      line !== "Esperienza" &&
      line !== "Experience" &&
      !line.includes("A tempo pieno") &&
      !line.includes("Full-time") &&
      !line.includes("Ibrida") &&
      !line.includes("Hybrid")
  );

  console.log("\n=== EXPERIENCE CLEAN ===");
  lines.forEach((l) => console.log(l));
  console.log("=== END EXPERIENCE CLEAN ===\n");

  const results: ExperienceItem[] = [];

  const defaultCompany = lines.find((line) => isCompanyLine(line)) ?? lines[0] ?? "";
  const roleIndexes: number[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const role = lines[i];
    const offset = getRoleDateOffset(lines, i);

    if (offset > 0 && isRoleCandidateLine(role)) {
      roleIndexes.push(i);
    }
  }

  for (let r = 0; r < roleIndexes.length; r++) {
    const i = roleIndexes[r];
    const role = lines[i];
    const roleDateOffset = getRoleDateOffset(lines, i);
    const safeOffset = roleDateOffset > 0 ? roleDateOffset : 1;

    const companyForRole =
      safeOffset === 2 ? lines[i + 1] ?? defaultCompany : defaultCompany;

    const startDate = lines[i + safeOffset] ?? "";
    const location = lines[i + safeOffset + 1] ?? "";
    const nextRoleIndex = roleIndexes[r + 1] ?? -1;
    const details = extractExperienceDetailsFromLines(lines, i, nextRoleIndex);

    results.push({
      company: cleanExperienceField(sanitizeInlineText(companyForRole)),
      role: cleanExperienceField(sanitizeInlineText(role)),
      employment_type: "",
      start_date: sanitizeInlineText(startDate),
      end_date: "",
      location: sanitizeInlineText(location),
      description: details.description,
      highlights: details.highlights
    });
  }

  return dedupeExperience(results).filter(
    (x) =>
      x.company &&
      !x.company.match(/\d+ anni/i) &&
      x.role &&
      x.role.length > 3
  );
}

// ---------------- EDUCATION ----------------

async function extractEducation(page: Page): Promise<EducationItem[]> {
  const pageWithEdu = await maybeOpenSection(page, "education");

  try {
    const section = await findSectionByTitle(pageWithEdu, ["Formazione", "Education"]);
    if (!section) return [];

    const raw = await rawTextOrEmpty(section);
    const lines = cleanLines(splitLines(raw)).filter(
      (line) => line !== "Formazione" && line !== "Education"
    );

    const results: EducationItem[] = [];
    let i = 0;

    while (i < lines.length) {
      const school = lines[i] ?? "";
      const degree = lines[i + 1] ?? "";
      const date = lines[i + 2] ?? "";

      if (school && degree && /\d{4}/.test(date)) {
        const descriptionLines: string[] = [];
        let j = i + 3;

        while (
          j < lines.length &&
          !(lines[j] && lines[j + 1] && /\d{4}/.test(lines[j + 2] ?? ""))
        ) {
          descriptionLines.push(lines[j]);
          j++;
        }

        results.push({
          school: sanitizeInlineText(school),
          degree: sanitizeInlineText(degree),
          field_of_study: "",
          start_date: sanitizeInlineText(date),
          end_date: "",
          description: normalizeMultilineText(descriptionLines.join("\n"))
        });

        i = j;
        continue;
      }

      i++;
    }

    return results;
  } finally {
    if (pageWithEdu !== page) {
      await pageWithEdu.close().catch(() => null);
    }
  }
}

// ---------------- CERTIFICATION ----------------

function cleanCertifications(items: CertificationItem[]): CertificationItem[] {
  return items
    .map((item) => {
      let name = item.name.trim();
      let issuer = item.issuer.trim();
      let issue_date = item.issue_date;

      // Se name è "LinkedIn" → probabilmente è issuer
      if (name.toLowerCase() === "linkedin") {
        return null;
      }

      // Se issuer contiene "Data di rilascio" → spostalo
      if (issuer.toLowerCase().includes("data di rilascio")) {
        issue_date = issuer;
        issuer = "";
      }

      // Se issuer sembra un titolo (non azienda) → swap
      if (
        issuer &&
        !issuer.toLowerCase().includes("linkedin") &&
        issuer.length > 40
      ) {
        // probabilmente è un'altra certificazione
        return null;
      }

      return {
        name: name.replace(/^LinkedIn\s*/i, "").trim(),
        issuer: issuer,
        issue_date: issue_date,
        credential_id: ""
      };
    })
    .filter((x): x is CertificationItem => x !== null)
    .filter((x) => x.name.length > 5);
}

async function extractCertifications(page: Page): Promise<CertificationItem[]> {
  const section = await findSectionByTitle(page, ["Licenze e certificazioni", "Licenses & certifications"]);
  if (!section) return [];

  const raw = await rawTextOrEmpty(section);
  const lines = cleanLines(splitLines(raw)).filter(
    (line) =>
      !line.toLowerCase().startsWith("licenze e certificazioni") &&
      !line.toLowerCase().startsWith("licenses & certifications") &&
      !line.includes("Mostra credenziale") &&
      !line.includes("Show credential") &&
      !line.includes("Mostra tutto")
  );

  const results: CertificationItem[] = [];
  let i = 0;

  while (i < lines.length) {
    const name = lines[i] ?? "";
    const issuer = lines[i + 1] ?? "";
    const maybeDate = lines[i + 2] ?? "";

    if (!name || name.length < 3) {
      i++;
      continue;
    }

    const issue_date = /Data di rilascio|Issued/i.test(maybeDate) ? maybeDate : "";

    results.push({
      name: sanitizeInlineText(name),
      issuer: sanitizeInlineText(issuer),
      issue_date: sanitizeInlineText(issue_date),
      credential_id: ""
    });

    i += issue_date ? 3 : 2;
  }

  return cleanCertifications(results);
}

// ---------------- LANGUAGES ----------------

async function extractLanguages(page: Page): Promise<LanguageItem[]> {
  const section = await findSectionByTitle(page, ["Lingue", "Languages"]);
  if (!section) return [];

  const raw = await rawTextOrEmpty(section);
  const lines = cleanLines(splitLines(raw)).filter(
    (line) =>
      line !== "Lingue" &&
      line !== "Languages" &&
      !line.includes("Mostra tutto")
  );

  const results: LanguageItem[] = [];

  for (let i = 0; i < lines.length; i += 2) {
    const name = lines[i] ?? "";
    const proficiency = lines[i + 1] ?? "";

    if (!name) continue;

    results.push({
      name: sanitizeInlineText(name),
      proficiency: sanitizeInlineText(proficiency)
    });
  }

  return results.filter((x) => x.name.length > 1);
}

// ---------------- FEATURED ----------------

type FeaturedItem = {
  title: string;
  description: string;
  url: string;
};

function normalizeFeaturedUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("linkedin.com") && parsed.pathname.includes("/safety/go/")) {
      const target = parsed.searchParams.get("url");
      if (target) {
        return decodeURIComponent(target);
      }
    }

    return url;
  } catch {
    return url;
  }
}

function isRejectedFeaturedUrl(url: string): boolean {
  const lower = url.toLowerCase();

  if (!url) return true;
  if (lower.includes("/search/results/all")) return true;
  if (lower.includes("/feed/hashtag")) return true;
  if (lower.includes("keywords=%23")) return true;
  if (lower.includes("/mynetwork/")) return true;
  if (lower.includes("/notifications/")) return true;
  if (lower.includes("/messaging/")) return true;

  return false;
}

function isUsefulFeaturedUrl(url: string): boolean {
  const normalized = normalizeFeaturedUrl(url);
  const lower = normalized.toLowerCase();

  if (isRejectedFeaturedUrl(normalized)) return false;

  return (
    lower.includes("/feed/update/") ||
    lower.includes("urn:li:activity:") ||
    lower.includes("github.com") ||
    lower.includes("lnkd.in") ||
    lower.includes("build.microsoft.com") ||
    lower.includes("linkedin.com/pulse/") ||
    lower.includes("linkedin.com/posts/")
  );
}

function isFeaturedTitleNoise(line: string): boolean {
  const lower = line.toLowerCase();

  if (!line || line.length < 4) return true;
  if (/^(link|collegamento|immagine|documento|post)$/i.test(line)) return true;
  if (line === "… altro") return true;
  if (lower.includes("reazioni") || lower.includes("commenti") || lower.includes("diffusioni")) return true;
  if (lower.includes("mostra traduzione")) return true;
  if (lower.includes("visualizza offerta")) return true;
  if (lower.includes("vedi analisi")) return true;
  if (lower.includes("invia")) return true;
  if (lower.startsWith("http")) return true;
  if (line.startsWith("#")) return true;
  if (line.startsWith("- ")) return true;
  if (/^https?:\/\//i.test(line)) return true;

  return false;
}

function pickFeaturedTitle(lines: string[], fallbackUrl: string): string {
  const candidates = lines
    .map((line) => sanitizeInlineText(line))
    .filter((line) => !isFeaturedTitleNoise(line));

  const strongTitle = candidates.find((line) =>
    /ai che funziona|decisioni sospese|microsoft build|github|mcp|trappola della matrice/i.test(line)
  );

  if (strongTitle) return strongTitle;

  const firstReasonable = candidates.find((line) => line.length <= 140);
  if (firstReasonable) return firstReasonable;

  return fallbackUrl;
}

function pickFeaturedTextFallback(lines: string[]): FeaturedItem[] {
  const candidates = lines
    .map((line) => sanitizeInlineText(line))
    .filter((line) => !isFeaturedTitleNoise(line))
    .filter((line) => line.length <= 160);

  const unique = Array.from(new Set(candidates));

  return unique.slice(0, 5).map((title) => ({
    title,
    description: "",
    url: ""
  }));
}

async function extractFeatured(page: Page): Promise<FeaturedItem[]> {
  const section = await findSectionByTitle(page, ["In primo piano", "Featured"]);
  if (!section) return [];

  const raw = await rawTextOrEmpty(section);
  console.log("\n=== FEATURED RAW ===");
  console.log(raw.slice(0, 2000));
  console.log("=== END FEATURED RAW ===\n");

  const lines = cleanLines(splitLines(raw)).filter(
    (line) =>
      line !== "In primo piano" &&
      line !== "Featured" &&
      !line.includes("Mostra tutto") &&
      !line.includes("Show all")
  );

  const rawHrefs = await section.locator("a[href]").evaluateAll((anchors) =>
    Array.from(
      new Set(
        anchors
          .map((a) => (a as HTMLAnchorElement).href)
          .filter(Boolean)
      )
    )
  ).catch(() => [] as string[]);

  console.log("\n=== FEATURED HREFS RAW ===");
  console.log(rawHrefs);
  console.log("=== END FEATURED HREFS RAW ===\n");

  const hrefs = Array.from(
    new Set(
      rawHrefs
        .map((url) => normalizeFeaturedUrl(url))
        .filter((url) => isUsefulFeaturedUrl(url))
    )
  );

  console.log("\n=== FEATURED HREFS FILTERED ===");
  console.log(hrefs);
  console.log("=== END FEATURED HREFS FILTERED ===\n");

  const itemsByUrl = new Map<string, FeaturedItem>();

  for (const url of hrefs) {
    if (itemsByUrl.has(url)) continue;

    const title = pickFeaturedTitle(lines, url);

    itemsByUrl.set(url, {
      title: sanitizeInlineText(title),
      description: "",
      url
    });
  }

  const items = Array.from(itemsByUrl.values()).slice(0, 10);

  if (items.length > 0) {
    return items;
  }

  return pickFeaturedTextFallback(lines);
}

// ---------------- RECENT POST ----------------

type PostItem = {
  text: string;
  engagement: string;
};

async function extractRecentPosts(page: Page): Promise<PostItem[]> {
  const section = await findSectionByTitle(page, ["Attività", "Activity"]);
  if (!section) return [];

  const raw = await rawTextOrEmpty(section);

  console.log("\n=== RAW ACTIVITY ===");
  console.log(raw.slice(0, 2000));
  console.log("=== END RAW ACTIVITY ===\n");

  const lines = cleanLines(splitLines(raw));

  const posts: PostItem[] = [];

  let currentPost: string[] = [];

  for (const line of lines) {
    // segnali di separazione post
    if (
      line.includes("reazioni") ||
      line.includes("commenti") ||
      line.includes("diffusioni")
    ) {
      if (currentPost.length > 0) {
        posts.push({
          text: currentPost.join(" "),
          engagement: line
        });
        currentPost = [];
      }
      continue;
    }

    // evita rumore
    if (
      line.includes("Crea un post") ||
      line.includes("Post") ||
      line.includes("Commenti") ||
      line.includes("Immagini") ||
      line.includes("Documenti")
    ) {
      continue;
    }

    currentPost.push(line);
  }

  // fallback ultimo post
  if (currentPost.length > 0) {
    posts.push({
      text: currentPost.join(" "),
      engagement: ""
    });
  }

  // limita a 5 post
  return posts.slice(0, 5);
}

// ---------------- SKILLS ----------------

function isSkillNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();

  if (!line || line.length < 2) return true;
  if (line === "Competenze" || line === "Skills") return true;
  if (/^Competenze\s*\(\d+\)$/i.test(line)) return true;
  if (/^Skills\s*\(\d+\)$/i.test(line)) return true;
  if (line.includes("Mostra tutto") || line.includes("Show all")) return true;
  if (line.includes("Mostra credenziale") || line.includes("Show credential")) return true;
  if (/commenti|diffusioni|reazioni|post|follower/i.test(line)) return true;

  if (isLinkedInSkillMetadataLine(line)) return true;

  if (/\d+\s+esperienze?\s+presso/i.test(lower)) return true;
  if (/esperienze?\s+presso/i.test(lower)) return true;
  if (/altre?\s+\d+\s+aziende/i.test(lower)) return true;
  if (/\d+\s+experiences?\s+at/i.test(lower)) return true;
  if (/other\s+\d+\s+companies/i.test(lower)) return true;

  if (/confermat[aoe]? da/i.test(lower)) return true;
  if (/endorsements?/i.test(lower)) return true;
  if (/^\d+\s+conferme?/i.test(lower)) return true;

  return false;
}

async function extractSkills(page: Page): Promise<string[]> {
  const pageWithSkills = await maybeOpenSection(page, "skills");

  try {
    const section = await findSectionByTitle(pageWithSkills, ["Competenze", "Skills"]);
    if (!section) return [];

    const raw = await rawTextOrEmpty(section);
    console.log("\n=== SKILLS RAW ===");
    console.log(raw.slice(0, 2000));
    console.log("=== END SKILLS RAW ===\n");

    const lines = cleanLines(splitLines(raw))
      .map((line) => sanitizeInlineText(line))
      .filter((line) => !isSkillNoiseLine(line))
      .filter((line) => line.length > 1 && line.length < 100)
      .filter((line) => !isDateLine(line))
      .filter((line) => !isLocationLine(line))
      .filter((line) => !isCompanyLine(line));

    return Array.from(new Set(lines)).slice(0, 50);
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

    await autoScrollMain(page);

    const root = await getProfileRoot(page);
    const sections = root.locator("section");
    const sectionCount = await sections.count();
    const recent_posts = await extractRecentPosts(page);
    console.log("\n=== POSTS DEBUG ===");
    console.log(recent_posts);
    console.log("=== END POSTS DEBUG ===\n");

    console.log("\n=== PROFILE SECTIONS DEBUG ===");
    for (let i = 0; i < sectionCount; i++) {
      const txt = await sections.nth(i).textContent();
      console.log(`\n[SECTION ${i}]`);
      console.log((txt || "").slice(0, 250));
    }
    console.log("\n=== END DEBUG ===\n");

    console.log("\n=== PROFILE HEADINGS DEBUG ===");
    const rootAllText = await page.locator("main").first().textContent();
    console.log("Contains 'Esperienza':", (rootAllText || "").includes("Esperienza"));
    console.log("Contains 'Formazione':", (rootAllText || "").includes("Formazione"));
    console.log("Contains 'Competenze':", (rootAllText || "").includes("Competenze"));
    console.log("Contains 'In primo piano':", (rootAllText || "").includes("In primo piano"));
    console.log("\n=== END HEADINGS DEBUG ===\n");

    const expCount = await page.getByText("Esperienza", { exact: true }).count();
    const eduCount = await page.getByText("Formazione", { exact: true }).count();
    const skillsCount = await page.getByText("Competenze", { exact: true }).count();
    const featuredCount = await page.getByText("In primo piano", { exact: true }).count();

    console.log("Exact Esperienza count:", expCount);
    console.log("Exact Formazione count:", eduCount);
    console.log("Exact Competenze count:", skillsCount);
    console.log("Exact In primo piano count:", featuredCount);

    await debugScrollableContainers(page);

    const core = await extractCore(page);
    const about = await extractAbout(page);
    const experience = await extractExperience(page);
    const education = await extractEducation(page);
    const certifications = await extractCertifications(page);
    const skills = await extractSkills(page);
    const languages = await extractLanguages(page);
    const featured = await extractFeatured(page);

    console.log("\n=== CERTIFICATIONS DEBUG ===");
    console.log(certifications);
    console.log("=== END CERTIFICATIONS DEBUG ===\n");

    console.log("\n=== LANGUAGES DEBUG ===");
    console.log(languages);
    console.log("=== END LANGUAGES DEBUG ===\n");

    console.log("\n=== FEATURED DEBUG ===");
    console.log(featured);
    console.log("=== END FEATURED DEBUG ===\n");

    return {
      parser_version: "0.2.3",
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
      certifications,
      languages,
      featured,
      recent_posts,
    };
  } finally {
    await context.close().catch(() => null);
  }
}

async function debugScrollableContainers(page: Page): Promise<void> {
  const containers = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    return all
      .map((el) => {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const scrollHeight = (el as HTMLElement).scrollHeight || 0;
        const clientHeight = (el as HTMLElement).clientHeight || 0;
        const text = (el.textContent || "").trim().slice(0, 80);

        return {
          tag: el.tagName,
          overflowY,
          scrollHeight,
          clientHeight,
          text
        };
      })
      .filter((x) => x.scrollHeight > x.clientHeight + 200)
      .slice(0, 20);
  });

  console.log("\n=== SCROLLABLE CONTAINERS DEBUG ===");

  for (const c of containers) {
    console.log(c);
  }
  console.log("=== END SCROLLABLE CONTAINERS DEBUG ===\n");
}
