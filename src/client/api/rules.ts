import type { RuleDefinition } from "../../shared/types";
import { api } from "./client";

export type RuleCatalogueItem = Pick<RuleDefinition, "id" | "title" | "category" | "severity" | "description" | "weight" | "limitation">;

export function listRules(): Promise<{ items: RuleCatalogueItem[] }> {
  return api("/api/rules");
}

export function demoStatus(): Promise<{ enabled: boolean }> {
  return api("/api/demo/status");
}

export function seedDemo(): Promise<{ vendors: number; analyses: number }> {
  return api("/api/demo/seed", { method: "POST" });
}

export function resetDemo(): Promise<{ vendors: number; analyses: number }> {
  return api("/api/demo/reset", { method: "POST", body: JSON.stringify({ confirm: true }) });
}
