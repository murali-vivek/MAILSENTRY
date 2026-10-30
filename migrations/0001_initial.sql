CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  canonical_domain TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  history_email_count INTEGER NOT NULL DEFAULT 0,
  baseline_status TEXT NOT NULL DEFAULT 'no_history' CHECK (baseline_status IN ('no_history', 'limited', 'established')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1))
);

CREATE TABLE vendor_sender_identities (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (vendor_id, address),
  FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
);

CREATE TABLE vendor_domains (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (vendor_id, domain),
  FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
);

CREATE TABLE vendor_internal_recipients (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (vendor_id, address),
  FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
);

CREATE TABLE email_analyses (
  id TEXT PRIMARY KEY,
  original_filename TEXT NOT NULL,
  message_id TEXT,
  received_at TEXT,
  imported_at TEXT NOT NULL,
  from_address TEXT,
  from_display_name TEXT,
  sender_domain TEXT,
  reply_to_addresses TEXT NOT NULL,
  to_addresses TEXT NOT NULL,
  cc_addresses TEXT NOT NULL,
  subject TEXT,
  body_html_present INTEGER NOT NULL CHECK (body_html_present IN (0, 1)),
  observed_source_ips TEXT NOT NULL,
  authentication_results TEXT NOT NULL,
  vendor_id TEXT,
  vendor_match_status TEXT NOT NULL CHECK (vendor_match_status IN ('matched', 'ambiguous', 'unmatched')),
  request_categories TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'insufficient_context')),
  context_status TEXT NOT NULL CHECK (context_status IN ('sufficient', 'limited', 'insufficient')),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  summary TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('unreviewed', 'needs_verification', 'benign_after_review')),
  analysis_version TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE SET NULL
);

CREATE INDEX idx_email_analyses_created_at ON email_analyses (created_at);
CREATE INDEX idx_email_analyses_risk_level ON email_analyses (risk_level);
CREATE INDEX idx_email_analyses_review_status ON email_analyses (review_status);
CREATE INDEX idx_email_analyses_from_address ON email_analyses (from_address);
CREATE INDEX idx_email_analyses_vendor_id ON email_analyses (vendor_id);

CREATE TABLE findings (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  evidence TEXT NOT NULL,
  explanation TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('triggered', 'not_triggered', 'unknown', 'not_applicable')),
  weight INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (analysis_id) REFERENCES email_analyses (id) ON DELETE CASCADE
);

CREATE INDEX idx_findings_analysis_id ON findings (analysis_id);

CREATE TABLE vendor_observations (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL UNIQUE,
  observed_at TEXT NOT NULL,
  sender_address TEXT,
  sender_domain TEXT,
  recipient_addresses TEXT NOT NULL,
  request_categories TEXT NOT NULL,
  source_ips TEXT NOT NULL,
  hour_of_day INTEGER,
  day_of_week INTEGER,
  is_bank_change_request INTEGER NOT NULL CHECK (is_bank_change_request IN (0, 1)),
  baseline_eligible INTEGER NOT NULL CHECK (baseline_eligible IN (0, 1)),
  exclusion_reason TEXT,
  created_at TEXT NOT NULL,
  CHECK (hour_of_day IS NULL OR (hour_of_day >= 0 AND hour_of_day <= 23)),
  CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
  FOREIGN KEY (analysis_id) REFERENCES email_analyses (id) ON DELETE CASCADE
);

CREATE INDEX idx_vendor_observations_vendor_id ON vendor_observations (vendor_id);
CREATE INDEX idx_vendor_observations_observed_at ON vendor_observations (observed_at);

CREATE TABLE review_events (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('unreviewed', 'needs_verification', 'benign_after_review')),
  new_status TEXT NOT NULL CHECK (new_status IN ('unreviewed', 'needs_verification', 'benign_after_review')),
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (analysis_id) REFERENCES email_analyses (id) ON DELETE CASCADE
);

CREATE INDEX idx_review_events_analysis_id ON review_events (analysis_id);
CREATE INDEX idx_vendor_sender_address ON vendor_sender_identities (address);
CREATE INDEX idx_vendor_domains_domain ON vendor_domains (domain);
