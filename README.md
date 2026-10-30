# MailSentry

MailSentry helps an accounts-payable team investigate a vendor email that might redirect a payment. Upload an `.eml` file. The app parses it, compares it with vendors you maintain, and shows a heuristic score with the evidence and a next step.

It is decision support. It does not block mail, approve payments, change bank details, or contact vendors. Live mailbox monitoring is not implemented. Reported SPF, DKIM, and DMARC results are read from the file; MailSentry does not perform those checks itself.

The detection rules are deterministic. The 0–100 score is a prioritization heuristic, not a probability and not a fraud verdict.

## Prerequisites

- Node.js 22 LTS and npm
- Git
- A Cloudflare account on the Workers Free plan, only when you deploy

Local tests do not need a Cloudflare account.

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars
```

Replace both secrets in `.dev.vars` with long random values. `.dev.vars` is gitignored. `APP_ENV=development` keeps the session cookie usable on `http://127.0.0.1`. `MAILSENTRY_ENABLE_DEMO_RESET=true` shows the synthetic demo controls.

```bash
npm run db:migrate:local
npm run dev
```

The API runs at `http://127.0.0.1:8787`. The UI runs at `http://127.0.0.1:5173` and proxies `/api` to the Worker. Sign in with `MAILSENTRY_ACCESS_PASSWORD`.

Other commands:

```bash
npm run dev:worker
npm run dev:client
npm run typecheck
npm run lint
npm test
npm run test:worker
npm run test:client
npm run build
npm run check:cf
```

`npm test` runs unit, client, and Worker tests locally. It does not deploy.

Synthetic `.eml` files live in `fixtures/emails/`. They use reserved `.example` domains and documentation addresses. They are not proof of real-world detection accuracy.

## Deploy on the Workers Free plan

Use only Workers, static assets, and D1. Do not enable Workers AI, KV, R2, Durable Objects, Queues, or a paid add-on. The `workers.dev` hostname is enough; do not buy a domain for this MVP.

```bash
npx wrangler login
npx wrangler whoami
npx wrangler d1 create mailsentry-db
```

Copy the `database_id` from that command into `wrangler.jsonc`. Do not invent one. Then:

```bash
npx wrangler d1 migrations apply mailsentry-db --remote
npx wrangler secret put MAILSENTRY_ACCESS_PASSWORD
npx wrangler secret put MAILSENTRY_SESSION_SECRET
npm run deploy
```

Generate the session secret locally, for example `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, and do not commit it. Leave `MAILSENTRY_ENABLE_DEMO_RESET` false in production unless you explicitly want the demo controls on the public URL.

`npm run deploy` prints the `workers.dev` URL. Confirm the Worker with `npm run cf:whoami`.

Smoke-test that URL:

```bash
node scripts/smoke-test.mjs https://mailsentry.<account>.workers.dev
```

The script reads the password from `.dev.vars`. For a production password that differs, put the same value in `.dev.vars` only on the machine running the smoke test, or edit the script's variable source locally without committing it. The check covers health, anonymous rejection, login, a bank-change upload, history, logout, and the SPA shell.

## Free-plan limits

The Workers Free plan has a short CPU-time limit per request and a daily request allowance. D1 Free has daily row and storage limits. Those quotas can be exhausted. The API then returns `503 SERVICE_UNAVAILABLE` and asks you to wait for the quota reset. Do not treat the app as guaranteed to stay at zero cost under every future workload, and do not upgrade the plan from this project.

Uploads are limited to 512 KiB. Parsing stops at 30 MIME parts, depth 8, 100 KiB of text considered by the rules, and 100 link hosts. Links are never fetched.

## Privacy

Imported mail is untrusted. The UI does not render original HTML. The database stores normalized headers, short evidence, findings, and review history. It does not store the raw `.eml`, the full body, attachments, or bank account numbers. Vendor history changes only after an explicit confirmation, and a bank-detail change cannot be added to the baseline.

A single shared password is appropriate only for this portfolio MVP.
