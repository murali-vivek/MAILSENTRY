import type { Env } from "./env";
import { handleApi } from "./router";
import { applySecurityHeaders } from "./middleware/security";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    applySecurityHeaders(headers);
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
