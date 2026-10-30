import { maturityForCount } from "../vendor/baseline";
import type { BaselineStatus } from "../../shared/types";

export function vendorStats(count: number, firstSeenAt: string | null, lastSeenAt: string | null, updatedAt: string): {
  historyEmailCount: number;
  baselineStatus: BaselineStatus;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  updatedAt: string;
} {
  return {
    historyEmailCount: count,
    baselineStatus: maturityForCount(count),
    firstSeenAt,
    lastSeenAt,
    updatedAt,
  };
}
