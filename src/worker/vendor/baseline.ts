import type { BaselineStatus, BaselineSnapshot, ObservationSnapshot, VendorDirectoryEntry } from "../../shared/types";

export function maturityForCount(count: number): BaselineStatus {
  if (count >= 5) return "established";
  if (count >= 1) return "limited";
  return "no_history";
}

export function buildBaseline(input: {
  matchStatus: BaselineSnapshot["matchStatus"];
  matchedBy: BaselineSnapshot["matchedBy"];
  vendor: VendorDirectoryEntry | null;
  observations: ObservationSnapshot[];
  directory: VendorDirectoryEntry[];
}): BaselineSnapshot {
  const eligible = input.observations.filter((observation) => !observation.isBankChangeRequest);
  return {
    matchStatus: input.matchStatus,
    matchedBy: input.matchedBy,
    vendor: input.vendor,
    maturity: input.matchStatus === "matched" ? maturityForCount(eligible.length) : "no_history",
    observations: input.matchStatus === "matched" ? eligible : [],
    directory: input.directory.map((vendor) => ({
      id: vendor.id,
      displayName: vendor.displayName,
      domains: vendor.domains,
    })),
  };
}
