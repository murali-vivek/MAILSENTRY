import { parseJsonArray } from "../../shared/sanitize";
import type {
  AnalysisDetail,
  AnalysisListResponse,
  AnalysisSummary,
  ContextStatus,
  DashboardResponse,
  FindingDraft,
  FindingResponse,
  MatchStatus,
  RequestCategory,
  ReviewEventResponse,
  ReviewStatus,
  RiskLevel,
} from "../../shared/types";
import { assessHistoryEligibility } from "../domain/review";
import { ruleById } from "../detection/rules";
import { asRows, authFromJson, flag, integer, requiredText, text } from "./common";

const SUMMARY_SELECT = `a.id, a.original_filename, a.subject, a.from_address, a.from_display_name, a.risk_level, a.risk_score, a.context_status, a.review_status, a.vendor_match_status, a.vendor_id, v.display_name AS vendor_name, a.request_categories, a.created_at, a.is_demo`;

export type NewAnalysis = {
  id: string;
  originalFilename: string;
  messageId: string | null;
  receivedAt: string | null;
  importedAt: string;
  fromAddress: string | null;
  fromDisplayName: string | null;
  senderDomain: string | null;
  replyToAddresses: string[];
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  bodyHtmlPresent: boolean;
  observedSourceIps: string[];
  authenticationResults: unknown;
  vendorId: string | null;
  vendorMatchStatus: MatchStatus;
  requestCategories: RequestCategory[];
  riskLevel: RiskLevel;
  contextStatus: ContextStatus;
  riskScore: number;
  summary: string;
  recommendations: string[];
  reviewStatus: ReviewStatus;
  analysisVersion: string;
  isDemo: boolean;
  createdAt: string;
  findings: FindingDraft[];
};

export async function insertAnalysis(db: D1Database, analysis: NewAnalysis): Promise<void> {
  const insert = db
    .prepare(
      `INSERT INTO email_analyses (
        id, original_filename, message_id, received_at, imported_at, from_address, from_display_name, sender_domain,
        reply_to_addresses, to_addresses, cc_addresses, subject, body_html_present, observed_source_ips, authentication_results,
        vendor_id, vendor_match_status, request_categories, risk_level, context_status, risk_score, summary, recommendations,
        review_status, analysis_version, is_demo, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      analysis.id,
      analysis.originalFilename,
      analysis.messageId,
      analysis.receivedAt,
      analysis.importedAt,
      analysis.fromAddress,
      analysis.fromDisplayName,
      analysis.senderDomain,
      JSON.stringify(analysis.replyToAddresses),
      JSON.stringify(analysis.toAddresses),
      JSON.stringify(analysis.ccAddresses),
      analysis.subject,
      analysis.bodyHtmlPresent ? 1 : 0,
      JSON.stringify(analysis.observedSourceIps),
      JSON.stringify(analysis.authenticationResults),
      analysis.vendorId,
      analysis.vendorMatchStatus,
      JSON.stringify(analysis.requestCategories),
      analysis.riskLevel,
      analysis.contextStatus,
      analysis.riskScore,
      analysis.summary,
      JSON.stringify(analysis.recommendations),
      analysis.reviewStatus,
      analysis.analysisVersion,
      analysis.isDemo ? 1 : 0,
      analysis.createdAt,
    );
  const findingStatements = analysis.findings.map((finding) =>
    db
      .prepare(
        `INSERT INTO findings (id, analysis_id, rule_id, category, severity, title, evidence, explanation, recommendation, status, weight, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        analysis.id,
        finding.ruleId,
        finding.category,
        finding.severity,
        finding.title,
        finding.evidence,
        finding.explanation,
        finding.recommendation,
        finding.status,
        finding.weight,
        analysis.createdAt,
      ),
  );
  try {
    await db.batch([insert, ...findingStatements]);
  } catch (error) {
    await db.prepare(`DELETE FROM findings WHERE analysis_id = ?`).bind(analysis.id).run();
    await db.prepare(`DELETE FROM email_analyses WHERE id = ?`).bind(analysis.id).run();
    throw error;
  }
}

