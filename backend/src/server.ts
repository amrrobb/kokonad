import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { DripResult, DripService, TopUpResult } from "./drip.js";

const MAX_BODY = 4 * 1024;

const REFUSAL_STATUS: Record<string, number> = {
  bad_address: 400,
  bad_code: 400,
  unknown_room: 404,
  already_dripped: 409,
  in_flight: 409,
  rate_limited: 429,
  room_limit: 429,
  daily_cap: 503,
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (typeof parsed !== "object" || parsed === null) throw new Error("body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function statusOf(result: DripResult | TopUpResult): number {
  return result.status === "refused" ? (REFUSAL_STATUS[result.reason] ?? 400) : 200;
}

/**
 * POST /drip   { address, code }  one-time gas after sign-in
 * POST /topup  { code }           before a question opens
 * GET  /health
 */
export function createDripServer(service: DripService, opts: { allowedOrigin?: string } = {}): Server {
  return createServer(async (req, res) => {
    if (opts.allowedOrigin) {
      res.setHeader("access-control-allow-origin", opts.allowedOrigin);
      res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
      res.setHeader("access-control-allow-headers", "content-type");
    }
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    try {
      if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
      if (req.method === "POST" && (req.url === "/drip" || req.url === "/topup")) {
        let body: Record<string, unknown>;
        try {
          body = await readJson(req);
        } catch (err) {
          return json(res, 400, { status: "refused", reason: "bad_request", detail: String(err) });
        }
        const code = typeof body.code === "string" ? body.code : "";
        const result =
          req.url === "/drip"
            ? await service.drip(typeof body.address === "string" ? body.address : "", code)
            : await service.topUpRoom(code);
        return json(res, statusOf(result), result);
      }
      return json(res, 404, { error: "not found" });
    } catch (err) {
      // A failed chain read or send: say so, never report it as a refusal about the room.
      console.error("[drip]", err);
      return json(res, 502, { status: "error", reason: "upstream_failed" });
    }
  });
}
