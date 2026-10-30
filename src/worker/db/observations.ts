import { parseJsonArray } from "../../shared/sanitize";
import type { ObservationSnapshot, VendorObservation } from "../../shared/types";
import { asRows, flag, integer, requiredText, text } from "./common";

export async function listObservationSnapshots(db: D1Database, vendorId: string): Promise<ObservationSnapshot[]> {
  const rows = await db
    .prepare(
      `SELECT sender_address, sender_domain, recipient_addresses, request_categories, source_ips, hour_of_day, day_of_week, is_bank_change_request, baseline_eligible
       FROM vendor_observations WHERE vendor_id = ? AND baseline_eligible = 1 ORDER BY observed_at DESC LIMIT 200`,
    )
    .bind(vendorId)
    .all();
  return asRows(rows).map((row) => ({
    senderAddress: text(row, "sender_address"),
    senderDomain: text(row, "sender_domain"),
    recipients: parseJsonArray(row.recipient_addresses),
    categories: parseJsonArray(row.request_categories),
    sourceIps: parseJsonArray(row.source_ips),
    hourOfDay: row.hour_of_day === null || row.hour_of_day === undefined ? null : integer(row, "hour_of_day"),
    dayOfWeek: row.day_of_week === null || row.day_of_week === undefined ? null : integer(row, "day_of_week"),
    isBankChangeRequest: flag(row, "is_bank_change_request"),
  }));
}

export async function listVendorHistory(
  db: D1Database,
  vendorId: string,
  limit: number,
  offset: number,
): Promise<{ items: VendorObservation[]; total: number }> {
  const count = await db
    .prepare(`SELECT COUNT(*) AS total FROM vendor_observations WHERE vendor_id = ? AND baseline_eligible = 1`)
    .bind(vendorId)
    .first<{ total: number }>();
  const rows = await db
    .prepare(
      `SELECT id, analysis_id, observed_at, sender_address, sender_domain, recipient_addresses, request_categories, source_ips, hour_of_day, day_of_week, is_bank_change_request, baseline_eligible
       FROM vendor_observations WHERE vendor_id = ? AND baseline_eligible = 1 ORDER BY observed_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(vendorId, limit, offset)
    .all();
  return {
    total: count?.total ?? 0,
    items: asRows(rows).map((row) => ({
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
    })),
  };
}

export async function findObservationByAnalysis(db: D1Database, analysisId: string): Promise<{ id: string; vendorId: string } | null> {
  const row = await db
    .prepare(`SELECT id, vendor_id FROM vendor_observations WHERE analysis_id = ?`)
    .bind(analysisId)
    .first<{ id: string; vendor_id: string }>();
  if (!row) return null;
  return { id: row.id, vendorId: row.vendor_id };
}

export async function insertObservation(
  db: D1Database,
  input: {
    id: string;
    vendorId: string;
    analysisId: string;
    observedAt: string;
    senderAddress: string | null;
    senderDomain: string | null;
    recipients: string[];
    categories: string[];
    sourceIps: string[];
    hourOfDay: number | null;
    dayOfWeek: number | null;
    createdAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO vendor_observations (
        id, vendor_id, analysis_id, observed_at, sender_address, sender_domain, recipient_addresses, request_categories,
        source_ips, hour_of_day, day_of_week, is_bank_change_request, baseline_eligible, exclusion_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, NULL, ?)`,
    )
    .bind(
      input.id,
      input.vendorId,
      input.analysisId,
      input.observedAt,
      input.senderAddress,
      input.senderDomain,
      JSON.stringify(input.recipients),
      JSON.stringify(input.categories),
      JSON.stringify(input.sourceIps),
      input.hourOfDay,
      input.dayOfWeek,
      input.createdAt,
    )
    .run();
}

export async function observationBounds(db: D1Database, vendorId: string): Promise<{ count: number; first: string | null; last: string | null }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count, MIN(observed_at) AS first_seen, MAX(observed_at) AS last_seen
       FROM vendor_observations WHERE vendor_id = ? AND baseline_eligible = 1`,
    )
    .bind(vendorId)
    .first<{ count: number; first_seen: string | null; last_seen: string | null }>();
  return { count: row?.count ?? 0, first: row?.first_seen ?? null, last: row?.last_seen ?? null };
}