export async function getAnalysis(db: D1Database, id: string): Promise<AnalysisDetail | null> {
  const row = await db
    .prepare(
      `SELECT a.id, a.original_filename, a.message_id, a.received_at, a.imported_at, a.from_address, a.from_display_name,
              a.sender_domain, a.reply_to_addresses, a.to_addresses, a.cc_addresses, a.subject, a.body_html_present,
              a.observed_source_ips, a.authentication_results, a.vendor_id, a.vendor_match_status, a.request_categories,
              a.risk_level, a.context_status, a.risk_score, a.summary, a.recommendations, a.review_status, a.analysis_version,
              a.is_demo, a.created_at, v.display_name AS vendor_name
       FROM email_analyses a LEFT JOIN vendors v ON v.id = a.vendor_id WHERE a.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return null;
  const [findingResult, reviewResult, baselineResult] = await db.batch([
    db.prepare(
      `SELECT id, rule_id, category, severity, title, evidence, explanation, recommendation, status, weight, created_at
       FROM findings WHERE analysis_id = ? ORDER BY weight DESC, title`,
    ).bind(id),
    db.prepare(
      `SELECT id, previous_status, new_status, note, created_at FROM review_events WHERE analysis_id = ? ORDER BY created_at ASC`,
    ).bind(id),
    db.prepare(`SELECT id FROM vendor_observations WHERE analysis_id = ?`).bind(id),
  ]);
  const summary = mapSummary(row);
  const requestCategories = parseJsonArray(row.request_categories) as RequestCategory[];
  const inBaseline = asRows(baselineResult).length > 0;
  return {
    ...summary,
    requestCategories,
    messageId: text(row, "message_id"),
    receivedAt: text(row, "received_at"),
    importedAt: text(row, "imported_at") ?? summary.createdAt,
    senderDomain: text(row, "sender_domain"),
    replyToAddresses: parseJsonArray(row.reply_to_addresses),
    toAddresses: parseJsonArray(row.to_addresses),
    ccAddresses: parseJsonArray(row.cc_addresses),
    bodyHtmlPresent: flag(row, "body_html_present"),
    observedSourceIps: parseJsonArray(row.observed_source_ips),
    authenticationResults: authFromJson(row.authentication_results),
    summary: requiredText(row, "summary"),
    recommendations: parseJsonArray(row.recommendations),
    analysisVersion: requiredText(row, "analysis_version"),
    findings: asRows(findingResult).map(mapFinding),
    reviewHistory: asRows(reviewResult).map(mapReview),
    historyEligibility: assessHistoryEligibility({
      vendorMatchStatus: summary.vendorMatchStatus,
      vendorId: summary.vendorId,
      reviewStatus: summary.reviewStatus,
      requestCategories,
      inBaseline,
    }),
  };
}

export async function listAnalyses(
  db: D1Database,
  query: { limit: number; offset: number; riskLevel: RiskLevel | null; reviewStatus: ReviewStatus | null; q: string | null },
): Promise<AnalysisListResponse> {
  const clauses: string[] = [];
  const binds: unknown[] = [];
  if (query.riskLevel) {
    clauses.push("a.risk_level = ?");
    binds.push(query.riskLevel);
  }
  if (query.reviewStatus) {
    clauses.push("a.review_status = ?");
    binds.push(query.reviewStatus);
  }
  if (query.q) {
    clauses.push("(a.subject LIKE ? ESCAPE '\\' OR a.from_address LIKE ? ESCAPE '\\' OR a.original_filename LIKE ? ESCAPE '\\')");
    binds.push(query.q, query.q, query.q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM email_analyses a ${where}`)
    .bind(...binds)
    .first<{ total: number }>();
  const rows = await db
    .prepare(
      `SELECT ${SUMMARY_SELECT} FROM email_analyses a LEFT JOIN vendors v ON v.id = a.vendor_id
       ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...binds, query.limit, query.offset)
    .all();
  return {
    items: asRows(rows).map((row) => mapSummary(row)),
    total: countRow?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function updateReviewStatus(
  db: D1Database,
  id: string,
  status: ReviewStatus,
  note: string | null,
): Promise<boolean> {
  const current = await db.prepare(`SELECT review_status FROM email_analyses WHERE id = ?`).bind(id).first<{ review_status: ReviewStatus }>();
  if (!current) return false;
  if (current.review_status === status && !note) return true;
  const timestamp = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(`UPDATE email_analyses SET review_status = ? WHERE id = ?`).bind(status, id),
      db
        .prepare(`INSERT INTO review_events (id, analysis_id, previous_status, new_status, note, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), id, current.review_status, status, note, timestamp),
    ]);
  } catch (error) {
    await db.prepare(`UPDATE email_analyses SET review_status = ? WHERE id = ?`).bind(current.review_status, id).run();
    throw error;
  }
  return true;
}

