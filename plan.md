# MailSentry --- Cloudflare-Native Product & Engineering Plan

> **Purpose:** A focused, deployable security portfolio MVP that helps
> accounts-payable teams investigate vendor emails that may redirect
> payments.
>
> **Implementation agent:** Cursor Agent. Treat this document as the
> authoritative specification.
>
> **Primary goal:** Build, test, and deploy a working application to
> Cloudflare using the Free plan only. Do not begin with a different
> stack and defer deployment.

------------------------------------------------------------------------

## 1. Product definition

### 1.1 Problem

Accounts-payable (AP) teams receive invoices, payment instructions, and
vendor account updates by email. Attackers may impersonate a vendor or
compromise a legitimate vendor mailbox and request that future payments
be sent to a different bank account.

SPF, DKIM, and DMARC results are useful evidence, but they do not prove
that a request is legitimate. A compromised vendor mailbox can pass
authentication. Historical context is particularly useful when a vendor
requests a bank-detail change that has never been seen before.

### 1.2 Product

MailSentry is a small, explainable email investigation tool. A user
uploads an `.eml` file. The application parses it, checks message
identity and content signals, compares it with an explicitly maintained
vendor baseline, and presents a risk assessment with evidence and next
steps.

MailSentry is decision support, not an email gateway. It does not
declare fraud with certainty, block mail, approve payments, or contact
vendors.

### 1.3 Target user and threat

-   Primary user: an AP employee who needs to decide whether a vendor
    payment-related email requires independent verification.
-   Focused threat: vendor impersonation or business email compromise
    intended to redirect a payment, especially via a bank-account change
    request.
-   Secondary workflow: maintain a small set of known vendor identities
    and review eligible historical observations.

### 1.4 In scope

-   `.eml` upload and bounded MIME parsing.
-   Sender, From/Reply-To, recipient, authentication-result, source-IP,
    link-host, and payment-request signals where the imported message
    contains usable evidence.
-   Deterministic, explainable rules and a 0--100 heuristic score.
-   Vendor matching and explicitly maintained historical baselines.
-   Analysis history, review status, vendor management, seeded synthetic
    examples, and a clear next-step recommendation.
-   Local development and Cloudflare deployment from the same TypeScript
    codebase.

### 1.5 Out of scope

Do not implement: - Gmail or Microsoft OAuth, live mailbox polling,
webhooks, automatic quarantine, email sending, payment approval, or
bank-detail changes. - Malware execution, attachment sandboxing,
antivirus, or broad enterprise phishing detection. - LLM calls, Workers
AI, model training, vector search, or opaque machine-learning scores. -
External reputation/geolocation lookups, URL fetching, DNS lookups, or
requests to domains found in the email. - Multiple customer tenants,
user invitations, role management, billing, SSO, or a generic
rule-builder. - Queues, Durable Objects, KV, R2, containers, or any
additional Cloudflare service unless explicitly required later. The MVP
uses only Workers, Workers Static Assets, and D1. - Claims that
authentication results were independently verified. The app only
interprets authentication results already present in the imported
message.

Keep the detection engine modular, but do not build future features now.

------------------------------------------------------------------------

## 2. Product principles

1.  **Analyze immediately:** run checks as soon as an upload is
    accepted.
2.  **Evidence before score:** every triggered finding states the
    observed evidence, its meaning, limitations, and a concrete next
    step.
3.  **Unusual does not mean malicious:** a first-time bank-change
    request must trigger verification guidance, not a definitive fraud
    verdict.
4.  **Authentication is not trust:** SPF/DKIM/DMARC pass results never
    cancel suspicious behavior.
5.  **Missing history is not safety:** show "insufficient context" when
    a baseline does not exist.
6.  **Deterministic MVP:** all findings and scores must be explainable
    and covered by tests.
7.  **Safe by default:** imported email is untrusted input. Never render
    raw HTML, follow links, load remote images, or fetch external
    resources.
8.  **Privacy by default:** do not retain raw `.eml` bytes or full email
    bodies. Persist only the normalized fields, minimal excerpts needed
    for evidence, findings, and review history.
9.  **No silent learning:** an email may enter a vendor baseline only
    after an explicit, guarded user action.
10. **Cloudflare Free only:** do not enable a paid plan, paid add-ons,
    or a paid third-party service. Never instruct Cursor to accept a
    billing upgrade.
11. **Real application, not a mockup:** every visible action must call a
    real API or be removed.
12. **Do not ask for clarification** for decisions specified here. For
    genuinely blocked account actions, finish all local work and tell
    the user the exact manual step needed.

------------------------------------------------------------------------

## 3. User journeys

### A. First visit and sign-in

1.  User opens the deployed URL.
2.  A sign-in screen asks for the single application password configured
    as a Cloudflare secret.
3.  Successful login creates an opaque, signed session in an HttpOnly
    cookie.
4.  Dashboard shows analysis counts, recent analyses, and tracked
    vendors.
5.  If the database is empty, show a clear empty state and a button to
    load synthetic demo data.

This is a single-user portfolio MVP, not a multi-user identity system.
Do not hardcode a password or session secret. Local development may use
`.dev.vars`, which must be ignored by Git.

### B. Analyze an email

1.  User opens **Analyze Email** and selects an `.eml` file.
2.  Browser submits it as `multipart/form-data` to `POST /api/analyses`.
3.  Worker validates session, content type, size, and extension; parser
    runs with strict MIME/size limits.
4.  Backend normalizes message fields, attempts vendor matching,
    evaluates applicable rules, calculates score, and persists the
    analysis and findings in D1.
5.  UI opens the result page showing risk level, score, evidence,
    missing context, and verification steps.
6.  Raw MIME and full body are discarded after analysis.

### C. Review an analysis

1.  User opens an analysis detail page.
2.  User can set `needs_verification` or `benign_after_review` and
    optionally add a short note.
3.  Every review change is recorded in a review-event table.
4.  Review status does not modify detection rules or automatically
    change vendor trust.

### D. Maintain a vendor baseline

