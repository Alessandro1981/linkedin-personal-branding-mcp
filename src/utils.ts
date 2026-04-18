import fs from 'node:fs';
import path from 'node:path';

export function sanitizeText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

export function sanitizeMultilineText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function splitHighlights(text: string, maxItems = 5): string[] {
  if (!text) return [];

  return text
    .split(/\n|•|\-|·/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20)
    .slice(0, maxItems);
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[:]/g, '-');
}

export function writePrettyJson(targetPath: string, data: unknown): void {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
}