export async function dashboard(db: D1Database): Promise<DashboardResponse> {
  const counts = await db
    .prepare(
      `SELECT COUNT(*) AS total_analyzed,
              COALESCE(SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END), 0) AS high_risk,
              COALESCE(SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END), 0) AS medium_risk,
              COALESCE(SUM(CASE WHEN review_status IN ('unreviewed', 'needs_verification') THEN 1 ELSE 0 END), 0) AS needs_review
       FROM email_analyses`,
    )
    .first<Record<string, number>>();
  const vendors = await db.prepare(`SELECT COUNT(*) AS vendors_tracked FROM vendors`).first<{ vendors_tracked: number }>();
  const [recent, highPriority] = await db.batch([
    db.prepare(
      `SELECT ${SUMMARY_SELECT} FROM email_analyses a LEFT JOIN vendors v ON v.id = a.vendor_id ORDER BY a.created_at DESC LIMIT 8`,
    ),
    db.prepare(
      `SELECT ${SUMMARY_SELECT} FROM email_analyses a LEFT JOIN vendors v ON v.id = a.vendor_id WHERE a.risk_level = 'high' ORDER BY a.created_at DESC LIMIT 5`,
    ),
  ]);
  return {
    counts: {
      totalAnalyzed: counts?.total_analyzed ?? 0,
      highRisk: counts?.high_risk ?? 0,
      mediumRisk: counts?.medium_risk ?? 0,
      needsReview: counts?.needs_review ?? 0,
      vendorsTracked: vendors?.vendors_tracked ?? 0,
    },
    recent: asRows(recent).map((row) => mapSummary(row)),
    highPriority: asRows(highPriority).map((row) => mapSummary(row)),
  };
}

export function mapSummary(row: Record<string, unknown>): AnalysisSummary {
  return {
    id: requiredText(row, "id"),
    originalFilename: requiredText(row, "original_filename"),
    subject: text(row, "subject"),
    fromAddress: text(row, "from_address"),
    fromDisplayName: text(row, "from_display_name"),
    riskLevel: requiredText(row, "risk_level") as RiskLevel,
    riskScore: integer(row, "risk_score"),
    contextStatus: requiredText(row, "context_status") as ContextStatus,
    reviewStatus: requiredText(row, "review_status") as ReviewStatus,
    vendorMatchStatus: requiredText(row, "vendor_match_status") as MatchStatus,
    vendorId: text(row, "vendor_id"),
    vendorName: text(row, "vendor_name"),
    requestCategories: parseJsonArray(row.request_categories) as RequestCategory[],
    createdAt: requiredText(row, "created_at"),
    isDemo: flag(row, "is_demo"),
  };
}

function mapFinding(row: Record<string, unknown>): FindingResponse {
  const ruleId = requiredText(row, "rule_id");
  const rule = ruleById(ruleId);
  return {
    id: requiredText(row, "id"),
    ruleId,
    category: requiredText(row, "category"),
    severity: requiredText(row, "severity"),
    title: requiredText(row, "title"),
    evidence: requiredText(row, "evidence"),
    explanation: requiredText(row, "explanation"),
    recommendation: requiredText(row, "recommendation"),
    limitation: rule?.limitation ?? "This finding is limited to the evidence stored for the analysis.",
    status: requiredText(row, "status") as FindingResponse["status"],
    weight: integer(row, "weight"),
    createdAt: requiredText(row, "created_at"),
  };
}

function mapReview(row: Record<string, unknown>): ReviewEventResponse {
  return {
    id: requiredText(row, "id"),
    previousStatus: requiredText(row, "previous_status") as ReviewStatus,
    newStatus: requiredText(row, "new_status") as ReviewStatus,
    note: text(row, "note"),
    createdAt: requiredText(row, "created_at"),
  };
}
