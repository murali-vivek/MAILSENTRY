import type { AnalysisDetail } from "../../shared/types";

export function persistedAnalysisKeys(detail: AnalysisDetail): string[] {
  return Object.keys(detail);
}

export function containsRawBody(detail: AnalysisDetail, secretSentence: string): boolean {
  return JSON.stringify(detail).includes(secretSentence);
}
