import type { AnalysisDetail, AnalysisListResponse, DashboardResponse, ReviewStatus } from "../../shared/types";
import { api } from "./client";

export function getDashboard(): Promise<DashboardResponse> {
  return api("/api/dashboard");
}

export function listAnalyses(query: URLSearchParams): Promise<AnalysisListResponse> {
  const suffix = query.toString();
  return api(`/api/analyses${suffix ? `?${suffix}` : ""}`);
}

export function getAnalysis(id: string): Promise<AnalysisDetail> {
  return api(`/api/analyses/${id}`);
}

export function uploadAnalysis(file: File): Promise<AnalysisDetail> {
  const body = new FormData();
  body.set("file", file);
  return api("/api/analyses", { method: "POST", body });
}

export function reviewAnalysis(id: string, status: ReviewStatus, note: string): Promise<AnalysisDetail> {
  return api(`/api/analyses/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify({ status, note: note || undefined }),
  });
}

export function addToHistory(id: string): Promise<{ ok: true; observationId: string; baselineStatus: string }> {
  return api(`/api/analyses/${id}/add-to-vendor-history`, {
    method: "POST",
    body: JSON.stringify({ confirm: true }),
  });
}
