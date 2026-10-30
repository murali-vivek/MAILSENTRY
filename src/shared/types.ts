import {
  CONTEXT_STATUSES,
  MATCH_STATUSES,
  REQUEST_CATEGORIES,
  REVIEW_STATUSES,
  RISK_LEVELS,
} from "./constants";

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type ContextStatus = (typeof CONTEXT_STATUSES)[number];
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];
export type FindingStatus = "triggered" | "not_triggered" | "unknown" | "not_applicable";
export type BaselineStatus = "no_history" | "limited" | "established";
export type AuthMethodResult = "pass" | "fail" | "none" | "unknown" | "missing";

export type ParsedAuthentication = {
  spf: AuthMethodResult;
  dkim: AuthMethodResult;
  dmarc: AuthMethodResult;
  usable: boolean;
  sawHeader: boolean;
};

export type ContentSignals = {
  categories: RequestCategory[];
  bankPhrase: string | null;
  urgencyPhrase: string | null;
  bypassPhrase: string | null;
  invoicePhrase: string | null;
};

export type NormalizedMessage = {
  fromAddress: string | null;
  fromDisplayName: string | null;
  senderDomain: string | null;
  replyToAddresses: string[];
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  messageId: string | null;
  receivedAt: string | null;
  bodyText: string;
  bodyHtmlPresent: boolean;
  linkHosts: string[];
  observedSourceIps: string[];
  authentication: ParsedAuthentication;
  requestCategories: RequestCategory[];
};

export type VendorDirectoryEntry = {
  id: string;
  displayName: string;
  canonicalDomain: string | null;
  senderAddresses: string[];
  domains: string[];
  internalRecipients: string[];
};

export type ObservationSnapshot = {
  senderAddress: string | null;
  senderDomain: string | null;
  recipients: string[];
  categories: string[];
  sourceIps: string[];
  hourOfDay: number | null;
  dayOfWeek: number | null;
  isBankChangeRequest: boolean;
};

export type BaselineSnapshot = {
  matchStatus: MatchStatus;
  matchedBy: "address" | "domain" | null;
  vendor: VendorDirectoryEntry | null;
  maturity: BaselineStatus;
  observations: ObservationSnapshot[];
  directory: Array<{
    id: string;
    displayName: string;
    domains: string[];
  }>;
};

export type FindingDraft = {
  ruleId: string;
  category: string;
  severity: "info" | "low" | "medium" | "high";
  title: string;
  evidence: string;
  explanation: string;
  recommendation: string;
  limitation: string;
  status: FindingStatus;
  weight: number;
};

export type DetectionResult = {
  findings: FindingDraft[];
  persistedFindings: FindingDraft[];
  score: number;
  riskLevel: RiskLevel;
  contextStatus: ContextStatus;
  summary: string;
  recommendations: string[];
  requestCategories: RequestCategory[];
};

export type RuleDefinition = {
  id: string;
  title: string;
  category: string;
  severity: "info" | "low" | "medium" | "high";
  description: string;
  weight: number;
  limitation: string;
  explanation: string;
  recommendation: string;
};

export type HistoryEligibility = {
  eligible: boolean;
  inBaseline: boolean;
  reasons: string[];
};

export type FindingResponse = {
  id: string;
  ruleId: string;
  category: string;
  severity: string;
  title: string;
  evidence: string;
  explanation: string;
  recommendation: string;
  limitation: string;
  status: FindingStatus;
  weight: number;
  createdAt: string;
};

export type ReviewEventResponse = {
  id: string;
  previousStatus: ReviewStatus;
  newStatus: ReviewStatus;
  note: string | null;
  createdAt: string;
};

export type AnalysisSummary = {
  id: string;
  originalFilename: string;
  subject: string | null;
  fromAddress: string | null;
  fromDisplayName: string | null;
  riskLevel: RiskLevel;
  riskScore: number;
  contextStatus: ContextStatus;
  reviewStatus: ReviewStatus;
  vendorMatchStatus: MatchStatus;
  vendorId: string | null;
  vendorName: string | null;
  requestCategories: RequestCategory[];
  createdAt: string;
  isDemo: boolean;
};

export type AnalysisDetail = AnalysisSummary & {
  messageId: string | null;
  receivedAt: string | null;
  importedAt: string;
  senderDomain: string | null;
  replyToAddresses: string[];
  toAddresses: string[];
  ccAddresses: string[];
  bodyHtmlPresent: boolean;
  observedSourceIps: string[];
  authenticationResults: ParsedAuthentication;
  summary: string;
  recommendations: string[];
  analysisVersion: string;
  findings: FindingResponse[];
  reviewHistory: ReviewEventResponse[];
  historyEligibility: HistoryEligibility;
};

export type AnalysisListResponse = {
  items: AnalysisSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type DashboardResponse = {
  counts: {
    totalAnalyzed: number;
    highRisk: number;
    mediumRisk: number;
    needsReview: number;
    vendorsTracked: number;
  };
  recent: AnalysisSummary[];
  highPriority: AnalysisSummary[];
};

export type VendorSummary = {
  id: string;
  displayName: string;
  canonicalDomain: string | null;
  baselineStatus: BaselineStatus;
  historyEmailCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  senderAddresses: string[];
  domains: string[];
  internalRecipients: string[];
  createdAt: string;
  updatedAt: string;
  isDemo: boolean;
};

export type VendorObservation = {
  id: string;
  analysisId: string;
  observedAt: string;
  senderAddress: string | null;
  senderDomain: string | null;
  recipients: string[];
  categories: string[];
  sourceIps: string[];
  hourOfDay: number | null;
  dayOfWeek: number | null;
  isBankChangeRequest: boolean;
  baselineEligible: boolean;
};

export type VendorDetail = VendorSummary & {
  observations: VendorObservation[];
  recentAnalyses: AnalysisSummary[];
};

export type VendorInput = {
  displayName: string;
  canonicalDomain: string | null;
  senderAddresses: string[];
  domains: string[];
  internalRecipients: string[];
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};
