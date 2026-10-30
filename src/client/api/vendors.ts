import type { VendorDetail, VendorInput, VendorSummary } from "../../shared/types";
import { api } from "./client";

export function listVendors(): Promise<{ items: VendorSummary[] }> {
  return api("/api/vendors");
}

export function getVendor(id: string): Promise<VendorDetail> {
  return api(`/api/vendors/${id}`);
}

export function createVendor(input: VendorInput): Promise<VendorSummary> {
  return api("/api/vendors", { method: "POST", body: JSON.stringify(input) });
}

export function updateVendor(id: string, input: VendorInput): Promise<VendorSummary> {
  return api(`/api/vendors/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function vendorHistory(id: string): Promise<{
  items: VendorDetail["observations"];
  total: number;
  baselineStatus: string;
  historyEmailCount: number;
}> {
  return api(`/api/vendors/${id}/history`);
}