1.  User creates or edits a vendor and known sender addresses/domains
    and internal recipients.
2.  Vendor detail shows baseline maturity and eligible observations.
3.  Only a message marked `benign_after_review` may be explicitly added
    to history, and only after confirmation.
4.  Bank-detail-change messages are not eligible for automatic baseline
    learning. A first-time bank-change request must never become
    "normal" merely because it was imported or reviewed casually.

### E. Unknown vendor or missing evidence

1.  Run all checks that can be supported by the message.
2.  Mark unavailable checks as `unknown` or `not_applicable`.
3.  Do not call the email safe because the sender is unknown or because
    authentication headers are absent.
4.  Recommend independent verification before acting on any bank-detail
    change.

### F. Demo reset

A Settings action can reset only records identified as seeded demo data.
It must not delete user-created vendors or imported analyses. Require a
confirmation dialog. Demo reset is disabled in production by default and
may only be enabled via an explicit environment variable/secret setting.

------------------------------------------------------------------------

## 4. Architecture and mandatory technology choices

### 4.1 Stack

-   **Language:** TypeScript throughout.
-   **Runtime/API:** Cloudflare Worker using the current stable
    `wrangler` tooling and supported Workers TypeScript APIs.
-   **Frontend:** React + TypeScript + Vite.
-   **Hosting:** Worker with Cloudflare Workers Static Assets serving
    the built frontend and routing `/api/*` to the same Worker.
-   **Database:** Cloudflare D1 (SQLite-compatible SQL) using a `DB`
    binding and committed SQL migrations.
-   **Email parser:** use a maintained MIME parser that runs in the
    Cloudflare Workers runtime, such as `postal-mime`, after verifying
    current package compatibility. Do not write an incomplete ad hoc
    MIME parser.
-   **Frontend routing:** React Router.
-   **API client:** small typed wrapper around `fetch`.
-   **Tests:** Vitest, React Testing Library, and
    `@cloudflare/vitest-pool-workers` (or the current official Worker
    test integration compatible with the selected Wrangler version). Use
    deterministic fixtures.
-   **Package manager:** npm.
-   **Deployment:** Wrangler CLI and `wrangler.jsonc`.
-   **No external runtime APIs.** All analysis must work without LLMs,
    paid APIs, or third-party reputation calls.

Do not create a separate Go backend, local SQLite file, Express server,
Docker requirement, or second deployable service. Local development uses
Wrangler's local Worker runtime and local D1 database.

### 4.2 Request flow

``` text
Browser (React/Vite build; served as Cloudflare Static Assets)
  |
  | same-origin HTTPS, JSON / multipart
  v
Cloudflare Worker
  |-- session/auth middleware
  |-- request validation and upload limits
  |-- MIME parser + field normalization
  |-- vendor matching + baseline lookup
  |-- deterministic detection engine
  |-- score aggregation + explanation
  |-- D1 repository / migrations
  |
  +-- JSON response to browser
```

### 4.3 Runtime constraints

