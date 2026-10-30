import type { MatchStatus, VendorDirectoryEntry } from "../../shared/types";

export type MatchResult = {
  status: MatchStatus;
  matchedBy: "address" | "domain" | null;
  vendor: VendorDirectoryEntry | null;
};

export function matchVendor(
  fromAddress: string | null,
  senderDomain: string | null,
  vendors: VendorDirectoryEntry[],
): MatchResult {
  if (fromAddress) {
    const byAddress = vendors.filter((vendor) => vendor.senderAddresses.includes(fromAddress));
    if (byAddress.length === 1) return { status: "matched", matchedBy: "address", vendor: byAddress[0] ?? null };
    if (byAddress.length > 1) return { status: "ambiguous", matchedBy: null, vendor: null };
  }
  if (senderDomain) {
    const byDomain = vendors.filter(
      (vendor) => vendor.domains.includes(senderDomain) || vendor.canonicalDomain === senderDomain,
    );
    if (byDomain.length === 1) return { status: "matched", matchedBy: "domain", vendor: byDomain[0] ?? null };
    if (byDomain.length > 1) return { status: "ambiguous", matchedBy: null, vendor: null };
  }
  return { status: "unmatched", matchedBy: null, vendor: null };
}
