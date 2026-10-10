import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { RelayService, type RelayResult } from "./relay.js";

const MAX_BODY = 16 * 1024;

const REFUSAL_STATUS: Record<string, number> = {
  bad_request: 400,
  value_not_allowed: 400,
  gas_too_high: 400,
  deadline: 400,
  target_not_allowed: 403,
  bad_signature: 401,
  call_would_revert: 422,
  rate_limited: 429,
  daily_cap: 503,
  room_cap: 503,
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const statusOf = (r: RelayResult) => (r.status === "refused" ? (REFUSAL_STATUS[r.reason] ?? 400) : 200);

/**
 * POST /relay  { request: { from, to, value, gas, deadline, data, signature } }   integers as decimal strings
 * GET  /health
 */
export function createRelayServer(service: RelayService, opts: { allowedOrigin?: string } = {}): Server {
  // One origin, or a comma-separated list (local dev plus the deployed site). The request's own
  // origin is echoed back only when it is on the list; anything else gets no CORS headers at all.
  const allowed = (opts.allowedOrigin ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && allowed.includes(origin)) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
      res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
      res.setHeader("access-control-allow-headers", "content-type");
    }
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    try {
      if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
      if (req.method === "POST" && req.url === "/relay") {
        let body: unknown;
        try {
          body = await readJson(req);
        } catch (err) {
          return json(res, 400, { status: "refused", reason: "bad_request", detail: String(err) });
        }
        const parsed = RelayService.parse(body);
        if ("error" in parsed) return json(res, 400, { status: "refused", reason: "bad_request", detail: parsed.error });
        const result = await service.relay(parsed);
        return json(res, statusOf(result), result);
      }
      return json(res, 404, { error: "not found" });
    } catch (err) {
      // A failed chain read or send: say so, never report it as a refusal of the request.
      console.error("[relay]", err);
      return json(res, 502, { status: "error", reason: "upstream_failed" });
    }
  });
}
