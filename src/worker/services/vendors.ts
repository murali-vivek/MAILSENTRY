import type { VendorDetail, VendorInput, VendorSummary } from "../../shared/types";
import { ApiError } from "../middleware/errors";
import { getVendor, insertVendor, listVendors, updateVendor } from "../db/vendors";
import { listVendorHistory } from "../db/observations";

export async function createVendor(db: D1Database, input: VendorInput): Promise<VendorSummary> {
  return insertVendor(db, input, false);
}

export async function editVendor(db: D1Database, id: string, input: VendorInput): Promise<VendorSummary> {
  const vendor = await updateVendor(db, id, input);
  if (!vendor) throw new ApiError(404, "NOT_FOUND", "Vendor not found.");
  return vendor;
}

export async function vendorDetail(db: D1Database, id: string): Promise<VendorDetail> {
  const vendor = await getVendor(db, id);
  if (!vendor) throw new ApiError(404, "NOT_FOUND", "Vendor not found.");
  return vendor;
}

export async function vendorHistory(db: D1Database, id: string, limit: number, offset: number) {
  const vendor = await getVendor(db, id);
  if (!vendor) throw new ApiError(404, "NOT_FOUND", "Vendor not found.");
  const history = await listVendorHistory(db, id, limit, offset);
  return {
    vendorId: vendor.id,
    displayName: vendor.displayName,
    baselineStatus: vendor.baselineStatus,
    historyEmailCount: vendor.historyEmailCount,
    ...history,
    limit,
    offset,
  };
}

export async function allVendors(db: D1Database): Promise<VendorSummary[]> {
  return listVendors(db);
}
