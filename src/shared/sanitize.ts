export function sanitizeText(input: string, max: number): string {
  const cleaned = input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\b\d(?:[ -]?\d){7,}\b/g, "[redacted-number]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, "[redacted-number]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, max);
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "message.eml";
  const cleaned = base.replace(/[\u0000-\u001F\u007F]/g, "").replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
  const withExtension = cleaned.toLowerCase().endsWith(".eml") ? cleaned : `${cleaned || "message"}.eml`;
  if (withExtension.length <= 120) return withExtension;
  return `${withExtension.slice(0, 116)}.eml`;
}

export function domainOf(address: string | null): string | null {
  if (!address) return null;
  const at = address.lastIndexOf("@");
  if (at < 1 || at === address.length - 1) return null;
  return address.slice(at + 1);
}

export function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function timeParts(iso: string | null): { hour: number | null; day: number | null } {
  if (!iso) return { hour: null, day: null };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { hour: null, day: null };
  return { hour: date.getUTCHours(), day: date.getUTCDay() };
}

export function domainsRelated(host: string, domains: string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
