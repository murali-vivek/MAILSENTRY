import { isUuid, parsePagination, parseVendorInput } from "../../shared/schemas";
import type { Env } from "../env";
import { json, readJson } from "../http";
import { ApiError } from "../middleware/errors";
import { allVendors, createVendor, editVendor, vendorDetail, vendorHistory } from "../services/vendors";

export async function list(env: Env): Promise<Response> {
  return json({ items: await allVendors(env.DB) });
}

export async function create(request: Request, env: Env): Promise<Response> {
  const parsed = parseVendorInput(await readJson(request));
  if ("error" in parsed) throw new ApiError(400, "VALIDATION_ERROR", parsed.error);
  return json(await createVendor(env.DB, parsed), 201);
}

export async function detail(id: string, env: Env): Promise<Response> {
  requireId(id);
  return json(await vendorDetail(env.DB, id));
}

export async function update(request: Request, id: string, env: Env): Promise<Response> {
  requireId(id);
  const parsed = parseVendorInput(await readJson(request));
  if ("error" in parsed) throw new ApiError(400, "VALIDATION_ERROR", parsed.error);
  return json(await editVendor(env.DB, id, parsed));
}

export async function history(request: Request, id: string, env: Env): Promise<Response> {
  requireId(id);
  const page = parsePagination(new URL(request.url));
  if ("error" in page) throw new ApiError(400, "VALIDATION_ERROR", page.error);
  return json(await vendorHistory(env.DB, id, page.limit, page.offset));
}

function requireId(id: string): void {
  if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "The id is invalid.");
}
