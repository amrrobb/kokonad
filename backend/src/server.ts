import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { SlidingWindowLimiter } from "./rateLimit.js";
import { draftQuestions, parseDraftRequest, type Completer } from "./questions.js";
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

export interface ServerOptions {
  allowedOrigin?: string;
  /** Question drafting upstream. Absent: POST /questions answers 503 `ai_unavailable` and the UI hides the feature. */
  complete?: Completer;
  /** Drafting requests per client address per hour (each one is a paid model call). */
  draftsPerHour?: number;
}

/**
 * POST /relay      { request: { from, to, value, gas, deadline, data, signature } }   integers as decimal strings
 * POST /questions  { topic, count?, language? }  ->  { questions: [{ text, options }] }
 * GET  /health
 */
export function createRelayServer(service: RelayService, opts: ServerOptions = {}): Server {
  const drafts = new SlidingWindowLimiter(opts.draftsPerHour ?? 20, 60 * 60 * 1000);
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
      if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, drafting: !!opts.complete });
      if (req.method === "POST" && req.url === "/questions") {
        if (!opts.complete) return json(res, 503, { status: "refused", reason: "ai_unavailable" });
        let body: unknown;
        try {
          body = await readJson(req);
        } catch (err) {
          return json(res, 400, { status: "refused", reason: "bad_request", detail: String(err) });
        }
        const parsed = parseDraftRequest(body);
        if (!parsed.ok) return json(res, 400, { status: "refused", reason: "bad_request", detail: parsed.error });
        const client = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0]?.trim() ?? "unknown";
        if (!drafts.tryTake(client)) return json(res, 429, { status: "refused", reason: "rate_limited" });
        try {
          const questions = await draftQuestions(parsed.value, opts.complete);
          return json(res, 200, { status: "ok", questions });
        } catch (err) {
          console.error("[questions]", err);
          return json(res, 502, { status: "error", reason: "upstream_failed" });
        }
      }
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
