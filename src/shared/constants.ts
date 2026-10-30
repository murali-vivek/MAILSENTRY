export const ANALYSIS_VERSION = "2026-10-30.1";
export const MAX_UPLOAD_BYTES = 512 * 1024;
export const MAX_BODY_CHARS = 100 * 1024;
export const MAX_MIME_PARTS = 30;
export const MAX_MIME_DEPTH = 8;
export const MAX_LINK_HOSTS = 100;
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const MAX_NOTE_LENGTH = 500;
export const MAX_JSON_BODY_CHARS = 32_000;
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_OFFSET = 10_000;
export const COOKIE_NAME = "mailsentry_session";
export const MIN_PASSWORD_LENGTH = 12;
export const MIN_SECRET_LENGTH = 32;

export const REVIEW_STATUSES = [
  "unreviewed",
  "needs_verification",
  "benign_after_review",
] as const;

export const RISK_LEVELS = ["low", "medium", "high"] as const;

export const CONTEXT_STATUSES = ["sufficient", "limited", "insufficient"] as const;

export const MATCH_STATUSES = ["matched", "ambiguous", "unmatched"] as const;

export const REQUEST_CATEGORIES = [
  "invoice",
  "bank_detail_change",
  "payment_urgency",
  "other",
] as const;

export const BANK_CHANGE_RECOMMENDATION =
  "Do not update payment details from this email alone. Contact the vendor using a phone number or contact path already on file, not contact information in this message.";

export const INSUFFICIENT_CONTEXT_RECOMMENDATION =
  "Historical context is insufficient. Do not treat the score as a reason to act on a payment request.";
