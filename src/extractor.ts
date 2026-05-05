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


function isDateLine(line: string): boolean {
  return (
    /\d{4}/.test(line) &&
    /\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line)
  );
}

function isCompanyLine(line: string): boolean {
  return /^(invenco|gilbarco|rcproject|vontier)\b/i.test(line.trim());
}

function isLocationLine(line: string): boolean {
  return /^(firenze|italia|toscana|ibrido|ibrida|hybrid|remote|on-site|in sede)\b/i.test(line.trim());
}

function isLikelyRoleLine(line: string): boolean {
  const cleaned = cleanExperienceField(line);
  const lower = cleaned.toLowerCase();

  if (!cleaned || cleaned.length < 3) return false;
  if (isNoiseLine(cleaned)) return false;
  if (isDateLine(cleaned)) return false;
  if (isCompanyLine(cleaned)) return false;
  if (isLocationLine(cleaned)) return false;
  if (/^\d+ anni/i.test(cleaned)) return false;
  if (/^(responsabilità|fornitori|competenze|skills|clienti interni)\b/i.test(cleaned)) return false;
  if (lower === "… altro") return false;
  if (/\+\d+ competenze?/i.test(cleaned)) return false;

  return true;
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
  if (/conferme? di competenza/i.test(line)) return true;
  if (/endorsements?/i.test(line)) return true;
  if (/responsabilità|fornitori|clienti interni/i.test(line) && /\+\d+ competenz/i.test(line)) return true;
  if (isCompanyLine(line)) return true;

  return isNoiseLine(line);
}

function extractExperienceDetailsFromLines(
  lines: string[],
  startIndex: number,
  nextRoleIndex: number
): { description: string; highlights: string[] } {
  const detailStart = startIndex + 3;
  const detailEnd = nextRoleIndex > -1 ? nextRoleIndex : lines.length;

  const detailLines = cleanLines(lines.slice(detailStart, detailEnd))
    .filter((line) => !isExperienceDescriptionNoise(line))
    .filter((line) => !isDateLine(line))
    .filter((line) => !isLocationLine(line))
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

  const company = lines.find((line) => isCompanyLine(line)) ?? lines[0] ?? "";
  const roleIndexes: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const role = lines[i];
    const next = lines[i + 1] ?? "";

    if (isLikelyRoleLine(role) && isDateLine(next)) {
      roleIndexes.push(i);
    }
  }

  for (let r = 0; r < roleIndexes.length; r++) {
    const i = roleIndexes[r];
    const role = lines[i];
    const next = lines[i + 1] ?? "";
    const next2 = lines[i + 2] ?? "";
    const nextRoleIndex = roleIndexes[r + 1] ?? -1;
    const details = extractExperienceDetailsFromLines(lines, i, nextRoleIndex);

    results.push({
      company: cleanExperienceField(sanitizeInlineText(company)),
      role: cleanExperienceField(sanitizeInlineText(role)),
      employment_type: "",
      start_date: sanitizeInlineText(next),
      end_date: "",
      location: sanitizeInlineText(next2),
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

// ---------------- RECENT POST ----------------

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

async function extractSkills(page: Page): Promise<string[]> {
  const pageWithSkills = await maybeOpenSection(page, "skills");

  try {
    const section = await findSectionByTitle(pageWithSkills, ["Competenze", "Skills"]);
    if (!section) return [];

    const raw = await rawTextOrEmpty(section);
    const lines = cleanLines(splitLines(raw)).filter(
      (line) =>
        line !== "Competenze" &&
        line !== "Skills" &&
        !/^Competenze\s*\(\d+\)$/i.test(line) &&
        !/^Skills\s*\(\d+\)$/i.test(line) &&
        !line.includes("Mostra tutto")
    );

    const skills = lines.filter(
      (line) =>
        line.length > 1 &&
        line.length < 100 &&
        !/commenti|diffusioni|reazioni|post|follower/i.test(line)
    );

    return Array.from(new Set(skills)).slice(0, 50);
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
    console.log("\n=== END HEADINGS DEBUG ===\n");

    const expCount = await page.getByText("Esperienza", { exact: true }).count();
    const eduCount = await page.getByText("Formazione", { exact: true }).count();
    const skillsCount = await page.getByText("Competenze", { exact: true }).count();

    console.log("Exact Esperienza count:", expCount);
    console.log("Exact Formazione count:", eduCount);
    console.log("Exact Competenze count:", skillsCount);

    await debugScrollableContainers(page);

    const core = await extractCore(page);
    const about = await extractAbout(page);
    const experience = await extractExperience(page);
    const education = await extractEducation(page);
    const certifications = await extractCertifications(page);
    const skills = await extractSkills(page);
    const languages = await extractLanguages(page);

    console.log("\n=== CERTIFICATIONS DEBUG ===");
    console.log(certifications);
    console.log("=== END CERTIFICATIONS DEBUG ===\n");

    console.log("\n=== LANGUAGES DEBUG ===");
    console.log(languages);
    console.log("=== END LANGUAGES DEBUG ===\n");

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
      certifications,
      languages,
      featured: [],
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