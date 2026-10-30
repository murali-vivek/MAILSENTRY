import {
  DEFAULT_PAGE_LIMIT,
  MAX_NOTE_LENGTH,
  MAX_PAGE_LIMIT,
  MAX_PAGE_OFFSET,
  REVIEW_STATUSES,
  RISK_LEVELS,
} from "./constants";
import type { ReviewStatus, RiskLevel, VendorInput } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isReviewStatus(value: string): value is ReviewStatus {
  return (REVIEW_STATUSES as readonly string[]).includes(value);
}

export function isRiskLevel(value: string): value is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(value);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

export function parseEmailAddress(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > 320 || !EMAIL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function parseDomain(value: string): string | null {
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (!domain || domain.length > 253 || domain.includes("://") || domain.includes("@")) return null;
  if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return null;
  }
  if (domain.split(".").some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) {
    return null;
  }
  return domain;
}

export function parseStringList(value: unknown, maxItems: number, maxItem: number): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > maxItems) return null;
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const trimmed = entry.trim();
    if (!trimmed || trimmed.length > maxItem) return null;
    items.push(trimmed);
  }
  return items;
}

export function parseVendorInput(value: unknown): VendorInput | { error: string } {
  if (!isRecord(value)) return { error: "Vendor details must be an object." };
  if (typeof value.displayName !== "string") return { error: "Display name is required." };
  const displayName = value.displayName.trim();
  if (displayName.length < 2 || displayName.length > 120) {
    return { error: "Display name must be 2 to 120 characters." };
  }
  let canonicalDomain: string | null = null;
  if (value.canonicalDomain !== undefined && value.canonicalDomain !== null && value.canonicalDomain !== "") {
    if (typeof value.canonicalDomain !== "string") return { error: "Canonical domain is invalid." };
    canonicalDomain = parseDomain(value.canonicalDomain);
    if (!canonicalDomain) return { error: "Canonical domain is invalid." };
  }
  const senderRaw = parseStringList(value.senderAddresses ?? [], 30, 320);
  const domainRaw = parseStringList(value.domains ?? [], 30, 253);
  const recipientRaw = parseStringList(value.internalRecipients ?? [], 30, 320);
  if (!senderRaw || !domainRaw || !recipientRaw) {
    return { error: "Sender, domain, or recipient lists are invalid." };
  }
  const senderAddresses: string[] = [];
  for (const item of senderRaw) {
    const address = parseEmailAddress(item);
    if (!address) return { error: `Sender address is invalid: ${item.slice(0, 80)}` };
    if (!senderAddresses.includes(address)) senderAddresses.push(address);
  }
  const domains: string[] = [];
  for (const item of domainRaw) {
    const domain = parseDomain(item);
    if (!domain) return { error: `Domain is invalid: ${item.slice(0, 80)}` };
    if (!domains.includes(domain)) domains.push(domain);
  }
  if (canonicalDomain && !domains.includes(canonicalDomain)) domains.push(canonicalDomain);
  const internalRecipients: string[] = [];
  for (const item of recipientRaw) {
    const address = parseEmailAddress(item);
    if (!address) return { error: `Recipient address is invalid: ${item.slice(0, 80)}` };
    if (!internalRecipients.includes(address)) internalRecipients.push(address);
  }
  return { displayName, canonicalDomain, senderAddresses, domains, internalRecipients };
}

export function parsePagination(url: URL): { limit: number; offset: number } | { error: string } {
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const limit = limitRaw === null ? DEFAULT_PAGE_LIMIT : Number(limitRaw);
  const offset = offsetRaw === null ? 0 : Number(offsetRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    return { error: "limit must be an integer from 1 to 100." };
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_PAGE_OFFSET) {
    return { error: "offset must be an integer from 0 to 10000." };
  }
  return { limit, offset };
}

export function parseReviewBody(value: unknown): { status: ReviewStatus; note: string | null } | { error: string } {
  if (!isRecord(value) || typeof value.status !== "string" || !isReviewStatus(value.status)) {
    return { error: "Review status is invalid." };
  }
  if (value.note === undefined || value.note === null || value.note === "") {
    return { status: value.status, note: null };
  }
  if (typeof value.note !== "string") return { error: "Review note must be text." };
  const note = value.note.trim();
  if (note.length > MAX_NOTE_LENGTH) return { error: "Review note must be 500 characters or fewer." };
  return { status: value.status, note: note || null };
}

export function likeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}
