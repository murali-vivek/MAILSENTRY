import { nowIso, timeParts } from "../../shared/sanitize";
import type { ReviewStatus } from "../../shared/types";
import { ApiError } from "../middleware/errors";
import { getAnalysis, updateReviewStatus } from "../db/analyses";
import { findObservationByAnalysis, insertObservation, observationBounds } from "../db/observations";
import { updateVendorStats } from "../db/vendors";
import { maturityForCount } from "../vendor/baseline";
import type { AnalysisDetail } from "../../shared/types";

export async function reviewAnalysis(
  db: D1Database,
  id: string,
  status: ReviewStatus,
  note: string | null,
): Promise<AnalysisDetail> {
  const updated = await updateReviewStatus(db, id, status, note);
  if (!updated) throw new ApiError(404, "NOT_FOUND", "Analysis not found.");
  const detail = await getAnalysis(db, id);
  if (!detail) throw new ApiError(404, "NOT_FOUND", "Analysis not found.");
  return detail;
}

export async function addToVendorHistory(db: D1Database, id: string, confirm: boolean): Promise<{
  ok: true;
  observationId: string;
  vendorId: string;
  baselineStatus: string;
}> {
  if (confirm !== true) {
    throw new ApiError(422, "CONFIRMATION_REQUIRED", "Confirm this action before adding it to vendor history.");
  }
  const detail = await getAnalysis(db, id);
  if (!detail) throw new ApiError(404, "NOT_FOUND", "Analysis not found.");
  const existing = await findObservationByAnalysis(db, id);
  if (existing) {
    const bounds = await observationBounds(db, existing.vendorId);
    return {
      ok: true,
      observationId: existing.id,
      vendorId: existing.vendorId,
      baselineStatus: maturityForCount(bounds.count),
    };
  }
  if (detail.vendorMatchStatus !== "matched" || !detail.vendorId) {
    throw new ApiError(409, "NOT_ELIGIBLE", "The message is not matched to exactly one vendor.");
  }
  if (detail.reviewStatus !== "benign_after_review") {
    throw new ApiError(409, "NOT_ELIGIBLE", "Mark the analysis benign after review before adding it to vendor history.");
  }
  if (detail.requestCategories.includes("bank_detail_change")) {
    throw new ApiError(422, "NOT_ELIGIBLE", "Bank-detail change requests cannot be added to the baseline.");
  }
  const observationId = crypto.randomUUID();
  const timestamp = nowIso();
  const when = timeParts(detail.receivedAt);
  try {
    await insertObservation(db, {
      id: observationId,
      vendorId: detail.vendorId,
      analysisId: detail.id,
      observedAt: detail.receivedAt ?? detail.createdAt,
      senderAddress: detail.fromAddress,
      senderDomain: detail.senderDomain,
      recipients: detail.toAddresses,
      categories: detail.requestCategories,
      sourceIps: detail.observedSourceIps,
      hourOfDay: when.hour,
      dayOfWeek: when.day,
      createdAt: timestamp,
    });
    const bounds = await observationBounds(db, detail.vendorId);
    await updateVendorStats(db, detail.vendorId, {
      count: bounds.count,
      status: maturityForCount(bounds.count),
      firstSeenAt: bounds.first,
      lastSeenAt: bounds.last,
      updatedAt: timestamp,
    });
    return {
      ok: true,
      observationId,
      vendorId: detail.vendorId,
      baselineStatus: maturityForCount(bounds.count),
    };
  } catch (error) {
    const raced = await findObservationByAnalysis(db, id);
    if (raced) {
      return { ok: true, observationId: raced.id, vendorId: raced.vendorId, baselineStatus: "limited" };
    }
    throw error;
  }
}
