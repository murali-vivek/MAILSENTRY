import { ANALYSIS_VERSION } from "../../shared/constants";
import { nowIso, sanitizeFilename, sanitizeText } from "../../shared/sanitize";
import type { AnalysisDetail, NormalizedMessage, ReviewStatus } from "../../shared/types";
import { ApiError } from "../middleware/errors";
import { evaluateMessage } from "../detection/engine";
import { EmailParseError, parseEmailBytes } from "../email/parse";
import { normalizeEmail } from "../email/normalize";
import { buildBaseline } from "../vendor/baseline";
import { matchVendor } from "../vendor/matching";
import { getAnalysis, insertAnalysis } from "../db/analyses";
import { listObservationSnapshots } from "../db/observations";
import { listDirectory } from "../db/vendors";

export async function analyzeUpload(db: D1Database, file: File, isDemo = false): Promise<AnalysisDetail> {
  if (!file.name.toLowerCase().endsWith(".eml")) {
    throw new ApiError(400, "VALIDATION_ERROR", "Only .eml files can be analyzed.");
  }
  if (file.size > 512 * 1024) {
    throw new ApiError(413, "UPLOAD_TOO_LARGE", "The uploaded file is larger than 512 KiB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > 512 * 1024) {
    throw new ApiError(413, "UPLOAD_TOO_LARGE", "The uploaded file is larger than 512 KiB.");
  }
  let message: NormalizedMessage;
  try {
    message = normalizeEmail(await parseEmailBytes(bytes));
  } catch (error) {
    if (error instanceof EmailParseError) {
      throw new ApiError(400, "INVALID_EMAIL", "The uploaded file could not be parsed as an email.");
    }
    throw error;
  }
  return persistMessage(db, message, sanitizeFilename(file.name || "message.eml"), {
    isDemo,
    reviewStatus: "unreviewed",
  });
}

export async function persistMessage(
  db: D1Database,
  message: NormalizedMessage,
  filename: string,
  options: { isDemo: boolean; reviewStatus: ReviewStatus },
): Promise<AnalysisDetail> {
  const directory = await listDirectory(db);
  const match = matchVendor(message.fromAddress, message.senderDomain, directory);
  const observations = match.vendor ? await listObservationSnapshots(db, match.vendor.id) : [];
  const baseline = buildBaseline({
    matchStatus: match.status,
    matchedBy: match.matchedBy,
    vendor: match.vendor,
    observations,
    directory,
  });
  const result = evaluateMessage(message, baseline);
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  await insertAnalysis(db, {
    id,
    originalFilename: sanitizeFilename(filename),
    messageId: message.messageId ? sanitizeText(message.messageId, 200) : null,
    receivedAt: message.receivedAt,
    importedAt: timestamp,
    fromAddress: message.fromAddress,
    fromDisplayName: message.fromDisplayName ? sanitizeText(message.fromDisplayName, 200) : null,
    senderDomain: message.senderDomain,
    replyToAddresses: message.replyToAddresses,
    toAddresses: message.toAddresses,
    ccAddresses: message.ccAddresses,
    subject: message.subject ? sanitizeText(message.subject, 300) : null,
    bodyHtmlPresent: message.bodyHtmlPresent,
    observedSourceIps: message.observedSourceIps,
    authenticationResults: message.authentication,
    vendorId: match.vendor?.id ?? null,
    vendorMatchStatus: match.status,
    requestCategories: result.requestCategories,
    riskLevel: result.riskLevel,
    contextStatus: result.contextStatus,
    riskScore: result.score,
    summary: sanitizeText(result.summary, 1200),
    recommendations: result.recommendations.map((item) => sanitizeText(item, 400)),
    reviewStatus: options.reviewStatus,
    analysisVersion: ANALYSIS_VERSION,
    isDemo: options.isDemo,
    createdAt: timestamp,
    findings: result.persistedFindings,
  });
  const detail = await getAnalysis(db, id);
  if (!detail) throw new ApiError(500, "INTERNAL_ERROR", "The request could not be completed.");
  return detail;
}
