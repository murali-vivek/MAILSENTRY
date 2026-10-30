import type { ParsedAuthentication } from "../../shared/types";

export function asRows(result: D1Result): Record<string, unknown>[] {
  return (result.results ?? []) as Record<string, unknown>[];
}

export function text(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

export function requiredText(row: Record<string, unknown>, key: string): string {
  return text(row, key) ?? "";
}

export function integer(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

export function flag(row: Record<string, unknown>, key: string): boolean {
  return integer(row, key) === 1;
}

export function authFromJson(value: unknown): ParsedAuthentication {
  if (typeof value !== "string") {
    return { spf: "missing", dkim: "missing", dmarc: "missing", usable: false, sawHeader: false };
  }
  try {
    const parsed = JSON.parse(value) as Partial<ParsedAuthentication>;
    const method = (item: unknown): ParsedAuthentication["spf"] =>
      item === "pass" || item === "fail" || item === "none" || item === "unknown" || item === "missing" ? item : "missing";
    return {
      spf: method(parsed.spf),
      dkim: method(parsed.dkim),
      dmarc: method(parsed.dmarc),
      usable: Boolean(parsed.usable),
      sawHeader: Boolean(parsed.sawHeader),
    };
  } catch {
    return { spf: "missing", dkim: "missing", dmarc: "missing", usable: false, sawHeader: false };
  }
}
