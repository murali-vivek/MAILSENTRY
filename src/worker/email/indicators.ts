import { MAX_LINK_HOSTS } from "../../shared/constants";
import { unique } from "../../shared/sanitize";

const URL_PATTERN = /https?:\/\/[^\s<>"'()]+/gi;

export function extractLinkHosts(sources: string[]): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const match of source.match(URL_PATTERN) ?? []) {
      if (hosts.length >= MAX_LINK_HOSTS) return hosts;
      const cleaned = match.replace(/[),.;]+$/g, "");
      try {
        const url = new URL(cleaned);
        if (url.protocol !== "http:" && url.protocol !== "https:") continue;
        const host = url.hostname.toLowerCase().replace(/\.$/, "");
        if (!host || host.length > 253 || seen.has(host)) continue;
        seen.add(host);
        hosts.push(host);
      } catch {
        continue;
      }
    }
  }
  return unique(hosts);
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (full, digits: string) => {
      const code = Number(digits);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : full;
    });
}

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi;

export function extractSourceIps(headers: Array<{ key: string; value: string }>): string[] {
  const received = headers.filter((header) => header.key.toLowerCase() === "received").map((header) => header.value);
  const found: string[] = [];
  const seen = new Set<string>();
  for (const value of [...received].reverse()) {
    const ips = ipsIn(value);
    if (ips.length === 0) continue;
    for (const ip of ips) {
      if (seen.has(ip)) continue;
      seen.add(ip);
      found.push(ip);
      if (found.length >= 4) return found;
    }
    break;
  }
  return found;
}

function ipsIn(value: string): string[] {
  const matches = [...value.matchAll(IPV4), ...value.matchAll(IPV6)].map((match) => match[0] ?? "");
  return matches.filter((ip) => ip && ip !== "0.0.0.0" && ip !== "255.255.255.255");
}
