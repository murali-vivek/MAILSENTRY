import PostalMime from "postal-mime";
import type { Address, Email } from "postal-mime";
import { MAX_BODY_CHARS, MAX_MIME_DEPTH, MAX_MIME_PARTS, MAX_UPLOAD_BYTES } from "../../shared/constants";
import { sanitizeText, unique } from "../../shared/sanitize";
import { parseEmailAddress } from "../../shared/schemas";
import { extractLinkHosts, extractSourceIps, htmlToText } from "./indicators";

export class EmailParseError extends Error {
  readonly code = "INVALID_EMAIL";
  constructor() {
    super("The uploaded file could not be parsed as an email.");
    this.name = "EmailParseError";
  }
}

export type ParsedEmail = {
  fromAddress: string | null;
  fromDisplayName: string | null;
  replyTo: string[];
  to: string[];
  cc: string[];
  subject: string | null;
  messageId: string | null;
  dateRaw: string | null;
  text: string;
  htmlPresent: boolean;
  linkHosts: string[];
  sourceIps: string[];
  authenticationHeaders: string[];
};

export async function parseEmailBytes(bytes: Uint8Array): Promise<ParsedEmail> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) throw new EmailParseError();
  const raw = new TextDecoder().decode(bytes);
  assertReadableEmail(raw);
  let email: Email;
  try {
    email = await PostalMime.parse(bytes, {
      maxNestingDepth: MAX_MIME_DEPTH,
      maxPartCount: MAX_MIME_PARTS,
    });
  } catch {
    throw new EmailParseError();
  }
  const text = boundedText(email);
  const html = email.html ?? "";
  const linkHosts = extractLinkHosts([email.text ?? "", html]);
  const headers = email.headers.map((header) => ({ key: header.key, value: header.value }));
  return {
    fromAddress: firstAddress(email.from),
    fromDisplayName: sanitizeText(firstName(email.from), 200) || null,
    replyTo: addressesOf(email.replyTo),
    to: addressesOf(email.to),
    cc: addressesOf(email.cc),
    subject: email.subject ? sanitizeText(email.subject, 300) || null : null,
    messageId: email.messageId ? sanitizeText(email.messageId, 200) || null : null,
    dateRaw: email.date ?? null,
    text,
    htmlPresent: html.trim().length > 0,
    linkHosts,
    sourceIps: extractSourceIps(headers),
    authenticationHeaders: headers
      .filter((header) => header.key === "authentication-results")
      .map((header) => header.value.slice(0, 2000)),
  };
}

function boundedText(email: Email): string {
  const plain = email.text?.trim() ? email.text : email.html ? htmlToText(email.html) : "";
  return plain.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_CHARS);
}

function assertReadableEmail(raw: string): void {
  const sample = raw.slice(0, 8192);
  if (!/^[\t ]*[\w-]+:\s+\S/m.test(sample)) throw new EmailParseError();
  const partCount = raw.match(/content-type\s*:/gi)?.length ?? 0;
  if (partCount > MAX_MIME_PARTS) throw new EmailParseError();
  if (multipartDepth(raw) > MAX_MIME_DEPTH) throw new EmailParseError();
}

function multipartDepth(raw: string): number {
  const lines = raw.split(/\r?\n/);
  const stack: string[] = [];
  let max = 0;
  let pending = false;
  for (const line of lines) {
    if (/^content-type:\s*multipart\//i.test(line)) {
      const boundary = line.match(/boundary="?([^";]+)"?/i);
      if (boundary?.[1]) {
        stack.push(boundary[1]);
        max = Math.max(max, stack.length);
      } else {
        pending = true;
      }
      continue;
    }
    if (pending) {
      const boundary = line.match(/boundary="?([^";]+)"?/i);
      if (boundary?.[1]) {
        stack.push(boundary[1]);
        max = Math.max(max, stack.length);
        pending = false;
      }
    }
    const close = line.match(/^--(.+?)--\s*$/);
    if (close?.[1] && stack[stack.length - 1] === close[1]) stack.pop();
  }
  return max;
}

function addressesOf(value: Address[] | undefined): string[] {
  if (!value) return [];
  return unique(value.flatMap((entry) => mailboxes(entry)).map((item) => item.address).flatMap((address) => {
    const parsed = parseEmailAddress(address);
    return parsed ? [parsed] : [];
  }));
}

function firstAddress(value: Address | undefined): string | null {
  return addressesOf(value ? [value] : undefined)[0] ?? null;
}

function firstName(value: Address | undefined): string {
  if (!value || value.group) return "";
  return value.name ?? "";
}

function mailboxes(value: Address): Array<{ address: string }> {
  if (value.group) return value.group;
  return value.address ? [{ address: value.address }] : [];
}
