import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import migration from "../../migrations/0001_initial.sql";

const statements = migration
  .split(/;\s*\n/)
  .map((statement) => statement.trim())
  .filter(Boolean)
  .map((statement) =>
    statement
      .replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ")
      .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS "),
  );

beforeEach(async () => {
  for (const statement of statements) await env.DB.prepare(statement).run();
  for (const table of [
    "review_events",
    "findings",
    "vendor_observations",
    "email_analyses",
    "vendor_sender_identities",
    "vendor_domains",
    "vendor_internal_recipients",
    "vendors",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});
