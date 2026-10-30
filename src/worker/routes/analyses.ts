import { MAX_UPLOAD_BYTES } from "../../shared/constants";
import { isRiskLevel, isReviewStatus, isUuid, likeContains, parsePagination, parseReviewBody } from "../../shared/schemas";
import type { Env } from "../env";
import { confirmFlag, json, readJson } from "../http";
import { ApiError } from "../middleware/errors";
import { getAnalysis, listAnalyses } from "../db/analyses";
import { analyzeUpload } from "../services/analyze";
import { addToVendorHistory, reviewAnalysis } from "../services/review";

export async function createAnalysis(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA", "Upload the message as multipart form data.");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    throw new ApiError(413, "UPLOAD_TOO_LARGE", "The uploaded file is larger than 512 KiB.");
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "VALIDATION_ERROR", "Choose an .eml file in the file field.");
  const detail = await analyzeUpload(env.DB, file, false);
  return json(detail, 201);
}

export async function list(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parsePagination(url);
  if ("error" in page) throw new ApiError(400, "VALIDATION_ERROR", page.error);
  const risk = url.searchParams.get("riskLevel");
  const review = url.searchParams.get("reviewStatus");
  const q = url.searchParams.get("q");
  if (risk && !isRiskLevel(risk)) throw new ApiError(400, "VALIDATION_ERROR", "riskLevel is invalid.");
  if (review && !isReviewStatus(review)) throw new ApiError(400, "VALIDATION_ERROR", "reviewStatus is invalid.");
  if (q && q.length > 200) throw new ApiError(400, "VALIDATION_ERROR", "Search text is too long.");
  return json(
    await listAnalyses(env.DB, {
      ...page,
      riskLevel: risk && isRiskLevel(risk) ? risk : null,
      reviewStatus: review && isReviewStatus(review) ? review : null,
      q: q ? likeContains(q.trim()) : null,
    }),
  );
}

export async function detail(id: string, env: Env): Promise<Response> {
  requireId(id);
  const analysis = await getAnalysis(env.DB, id);
  if (!analysis) throw new ApiError(404, "NOT_FOUND", "Analysis not found.");
  return json(analysis);
}

export async function review(request: Request, id: string, env: Env): Promise<Response> {
  requireId(id);
  const parsed = parseReviewBody(await readJson(request));
  if ("error" in parsed) throw new ApiError(400, "VALIDATION_ERROR", parsed.error);
  return json(await reviewAnalysis(env.DB, id, parsed.status, parsed.note));
}

export async function addHistory(request: Request, id: string, env: Env): Promise<Response> {
  requireId(id);
  const body = await readJson(request);
  return json(await addToVendorHistory(env.DB, id, confirmFlag(body)));
}

function requireId(id: string): void {
  if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "The id is invalid.");
}
