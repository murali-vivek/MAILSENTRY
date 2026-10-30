import type { NormalizedMessage, ParsedAuthentication } from "../../shared/types";
import { ApiError } from "../middleware/errors";
import { persistMessage } from "./analyze";
import { addToVendorHistory } from "./review";
import { deleteDemoData, demoVendorCount } from "../db/reviews";
import { insertVendor } from "../db/vendors";
import type { Env } from "../env";

const PASS: ParsedAuthentication = { spf: "pass", dkim: "pass", dmarc: "pass", usable: true, sawHeader: true };
const MISSING: ParsedAuthentication = { spf: "missing", dkim: "missing", dmarc: "missing", usable: false, sawHeader: false };
const FAIL: ParsedAuthentication = { spf: "fail", dkim: "fail", dmarc: "fail", usable: true, sawHeader: true };

export function demoEnabled(env: Env): boolean {
  return env.MAILSENTRY_ENABLE_DEMO_RESET === "true";
}

export function assertDemoEnabled(env: Env): void {
  if (!demoEnabled(env)) throw new ApiError(403, "DEMO_DISABLED", "Demo seed and reset are disabled.");
}

export async function seedDemo(db: D1Database): Promise<{ vendors: number; analyses: number }> {
  if ((await demoVendorCount(db)) > 0) {
    throw new ApiError(409, "DEMO_ALREADY_SEEDED", "Synthetic demo data is already loaded.");
  }
  await insertVendor(
    db,
    {
      displayName: "Northwind Supplies",
      canonicalDomain: "northwind.example",
      senderAddresses: ["billing@northwind.example"],
      domains: ["northwind.example"],
      internalRecipients: ["accounts@acme-pay.example"],
    },
    true,
  );
  await insertVendor(
    db,
    {
      displayName: "Contoso Parts",
      canonicalDomain: "contoso.example",
      senderAddresses: ["accounts@contoso.example"],
      domains: ["contoso.example"],
      internalRecipients: ["accounts@acme-pay.example"],
    },
    true,
  );

  for (let index = 0; index < 5; index += 1) {
    const day = 14 + index;
    const detail = await persistMessage(
      db,
      message({
        subject: `Invoice NW-10${index}`,
        messageId: `<baseline-${index}@northwind.example>`,
        receivedAt: `2024-10-${day}T15:00:00.000Z`,
        bodyText: "Please see the invoice. The amount due is listed in the statement of account.",
      }),
      `synthetic-baseline-${index}.eml`,
      { isDemo: true, reviewStatus: "benign_after_review" },
    );
    await addToVendorHistory(db, detail.id, true);
  }

  await persistMessage(db, message({
    subject: "Invoice NW-200",
    messageId: "<eligible@northwind.example>",
    bodyText: "Please see the invoice. The amount due is listed in the statement of account.",
  }), "synthetic-eligible-invoice.eml", { isDemo: true, reviewStatus: "benign_after_review" });

  await persistMessage(db, message({
    subject: "Updated bank details",
    messageId: "<bank@northwind.example>",
    bodyText: "Please update our bank details before the next payment cycle.",
  }), "synthetic-bank-change.eml", { isDemo: true, reviewStatus: "unreviewed" });

  await persistMessage(db, message({
    subject: "Payment today",
    messageId: "<rush@northwind.example>",
    toAddresses: ["outsider@external.example"],
    bodyText: "This payment is due today. Do not call the usual accounts team.",
  }), "synthetic-compromised-style.eml", { isDemo: true, reviewStatus: "needs_verification" });

  await persistMessage(db, message({
    subject: "Invoice copy",
    messageId: "<reply@northwind.example>",
    replyToAddresses: ["payments@other.example"],
    bodyText: "Please see the invoice. The amount due is listed in the statement of account.",
  }), "synthetic-reply-to.eml", { isDemo: true, reviewStatus: "unreviewed" });

  await persistMessage(db, message({
    subject: "Invoice NW-auth",
    messageId: "<auth@northwind.example>",
    authentication: FAIL,
    bodyText: "Please see the invoice. The amount due is listed in the statement of account.",
  }), "synthetic-auth-failure.eml", { isDemo: true, reviewStatus: "unreviewed" });

  await persistMessage(db, message({
    subject: "Payment link",
    messageId: "<link@northwind.example>",
    bodyText: "Payment is due today. Use the portal if you already know it.",
    linkHosts: ["pay-now.example"],
  }), "synthetic-urgent-link.eml", { isDemo: true, reviewStatus: "unreviewed" });

  await persistMessage(db, message({
    fromAddress: "ap@globex.example",
    fromDisplayName: "Globex Billing",
    senderDomain: "globex.example",
    subject: "Invoice GX-1",
    messageId: "<gx@globex.example>",
    authentication: MISSING,
    observedSourceIps: [],
    bodyText: "Please see the invoice. The amount due is listed in the statement of account.",
  }), "synthetic-unknown-vendor.eml", { isDemo: true, reviewStatus: "unreviewed" });

  await persistMessage(db, message({
    fromAddress: "billing@northw1nd.example",
    fromDisplayName: "Northwind Supplies",
    senderDomain: "northw1nd.example",
    subject: "Invoice for Northwind",
    messageId: "<lookalike@northw1nd.example>",
    authentication: MISSING,
    bodyText: "Please see the invoice. The amount due is listed in the statement of account.",
  }), "synthetic-lookalike.eml", { isDemo: true, reviewStatus: "unreviewed" });

  return { vendors: 2, analyses: 13 };
}

export async function resetDemo(db: D1Database, confirm: boolean): Promise<{ vendors: number; analyses: number }> {
  if (confirm !== true) throw new ApiError(422, "CONFIRMATION_REQUIRED", "Confirm demo reset before deleting seeded records.");
  return deleteDemoData(db);
}

function message(overrides: Partial<NormalizedMessage>): NormalizedMessage {
  return {
    fromAddress: "billing@northwind.example",
    fromDisplayName: "Northwind Supplies",
    senderDomain: "northwind.example",
    replyToAddresses: [],
    toAddresses: ["accounts@acme-pay.example"],
    ccAddresses: [],
    subject: "Invoice",
    messageId: null,
    receivedAt: "2024-10-15T15:00:00.000Z",
    bodyText: "Please see the invoice. The amount due is listed in the statement of account.",
    bodyHtmlPresent: false,
    linkHosts: [],
    observedSourceIps: ["192.0.2.10"],
    authentication: PASS,
    requestCategories: ["invoice"],
    ...overrides,
  };
}
