import { nowIso, parseJsonArray } from "../../shared/sanitize";
import type { VendorDetail, VendorDirectoryEntry, VendorInput, VendorObservation, VendorSummary } from "../../shared/types";
import { mapSummary } from "./analyses";
import { asRows, flag, integer, requiredText, text } from "./common";

const VENDOR_COLUMNS = `id, display_name, canonical_domain, first_seen_at, last_seen_at, history_email_count, baseline_status, created_at, updated_at, is_demo`;

export async function listDirectory(db: D1Database): Promise<VendorDirectoryEntry[]> {
  const vendors = await listVendorRows(db);
  return vendors.map(toDirectory);
}

export async function listVendors(db: D1Database): Promise<VendorSummary[]> {
  return listVendorRows(db);
}

export async function getVendor(db: D1Database, id: string): Promise<VendorDetail | null> {
  const vendors = await listVendorRows(db);
  const vendor = vendors.find((item) => item.id === id);
  if (!vendor) return null;
  const observations = await db
    .prepare(
      `SELECT id, analysis_id, observed_at, sender_address, sender_domain, recipient_addresses, request_categories, source_ips, hour_of_day, day_of_week, is_bank_change_request, baseline_eligible
       FROM vendor_observations WHERE vendor_id = ? ORDER BY observed_at DESC LIMIT 50`,
    )
    .bind(id)
    .all();
  const analyses = await db
    .prepare(
      `SELECT a.id, a.original_filename, a.subject, a.from_address, a.from_display_name, a.risk_level, a.risk_score, a.context_status, a.review_status, a.vendor_match_status, a.vendor_id, v.display_name AS vendor_name, a.request_categories, a.created_at, a.is_demo
       FROM email_analyses a LEFT JOIN vendors v ON v.id = a.vendor_id
       WHERE a.vendor_id = ? ORDER BY a.created_at DESC LIMIT 20`,
    )
    .bind(id)
    .all();
  return {
    ...vendor,
    observations: asRows(observations).map(mapObservation),
    recentAnalyses: asRows(analyses).map((row) => mapSummary(row)),
  };
}

export async function insertVendor(db: D1Database, input: VendorInput, isDemo: boolean): Promise<VendorSummary> {
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO vendors (id, display_name, canonical_domain, first_seen_at, last_seen_at, history_email_count, baseline_status, created_at, updated_at, is_demo)
       VALUES (?, ?, ?, NULL, NULL, 0, 'no_history', ?, ?, ?)`,
    )
    .bind(id, input.displayName, input.canonicalDomain, timestamp, timestamp, isDemo ? 1 : 0)
    .run();
  await replaceChildren(db, id, input, timestamp);
  const vendor = (await listVendorRows(db)).find((item) => item.id === id);
  if (!vendor) throw new Error("Vendor insert did not persist.");
  return vendor;
}

export async function updateVendor(db: D1Database, id: string, input: VendorInput): Promise<VendorSummary | null> {
  const existing = await db.prepare(`SELECT id FROM vendors WHERE id = ?`).bind(id).first<{ id: string }>();
  if (!existing) return null;
  const timestamp = nowIso();
  await db
    .prepare(`UPDATE vendors SET display_name = ?, canonical_domain = ?, updated_at = ? WHERE id = ?`)
    .bind(input.displayName, input.canonicalDomain, timestamp, id)
    .run();
  await replaceChildren(db, id, input, timestamp);
  return (await listVendorRows(db)).find((item) => item.id === id) ?? null;
}

export async function updateVendorStats(
  db: D1Database,
  id: string,
  stats: { count: number; status: string; firstSeenAt: string | null; lastSeenAt: string | null; updatedAt: string },
): Promise<void> {
  await db
    .prepare(
      `UPDATE vendors SET history_email_count = ?, baseline_status = ?, first_seen_at = ?, last_seen_at = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(stats.count, stats.status, stats.firstSeenAt, stats.lastSeenAt, stats.updatedAt, id)
    .run();
}

