import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const templateCache = new Map<string, string>();

export function loadMailTemplateFile(filename: string): string {
  const cached = templateCache.get(filename);
  if (cached) return cached;
  const path = join(__dirname, 'templates', filename);
  const raw = readFileSync(path, 'utf8');
  templateCache.set(filename, raw);
  return raw;
}

/** Replaces `{{key}}` placeholders (greedy, no HTML escaping). */
export function substituteMailTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const token = `{{${key}}}`;
    const parts = out.split(token);
    out = parts.join(value);
  }
  return out;
}