The Free plan has a 10 ms Worker CPU-time limit per invocation and a
100,000-request/day allowance. D1 Free usage includes daily
row-read/write limits and an account storage limit. These are quota
limits, not a guarantee of unlimited free operation. Keep processing
bounded, query only needed rows, use indexes, and do not introduce a
feature that requires a paid plan. See official Cloudflare
documentation: [Workers
limits](https://developers.cloudflare.com/workers/platform/limits/) and
[Workers
pricing](https://developers.cloudflare.com/workers/platform/pricing/).

To keep parsing bounded: - Maximum `.eml` upload: **512 KiB**. - Maximum
extracted plain-text body considered by rules: **100 KiB**. - Maximum
MIME parts inspected: **30**. - Maximum MIME nesting depth: **8**. -
Maximum link candidates extracted: **100**. - Never fetch a link or
resolve DNS. - Return `413 UPLOAD_TOO_LARGE` for files over the
configured limit. - Return a safe parse error for malformed input; do
not crash the Worker. - Add a parser performance test/measurement and a
realistic production-build smoke test. If the parser exceeds the Free
CPU limit, simplify bounded parsing or change to a smaller compatible
parser; do not tell the user to upgrade.

Do not promise zero cost under all future conditions. The implementation
must stay within Free-plan features and avoid paid resources. If quotas
are exhausted, show a useful error and wait for the quota reset rather
than suggesting an automatic upgrade.

------------------------------------------------------------------------

## 5. Domain model

Use generated opaque IDs (`crypto.randomUUID()` where supported).
Persist UTC ISO timestamps. API JSON uses camelCase. SQL columns use
snake_case.

### 5.1 Analysis

Persist: - `id`, `originalFilename` (sanitized basename only),
`messageId` (optional/untrusted), `receivedAt` (parsed Date when valid),
`importedAt`. - `fromAddress`, `fromDisplayName`, `senderDomain`,
`replyToAddresses`, `toAddresses`, `ccAddresses`, `subject`. -
`bodyHtmlPresent` boolean; **never persist raw HTML or full body**. -
`observedSourceIps` and parsed `authenticationResults`, each with
source/provenance where possible. - `vendorId` nullable,
`vendorMatchStatus` (`matched`, `ambiguous`, `unmatched`). -
`requestCategories` (`invoice`, `bank_detail_change`, `payment_urgency`,
`other`). - `riskLevel` (`low`, `medium`, `high`,
`insufficient_context`), `riskScore` integer 0--100, `summary`,
`reviewStatus`. - `analysisVersion`, `isDemo`, and `createdAt`.

The raw message is parsed in memory and discarded. Do not store raw
MIME, full body text, complete URL query strings, or bank account
numbers.

### 5.2 Finding

-   `id`, `analysisId`, `ruleId`, `category`, `severity`, `title`.
-   `evidence` (short sanitized text), `explanation`, `recommendation`.
-   `status` (`triggered`, `not_triggered`, `unknown`,
    `not_applicable`).
-   `weight` for triggered rules, `createdAt`.

Persist triggered findings and important unknowns. Do not store
unnecessary duplicated data.

### 5.3 Vendor

-   `id`, `displayName`, `canonicalDomain` (optional).
-   Known sender addresses, sender domains, and internal recipient
    addresses stored in normalized child tables.
-   `firstSeenAt`, `lastSeenAt`, `historyEmailCount`, `baselineStatus`
    (`no_history`, `limited`, `established`), `createdAt`, `updatedAt`,
    `isDemo`.

### 5.4 Vendor observation

-   `id`, `vendorId`, `analysisId`, `observedAt`, `senderAddress`,
    `senderDomain`.
-   Recipient addresses, request categories, source IPs, hour of day,
    day of week, `isBankChangeRequest`, `baselineEligible`,
    `exclusionReason`.
-   An observation is created only through the explicit guarded history
    action. A bank-change request must not be added as a normal
    observation in the MVP.

### 5.5 Review event

-   `id`, `analysisId`, `previousStatus`, `newStatus`, optional `note`
    (maximum 500 characters), `createdAt`.

### 5.6 Demo marker

Use `is_demo` flags or a dedicated seed marker so demo reset can delete
only seeded demo rows. Preserve referential integrity and never broadly
truncate user data.

------------------------------------------------------------------------

## 6. Email ingestion and normalization

### 6.1 Input contract

-   Accept only `.eml` uploads up to 512 KiB.
-   Require a multipart field named `file`.
-   Validate the extension and basic content shape; do not trust the
    client-supplied MIME type alone.
-   Do not save the uploaded file to R2, D1, logs, or any other storage.
-   Never include the raw upload or body in error messages or logs.

### 6.2 Parsing requirements

Extract, when present: - From, Reply-To, To, Cc, Date, Subject,
Message-ID. - Authentication-Results and relevant received/header IP
evidence. - Plain-text body, or a text representation derived from HTML
using a safe parser that strips tags/scripts/styles. Do not use
`dangerouslySetInnerHTML`. - Link candidates and hostnames, without
opening or fetching them. - Indicators of bank-detail changes, payment
urgency, and instructions to bypass normal verification.

Normalize email addresses/domains conservatively. Do not infer a vendor
identity from display name alone. Treat Message-ID, display name,
authentication headers, and all email content as untrusted input.

### 6.3 Authentication evidence

The app interprets reported results in the imported headers. It must
distinguish: - Explicit pass. - Explicit fail/softfail/none. - Missing
or unparsable result. - Result source not confidently attributable.

Do not claim that MailSentry performed SPF, DKIM, or DMARC validation. A
user-supplied header can be forged; communicate that limitation in the
UI.

### 6.4 Parse failure behavior

Return a stable JSON error:

``` json
{
  "error": {
    "code": "INVALID_EMAIL",
    "message": "The uploaded file could not be parsed as an email."
  }
}
```

Use suitable status codes (`400`, `413`, `415`, `422`, `429`, `500`).
Never return stack traces, D1 errors, or secrets.

------------------------------------------------------------------------

## 7. Vendor matching and baseline

### 7.1 Matching

1.  Normalize the sender email and domain.
2.  Match exact known sender address first.
3.  If no address match, match exact known domain.
4.  If multiple vendor matches exist, return `ambiguous`; do not guess.
5.  Do not match by display name alone.
6.  If no match, set `unmatched` and run message-only checks.

### 7.2 Baseline maturity

-   `no_history`: no eligible observations.
-   `limited`: 1--4 eligible observations.
-   `established`: 5 or more eligible observations.

These thresholds describe available history, not statistical certainty.
With a limited baseline, phrase deviations cautiously.

### 7.3 Behavioral signals

Evaluate only signals supported by eligible observations: - First-time
bank-detail-change request for this vendor. - Sender address not present
in known sender identities. - Unfamiliar recipient. - New observed
source IP, when the header provides a usable IP. - Unusual request
category. - Unusual hour/day only if sufficient baseline observations
exist.

Do not implement generic volume anomaly detection or weekly traffic
forecasting. Do not call a time unusual if there is insufficient
history.

### 7.4 Baseline update policy

Never auto-learn from an imported email. The explicit **Add to vendor
history after verification** action is allowed only when: - The analysis
is matched to exactly one vendor. - Review status is
`benign_after_review`. - The analysis is not already in the baseline. -
The message is not a bank-detail-change request. - The user confirms the
action.

Reject invalid requests with `409` or `422`. Record the action. Editing
a vendor's known sender list is a separate explicit action and must not
silently rewrite historical observations.

------------------------------------------------------------------------

## 8. Deterministic detection engine

Implement the rules below as pure functions over normalized message data
and a read-only baseline snapshot. Keep rule IDs stable. Every finding
must state its evidence and limitations. Never rely on one signal alone.

### 8.1 Authentication

  ---------------------------------------------------------------------------
  Rule ID                  Condition                                   Weight
  ------------------------ --------------------- ----------------------------
  `AUTH_SPF_FAIL`          Reported SPF                                   +15
                           fail/softfail         

  `AUTH_DKIM_FAIL`         Reported DKIM fail                             +15

  `AUTH_DMARC_FAIL`        Reported DMARC fail                            +20

  `AUTH_RESULTS_MISSING`   No usable                 0; informational/unknown
                           authentication        
                           results               
  ---------------------------------------------------------------------------

These are reported-header indicators, not independent verification.

### 8.2 Sender identity and headers

  --------------------------------------------------------------------------------------
  Rule ID                          Condition                                      Weight
  -------------------------------- ------------------------ ----------------------------
  `REPLY_TO_MISMATCH`              Reply-To domain differs                           +15
                                   from From domain without 
                                   an explicit known reason 

  `UNKNOWN_SENDER_FOR_VENDOR`      Vendor matched, but                               +15
                                   exact sender address is  
                                   not known                

  `DISPLAY_NAME_DOMAIN_CONFLICT`   Display name suggests a                           +10
                                   known vendor but address 
                                   domain conflicts         

  `SENDER_DOMAIN_LOOKALIKE`        Deterministic                                     +10
                                   conservative heuristic   
                                   finds a visually         
                                   confusable domain in the 
                                   synthetic/known-vendor   
                                   context                  

  `SOURCE_IP_NEW`                  Usable source IP not           +5; only when baseline
                                   observed for the vendor                        exists
  --------------------------------------------------------------------------------------

Do not use a public suffix list download or external domain lookup at
runtime. If a reliable lookalike determination cannot be made locally,
do not trigger the rule.

### 8.3 Content and links

  ---------------------------------------------------------------------------
  Rule ID                  Condition                                   Weight
  ------------------------ --------------------- ----------------------------
  `BANK_CHANGE_REQUEST`    Content asks to                                +25
                           change/update         
                           bank/payment account  
                           details               

  `PAYMENT_URGENCY`        Payment-related                                +10
                           urgency/deadline      
                           language is detected  

  `BYPASS_VERIFICATION`    Message asks                                   +15
                           recipient to          
                           skip/circumvent       
                           normal verification   

  `SUSPICIOUS_LINK_HOST`   Extracted link host                            +15
                           conflicts with the    
                           claimed vendor or is  
                           a clearly unrelated   
                           host in context       

  `LINK_HOST_ONLY`         Link host was                     0; informational
                           extracted but cannot  
                           be confidently        
                           evaluated             
  ---------------------------------------------------------------------------

Use a documented phrase list and conservative matching. Keep it in
`src/worker/detection/phrases.ts`. Do not claim that a phrase classifier
understands all languages or intent. Do not fetch links, load remote
images, or render the original email HTML.

### 8.4 Behavioral

  -------------------------------------------------------------------------------
  Rule ID                      Condition                                   Weight
  ---------------------------- --------------------- ----------------------------
  `FIRST_BANK_CHANGE`          Bank-detail change                             +25
                               and vendor has no     
                               prior eligible        
                               bank-change           
                               observation or known  
                               verified change       
                               record                

  `UNUSUAL_REQUEST_CATEGORY`   Request category                               +10
                               differs from an       
                               established baseline  

  `UNUSUAL_RECIPIENT`          Recipient is not                               +10
                               known for the matched 
                               vendor                

  `UNUSUAL_SENDING_TIME`       Time is outside the                             +5
                               common range and      
                               baseline has at least 
                               5 observations        
  -------------------------------------------------------------------------------

A bank-change request with no prior history must be clearly surfaced
even if authentication results pass. The score is a prioritization
heuristic, **not a probability**.

### 8.5 Scoring

-   Add triggered rule weights; cap final score at 100.
-   `low`: 0--19.
-   `medium`: 20--39.
-   `high`: 40--100.
-   `insufficient_context` is a context flag, not a replacement for a
    risk level: retain the score and separately return `contextStatus`
    (`sufficient`, `limited`, `insufficient`). If the existing API field
    requires one `riskLevel`, use the score-derived level and include
    `contextStatus` independently.
-   If a bank-detail change is detected, the recommendation must always
    say to verify through a previously established, independent channel
    before updating payment records, even if score is low.
-   Never label a message "safe," "confirmed fraud," or "fraud
    probability 80%."
-   If authentication passes but a bank change is new, show both facts
    without allowing the pass to cancel the behavior finding.

### 8.6 Recommendations

Examples: - Bank-detail change: "Do not update payment details from this
email alone. Contact the vendor using a phone number or contact path
already on file---not contact information in this message." -
Authentication failure: "Verify the sender through a separate trusted
channel and ask the mail administrator to inspect the authentication
results." - Unknown vendor: "Confirm the vendor relationship and payment
request using an independently sourced contact." - Suspicious link: "Do
not open the link from this message; navigate using a known bookmark or
verified vendor portal."

------------------------------------------------------------------------

## 9. API contract

All routes are same-origin under `/api`. Require a valid session on
every route except `GET /api/health` and `POST /api/auth/login`. Use
JSON responses and stable error objects. Use parameterized D1 queries.

### Authentication

#### `POST /api/auth/login`

Request: `{ "password": "..." }` - Compare against secret
`MAILSENTRY_ACCESS_PASSWORD`. - On success, issue an opaque signed
session cookie using `MAILSENTRY_SESSION_SECRET`. - Cookie: `HttpOnly`,
`SameSite=Strict`, `Secure` in production, narrow path, short fixed
lifetime (12 hours). - Do not return the password or session token in
JSON. - Return generic `401` on failure. Do not reveal which credential
check failed.

#### `POST /api/auth/logout`

Clear the session cookie and return `{ "ok": true }`.

#### `GET /api/auth/session`

Return `{ "authenticated": true }` only for a valid session; otherwise
`401`.

Implement session signing and constant-time password comparison with Web
Crypto-compatible APIs. Do not use Node-only APIs or server filesystem
access in Worker runtime. Document that a single shared password is
appropriate only for this portfolio MVP.

### Core API

#### `GET /api/health`

Unauthenticated. Return `{ "status": "ok", "app": "mailsentry" }`. Do
not expose account IDs, secrets, D1 names, or detailed runtime metadata.

#### `GET /api/dashboard`

Return counts (`totalAnalyzed`, `highRisk`, `mediumRisk`, `needsReview`,
`vendorsTracked`) and recent analyses. Counts must come from D1, not
hardcoded frontend values.

#### `POST /api/analyses`

-   `multipart/form-data`, field `file`, `.eml` up to 512 KiB.
-   Validate authentication, content type, filename, size, parse result.
-   Run parse → normalize → match vendor → detection → score → persist
    analysis/findings.
-   Do not persist raw MIME or full body.
-   Return `201` with the analysis detail response.

#### `GET /api/analyses`

Query parameters: `limit` default 20/max 100; `offset` default 0;
optional `riskLevel`, `reviewStatus`, and `q` search. Validate all
values and use parameterized SQL. Return
`{ "items": [], "total": 0, "limit": 20, "offset": 0 }`.

#### `GET /api/analyses/:id`

Return normalized metadata, score, context status, findings,
recommendations, and review history. Never return raw email source.

#### `PATCH /api/analyses/:id/review`

Request: `{ "status": "needs_verification", "note": "optional" }`.
Allowed status values: `unreviewed`, `needs_verification`,
`benign_after_review`. Limit note to 500 characters. Update analysis and
create a review event transactionally (use D1 batch/transaction approach
supported by the selected API).

#### `POST /api/analyses/:id/add-to-vendor-history`

Require explicit user confirmation in request and all eligibility
conditions in Section 7.4. Return a clear conflict/validation error when
rejected. Must be idempotent.

#### `GET /api/vendors`

Return vendors and baseline summary.

#### `POST /api/vendors`

Create vendor with display name, optional canonical domain, known sender
addresses/domains, and internal recipients. Normalize and validate
input.

#### `GET /api/vendors/:id`

Return vendor details, baseline maturity, history summary, and recent
related analyses.

#### `PATCH /api/vendors/:id`

Edit display name, canonical domain, known sender identities/domains,
and recipients. Validate input and preserve historical observations.

#### `GET /api/vendors/:id/history`

Return eligible observations and baseline summary. Paginate if needed.

#### `GET /api/rules`

Return read-only rule catalogue with ID, title, category, severity,
description, weight, and limitation.

#### `POST /api/demo/seed`

Authenticated and disabled in production unless explicitly enabled. Seed
synthetic records only once. No real vendor names/domains or real email
addresses.

#### `POST /api/demo/reset`

Authenticated and disabled in production unless explicitly enabled.
Delete only seeded records. Require UI confirmation. Never delete
user-created records.

### API conventions

-   JSON fields are camelCase; SQL fields are snake_case.
-   Validate IDs, enums, lengths, pagination, and upload limits.
-   Use suitable HTTP status codes and stable error codes.
-   Never return stack traces, raw D1 errors, secrets, or full email
    bodies.
-   Add minimal structured logs with request ID, route, status, and
    duration; do not log message content, credentials, cookie values,
    full URLs, or extracted bank details.
-   Same-origin frontend/API deployment means no permissive wildcard
    CORS is needed.
-   Protect state-changing requests with session validation and
    same-site cookie policy. Reject cross-origin mutation requests by
    validating `Origin` against the deployed origin when present.
-   Handle D1 quota exhaustion with a safe generic service-unavailable
    response; do not expose internal SQL errors or advise upgrading.

------------------------------------------------------------------------

## 10. D1 schema and migrations

Use committed SQL migration files in `migrations/`. Apply them through
Wrangler locally and remotely. Never create tables opportunistically in
request handlers.

Required tables: - `vendors` - `vendor_sender_identities` -
`vendor_domains` - `vendor_internal_recipients` - `email_analyses` -
`findings` - `vendor_observations` - `review_events`

Schema requirements: - Primary keys use text UUIDs. - Foreign keys for
analysis/findings/vendor/observation/review relationships where
appropriate. - `is_demo` boolean/integer marker for seeded records. -
`email_analyses` indexes on `created_at`, `risk_level`, `review_status`,
`from_address`, and `vendor_id`. - `findings` index on `analysis_id`. -
`vendor_observations` indexes on `vendor_id` and `observed_at`. - Unique
constraint prevents duplicate inclusion of one analysis in a vendor
baseline. - Use SQL constraints for enumerated values where practical. -
Use prepared/bound parameters exclusively. - Use D1 `batch()` for
related writes when supported; if atomicity requirements exceed the
available API, implement a documented safe ordering and compensating
cleanup. Do not claim a multi-statement operation is atomic unless the
chosen D1 API guarantees it. - Add a migration version table or use
Wrangler's migration tracking. Keep migrations repeatable through
Wrangler's supported workflow. - Keep query patterns efficient; select
explicit columns rather than `SELECT *` where practical.

Do not store raw `.eml`, full message body, attachments, complete URL
query strings, passwords, or session tokens in D1.

------------------------------------------------------------------------

## 11. Frontend requirements

### 11.1 Design direction

Build a professional, terminal-inspired investigation workspace, not a
toy email client or a generic SOC dashboard. Use restrained typography,
compact tables, clear hierarchy, and accessible contrast. Visual polish
must not delay functional completeness.

### 11.2 Pages

1.  **Login** `/login`: password form, pending/error states, no
    credential persistence in local storage.
2.  **Dashboard** `/`: summary cards from API, recent analyses,
    high-priority items, clear empty state.
3.  **Analyze** `/analyze`: `.eml` picker, size/type validation,
    progress, understandable errors, privacy note.
4.  **Analysis detail** `/analyses/:id`: risk badge and score, context
    status, sender/recipient/subject metadata, findings with evidence
    and limitations, recommendations, review actions, review history.
5.  **Analyses** `/analyses`: paginated/filterable/searchable history
    with risk and review status.
6.  **Vendors** `/vendors`: vendor list, baseline maturity, create/edit
    vendor.
7.  **Vendor detail** `/vendors/:id`: known identities, baseline status,
    eligible observations, related analyses.
8.  **Rules** `/rules`: read-only rule catalogue and limitations.
9.  **Settings** `/settings`: privacy statement, demo seed/reset
    controls only when enabled, sign-out.

### 11.3 UI behavior

-   The backend is the only source of detection scores and findings.
    Never duplicate rules in the frontend.
-   No hardcoded metrics or fabricated analysis cards.
-   Every button must work, be disabled with an explanation, or be
    removed.
-   Handle loading, empty, invalid-input, unauthenticated, not-found,
    server, and quota-exceeded states.
-   Do not render raw email HTML. Show plain-text metadata and short
    sanitized evidence only.
-   Do not put uploaded email content in browser local storage,
    IndexedDB, analytics, or console logs.
-   Keep keyboard navigation and focus visible. Label form controls; do
    not rely on color alone to communicate risk.

------------------------------------------------------------------------

## 12. Synthetic demo dataset

Create clearly synthetic fixtures and seed them through the API. Use
reserved `.example` domains and documentation-only IP addresses. Do not
use actual vendor/customer data.

Required scenarios: 1. Ordinary invoice from a known vendor with
reported passing authentication and matching baseline. 2. First-time
bank-detail-change request from a known vendor with reported passing
authentication; must still recommend independent verification. 3.
Compromised-account-style message from a known sender with suspicious
content/recipient and reported passing authentication. 4. Suspicious
Reply-To mismatch. 5. Reported authentication failure. 6. Urgent payment
request with a suspicious unrelated link host. 7. Unknown vendor with
insufficient historical context. 8. Malformed email that produces a safe
parse error. 9. HTML email containing script tags, remote images, and
links; nothing executes or gets fetched. 10. Benign reviewed message
that may be eligible for baseline inclusion, provided it is not a
bank-change request.

Demo reset must not remove user-created data. Fixture descriptions must
say they are synthetic and are not proof of real-world detection
accuracy.

------------------------------------------------------------------------

## 13. Testing requirements

### Unit tests

-   Address/domain normalization and conservative vendor matching.
-   Authentication-result parsing, including absent, contradictory, and
    malformed headers.
-   MIME parsing of plain text, HTML-only, encoded headers, multipart,
    malformed content, and nested parts.
-   Upload limits, MIME part/depth limits, and safe failure behavior.
-   Every detection rule and scoring boundary.
-   Authentication pass never suppresses a bank-change finding.
-   First-time bank change is surfaced without history.
-   No-history behavior never implies safety.
-   Baseline eligibility and idempotency.
-   Sanitization of filenames, subjects, excerpts, and evidence.

### API/database tests

-   Login success/failure, session expiry/signature failure, logout, and
    protected endpoints.
-   Analysis upload, persistence, listing/filtering, detail, and invalid
    IDs.
-   Review changes create events.
-   Vendor create/edit and baseline behavior.
-   Reject unauthorized baseline inclusion and bank-change inclusion.
-   Demo seed/reset isolation.
-   D1 quota/error handling produces a safe response.
-   Verify raw `.eml` and full body are not persisted or logged.

Use the current Cloudflare Worker testing harness where possible.
Provide a deterministic local test command that does not require
deploying to Cloudflare. Tests must not require a paid account.

### Frontend tests

-   Login flow and unauthorized redirect.
-   Upload validation and API error display.
-   Findings and recommendations render correctly.
-   Review actions and vendor forms.
-   Empty/loading/error states.
-   No unsafe HTML rendering.

### End-to-end acceptance

Run all ten synthetic scenarios. Run type checking, linting if
configured, tests, and production build. Deploy only after these pass,
except when deployment itself is needed to identify an
environment-specific issue; if so, deploy only after local checks and
then rerun smoke tests.

------------------------------------------------------------------------

## 14. Security and privacy

-   Require application password authentication for all data routes and
    the UI.
-   Keep `MAILSENTRY_ACCESS_PASSWORD` and `MAILSENTRY_SESSION_SECRET` in
    Wrangler secrets in production. Never commit secrets. Never hardcode
    credentials.
-   For local development, use `.dev.vars` and add it to `.gitignore`.
-   Use HttpOnly, SameSite=Strict session cookies; set Secure in
    production; enforce a 12-hour expiry and verify signatures on every
    request.
-   Never store session tokens or credentials in local storage.
-   Set strict content security policy and security headers compatible
    with the Vite static build. At minimum set
    `X-Content-Type-Options: nosniff`, a restrictive `frame-ancestors`
    CSP, `Referrer-Policy: no-referrer`, and an appropriate
    `Permissions-Policy`.
-   Bound uploads, parsed text, MIME depth/parts, string lengths,
    pagination, and request body sizes.
-   Treat all headers, email content, filenames, addresses, and URLs as
    attacker-controlled.
-   Never execute/render raw HTML, fetch URLs, load remote images,
    resolve DNS, or call third-party services with email data.
-   Avoid logging email content, authentication headers, secrets,
    cookies, full links, or bank data.
-   Do not store raw email bytes, full bodies, attachments, or bank
    account numbers.
-   Use parameterized D1 statements and validate all inputs.
-   Same-origin API deployment; do not enable wildcard CORS.
-   Do not include real email samples, customer information, or
    credentials in fixtures or screenshots.
-   Clearly state in the UI and README that MailSentry is an educational
    decision-support tool, not a replacement for mail security controls
    or a company's payment-change verification policy.

------------------------------------------------------------------------

## 15. Repository structure

Use this structure. Do not create a second backend or separate frontend
deployment.

``` text
mailsentry/
├── plan.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc
├── .gitignore
├── .dev.vars.example
├── migrations/
│   └── 0001_initial.sql
├── scripts/
│   ├── check-cloudflare-config.mjs
│   └── smoke-test.mjs
├── src/
│   ├── client/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── analyses.ts
│   │   │   ├── vendors.ts
│   │   │   └── rules.ts
│   │   ├── components/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── RiskBadge.tsx
│   │   │   ├── FindingCard.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── ErrorMessage.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── AnalyzePage.tsx
│   │   │   ├── AnalysesPage.tsx
│   │   │   ├── AnalysisDetailPage.tsx
│   │   │   ├── VendorsPage.tsx
│   │   │   ├── VendorDetailPage.tsx
│   │   │   ├── RulesPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── types/
│   │   │   └── api.ts
│   │   └── utils/
│   │       ├── dates.ts
│   │       └── formatting.ts
│   ├── worker/
│   │   ├── index.ts
│   │   ├── env.ts
│   │   ├── router.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── errors.ts
│   │   │   └── security.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── health.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── analyses.ts
│   │   │   ├── vendors.ts
│   │   │   ├── rules.ts
│   │   │   └── demo.ts
│   │   ├── email/
│   │   │   ├── parse.ts
│   │   │   ├── normalize.ts
│   │   │   └── indicators.ts
│   │   ├── domain/
│   │   │   ├── analysis.ts
│   │   │   ├── finding.ts
│   │   │   ├── vendor.ts
│   │   │   └── review.ts
│   │   ├── detection/
│   │   │   ├── engine.ts
│   │   │   ├── rules.ts
│   │   │   ├── authentication.ts
│   │   │   ├── headers.ts
│   │   │   ├── content.ts
│   │   │   ├── behavior.ts
│   │   │   ├── score.ts
│   │   │   └── phrases.ts
│   │   ├── vendor/
│   │   │   ├── matching.ts
│   │   │   └── baseline.ts
│   │   ├── services/
│   │   │   ├── analyze.ts
│   │   │   ├── review.ts
│   │   │   ├── vendors.ts
│   │   │   └── demo.ts
│   │   └── db/
│   │       ├── analyses.ts
│   │       ├── vendors.ts
│   │       ├── observations.ts
│   │       └── reviews.ts
│   └── shared/
│       ├── constants.ts
│       └── schemas.ts
├── fixtures/
│   └── emails/
│       ├── normal_invoice.eml
│       ├── first_time_bank_change.eml
│       ├── compromised_vendor_style.eml
│       ├── suspicious_reply_to.eml
│       ├── auth_failure.eml
│       ├── urgent_payment_link.eml
│       ├── unknown_vendor.eml
│       ├── hostile_html.eml
│       └── malformed_email.eml
└── test/
    ├── worker/
    ├── detection/
    ├── email/
    └── client/
```

Responsibility boundaries: - Worker routes validate HTTP input and call
services. - Services orchestrate parse → match → detect → persist. -
Detection rules are pure functions and do not access D1 or HTTP. - DB
modules own D1 queries and return typed domain objects. - Frontend
renders API results and never recalculates risk. - Shared schemas define
validated request/response shapes without importing browser-only modules
into the Worker. - Keep abstractions small; do not introduce a framework
unless it materially simplifies routing or validation and is compatible
with Workers.

------------------------------------------------------------------------

## 16. Configuration and commands

### 16.1 `wrangler.jsonc`

Create a current-schema Wrangler configuration with: - A stable worker
name such as `mailsentry`. - `main` pointing to `src/worker/index.ts`. -
`compatibility_date` set to the date of implementation (current date),
not an invented future date. - Static assets pointing to the Vite
production output directory `dist`, with Worker handling `/api/*` and
SPA fallback configured according to current Cloudflare Static Assets
documentation. - D1 binding name `DB`. - D1 database ID placeholder
initially; do not invent an ID. After creating the remote D1 database,
update the config with the actual ID. - Local D1 migrations directory
`migrations/`. - Do not configure Workers AI, Durable Objects, KV, R2,
Queues, Analytics Engine, paid services, or a paid plan.

Use the current Wrangler config format documented by Cloudflare. Do not
rely on deprecated Pages-specific commands.

### 16.2 Environment variables and secrets

Create `.dev.vars.example`:

``` dotenv
MAILSENTRY_ACCESS_PASSWORD=replace-with-a-long-local-development-password
MAILSENTRY_SESSION_SECRET=replace-with-at-least-32-random-bytes
MAILSENTRY_ENABLE_DEMO_RESET=true
```

Production secrets are configured with Wrangler secret commands: -
`MAILSENTRY_ACCESS_PASSWORD` - `MAILSENTRY_SESSION_SECRET`

Non-secret flags may be defined in Wrangler vars: -
`MAILSENTRY_ENABLE_DEMO_RESET` defaults to `false` in production. -
`APP_ENV` (`development` or `production`).

Do not commit `.dev.vars`, `.env`, tokens, generated private keys, or
real data. Do not print secrets in logs or final reports.

### 16.3 Required npm scripts

Provide scripts: - `dev`: run Vite + Wrangler local Worker in a
documented supported arrangement. - `dev:client`: Vite frontend only, if
needed. - `dev:worker`: Wrangler local runtime. - `typecheck` - `lint`
(only if configured properly) - `test` - `test:worker` - `test:client` -
`build` - `deploy` - `db:migrate:local` - `db:migrate:remote` -
`cf:whoami` or documented equivalent.

Use a same-origin local proxy or Wrangler's supported asset/dev
arrangement so browser API calls use `/api`, not hardcoded production
URLs. Keep local and production routing behavior as similar as
practical.

### 16.4 README must include

1.  Product and scope.
2.  Prerequisites: Node.js LTS/npm, Git, and a Cloudflare account for
    deployment.
3.  Exact local install/run/test/build commands.
4.  How to configure `.dev.vars` locally.
5.  How to create the D1 database, update the real database ID, apply
    migrations, set secrets, and deploy.
6.  How to confirm the deployed Worker identity and URL.
7.  How to run the smoke test.
8.  Free-plan constraints and how quota exhaustion appears.
9.  Privacy/security limits and synthetic data warning.
10. Explicit statement that live mailbox monitoring is not implemented.

------------------------------------------------------------------------

## 17. Deployment workflow --- Free plan only

Cursor must implement the code and prepare deployment, but it cannot
assume the user is authenticated or invent Cloudflare account/resource
identifiers. It must never accept or initiate a paid-plan upgrade.

### 17.1 Local build and verification first

Run, fix, and report: 1. `npm install` 2. `npm run typecheck` 3.
`npm test` 4. `npm run build` 5. Wrangler local dev and D1 migration
checks. 6. Smoke test health, login, upload, analysis detail, and
logout.

Do not deploy if core tests/build fail.

### 17.2 Cloudflare account and database

If the user has not authenticated, tell them to run:

``` bash
npx wrangler login
npx wrangler whoami
```

Create the D1 database only if it does not already exist:

``` bash
npx wrangler d1 create mailsentry-db
```

Use the actual `database_id` returned by Wrangler in `wrangler.jsonc`.
Never fabricate the ID. Do not create duplicate databases if an existing
one can be safely reused.

Apply the migration:

``` bash
npx wrangler d1 migrations apply mailsentry-db --remote
```

Set production secrets interactively:

``` bash
npx wrangler secret put MAILSENTRY_ACCESS_PASSWORD
npx wrangler secret put MAILSENTRY_SESSION_SECRET
```

Generate a strong session secret locally using a cryptographically
secure generator; do not put it in source control or include it in
Cursor's final response. Set a strong application password and keep it
privately.

### 17.3 Deploy and verify

After confirming the Free plan and passing local checks:

``` bash
npm run deploy
```

Use the actual URL returned by Wrangler. Then run a smoke test against
that URL: - `/api/health` returns the expected status. - Unauthenticated
API requests are rejected. - Login works. - A synthetic `.eml` can be
analyzed and appears in history. - A first-time bank-change fixture
triggers the required recommendation. - Logout invalidates the
session. - Frontend refresh/deep links work. - No raw email body is
stored or logged.

If deployment fails because login, account authorization, or a manual
dashboard action is required, stop and provide the exact command/action.
Do not pretend deployment succeeded.

### 17.4 Cost safeguards

-   Stay on Cloudflare Workers Free plan.
-   Use only Workers, Static Assets, and D1.
-   Do not add paid add-ons or upgrade plans.
-   Do not use a custom domain that requires a purchase; the
    `workers.dev` URL is sufficient for the MVP.
-   Do not enable a paid service or external API.
-   D1/Workers free quotas may be exhausted; handle quota errors safely.
    Never claim the service is guaranteed to remain free regardless of
    future use.
-   Do not put credit card information into any workflow or accept an
    upgrade prompt.

------------------------------------------------------------------------

## 18. Implementation sequence

Work in this order, but continue through all phases without waiting for
approval unless a real external authorization is required.

### Phase 1 --- Scaffold and deployment configuration

Create the React/Vite client, Worker entrypoint, typed environment
bindings, Wrangler config, package scripts, shared schemas, and README
skeleton. Ensure `wrangler dev` starts and `/api/health` works.

### Phase 2 --- D1 and domain

Create SQL migration, typed domain objects, D1 repository functions,
indexes, and local D1 migration/test setup. Verify no handler creates
tables dynamically.

### Phase 3 --- Parser

Add bounded Worker-compatible MIME parser, normalization, link-host
extraction without fetching, and synthetic `.eml` fixtures. Test
malformed and hostile input.

### Phase 4 --- Vendor matching/baseline

Implement deterministic matching, baseline maturity, explicit baseline
inclusion rules, and tests preventing baseline poisoning.

### Phase 5 --- Detection

Implement all documented rules, scoring, context status, explanations,
and recommendations. Test every rule and scoring boundary.

### Phase 6 --- Authentication/API

Implement signed session cookie, password login/logout, middleware, API
routes, D1 persistence, validation, stable errors, and API tests.

### Phase 7 --- Frontend

Implement all pages and connect every control to real endpoints. No mock
metrics, placeholder buttons, or frontend-side scoring.

### Phase 8 --- Hardening

Add security headers, privacy checks, bounded parser tests, quota error
handling, input sanitization, and checks that logs/database do not
contain raw email bodies or secrets.

### Phase 9 --- Validate and deploy

Run typecheck, tests, production build, and local smoke tests. Check
`wrangler deploy --dry-run`/current equivalent. If authenticated and all
prerequisites exist, deploy to Free-tier `workers.dev` and run live
smoke tests. If credentials or resource IDs are missing, stop only at
that precise step and tell the user what to do.

------------------------------------------------------------------------

## 19. Definition of done

The project is done only when: - The app runs locally with documented
commands. - Production frontend and API are deployed together to
Cloudflare Workers with Static Assets. - D1 schema is migrated and
actual resource IDs are used. - No paid plan or paid service is
enabled. - Login protects all non-health API routes. - A real `.eml`
upload produces a persisted analysis and findings. - First-time
bank-change requests are flagged even when reported authentication
passes. - Unknown vendors are assessed from available evidence and
marked as lacking context. - Findings explain evidence, limitations, and
next steps. - Review status and history persist. - Baseline changes
require the explicit eligibility checks. - Demo data is synthetic and
reset cannot delete user data. - No email content is executed; no links
are fetched; no third-party service receives email data. - Raw `.eml`
and full body text are not persisted or logged. - All visible controls
work; no fake data or placeholder actions remain. - Unit/API/frontend
tests pass; typecheck and production build pass. - The deployed
health/login/upload/history/logout smoke tests pass, or the final report
names the exact external blocker without claiming success. - README
documents local setup, deployment, Free-tier limits, privacy, and
product limitations.

------------------------------------------------------------------------

## 20. Cursor Agent execution prompt

After placing this file at the repository root as `plan.md`, send Cursor
Agent this prompt:

> Read `plan.md` in full and implement the complete MailSentry
> application exactly as specified. This is a Cloudflare-native
> TypeScript project; do not introduce Go, Express, a separate backend,
> local SQLite, Workers AI, Durable Objects, KV, R2, Queues, or paid
> services.
>
> Work through all implementation phases. Create the real Worker API,
> React frontend, D1 migration, authentication, bounded `.eml` parser,
> deterministic detection engine, vendor history, synthetic fixtures,
> tests, README, and Wrangler configuration. Do not stop after
> scaffolding, do not use mock API responses, do not leave TODOs or
> placeholder buttons, and do not ask questions answered by `plan.md`.
>
> First inspect the repository and available tooling. Preserve useful
> existing work, but align it with the specification. Run install,
> typecheck, tests, production build, and local smoke tests; fix
> failures rather than merely reporting them. Verify the current
> Cloudflare/Wrangler configuration format from installed tooling or
> official docs if uncertain.
>
> Do not invent Cloudflare resource IDs, assume login is complete,
> reveal secrets, or accept/trigger a paid-plan upgrade. If the account
> is already authenticated and the D1 resource can be created on the
> Free plan, configure migrations and deploy to the default
> `workers.dev` URL after local verification. Otherwise finish all local
> implementation, then provide the exact remaining command/action. Never
> claim a deployment succeeded unless the live smoke test passes.
>
> At completion, report implemented functionality, exact local commands,
> tests/build results, deployed URL if truly deployed, resource names
> (not secrets), Free-tier safeguards, and any remaining blocker. Be
> honest about failures and limitations.