async function listVendorRows(db: D1Database): Promise<VendorSummary[]> {
  const [vendorResult, senderResult, domainResult, recipientResult] = await db.batch([
    db.prepare(`SELECT ${VENDOR_COLUMNS} FROM vendors ORDER BY display_name COLLATE NOCASE`),
    db.prepare(`SELECT vendor_id, address FROM vendor_sender_identities ORDER BY address`),
    db.prepare(`SELECT vendor_id, domain FROM vendor_domains ORDER BY domain`),
    db.prepare(`SELECT vendor_id, address FROM vendor_internal_recipients ORDER BY address`),
  ]);
  const senders = group(asRows(senderResult), "address");
  const domains = group(asRows(domainResult), "domain");
  const recipients = group(asRows(recipientResult), "address");
  return asRows(vendorResult).map((row) => {
    const id = requiredText(row, "id");
    return {
      id,
      displayName: requiredText(row, "display_name"),
      canonicalDomain: text(row, "canonical_domain"),
      baselineStatus: requiredText(row, "baseline_status") as VendorSummary["baselineStatus"],
      historyEmailCount: integer(row, "history_email_count"),
      firstSeenAt: text(row, "first_seen_at"),
      lastSeenAt: text(row, "last_seen_at"),
      senderAddresses: senders.get(id) ?? [],
      domains: domains.get(id) ?? [],
      internalRecipients: recipients.get(id) ?? [],
      createdAt: requiredText(row, "created_at"),
      updatedAt: requiredText(row, "updated_at"),
      isDemo: flag(row, "is_demo"),
    };
  });
}

function toDirectory(vendor: VendorSummary): VendorDirectoryEntry {
  return {
    id: vendor.id,
    displayName: vendor.displayName,
    canonicalDomain: vendor.canonicalDomain,
    senderAddresses: vendor.senderAddresses,
    domains: vendor.domains,
    internalRecipients: vendor.internalRecipients,
  };
}

function group(rows: Record<string, unknown>[], valueKey: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const id = text(row, "vendor_id");
    const value = text(row, valueKey);
    if (!id || !value) continue;
    const list = map.get(id) ?? [];
    list.push(value);
    map.set(id, list);
  }
  return map;
}

async function replaceChildren(db: D1Database, vendorId: string, input: VendorInput, timestamp: string): Promise<void> {
  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM vendor_sender_identities WHERE vendor_id = ?`).bind(vendorId),
    db.prepare(`DELETE FROM vendor_domains WHERE vendor_id = ?`).bind(vendorId),
    db.prepare(`DELETE FROM vendor_internal_recipients WHERE vendor_id = ?`).bind(vendorId),
  ];
  for (const address of input.senderAddresses) {
    statements.push(
      db.prepare(`INSERT INTO vendor_sender_identities (id, vendor_id, address, created_at) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), vendorId, address, timestamp),
    );
  }
  for (const domain of input.domains) {
    statements.push(
      db.prepare(`INSERT INTO vendor_domains (id, vendor_id, domain, created_at) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), vendorId, domain, timestamp),
    );
  }
  for (const address of input.internalRecipients) {
    statements.push(
      db.prepare(`INSERT INTO vendor_internal_recipients (id, vendor_id, address, created_at) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), vendorId, address, timestamp),
    );
  }
  await db.batch(statements);
}

function mapObservation(row: Record<string, unknown>): VendorObservation {
  return {
    id: requiredText(row, "id"),
    analysisId: requiredText(row, "analysis_id"),
    observedAt: requiredText(row, "observed_at"),
    senderAddress: text(row, "sender_address"),
    senderDomain: text(row, "sender_domain"),
    recipients: parseJsonArray(row.recipient_addresses),
    categories: parseJsonArray(row.request_categories),
    sourceIps: parseJsonArray(row.source_ips),
    hourOfDay: row.hour_of_day === null || row.hour_of_day === undefined ? null : integer(row, "hour_of_day"),
    dayOfWeek: row.day_of_week === null || row.day_of_week === undefined ? null : integer(row, "day_of_week"),
    isBankChangeRequest: flag(row, "is_bank_change_request"),
    baselineEligible: flag(row, "baseline_eligible"),
  };
}
