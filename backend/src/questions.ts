/**
 * Question drafting for hosts: "what is tonight about?" in, a list of ready-to-edit questions out.
 *
 * The model only ever proposes. Nothing here touches the chain; the host edits, removes and seals in
 * the browser, and sealing is the same `commitQuestions` call as hand-written questions. The upstream
 * is any OpenAI-compatible chat-completions endpoint (Venice, OpenAI, a local server), chosen by env.
 */

export interface DraftQuestion {
  text: string;
  options: string[];
}

export interface DraftRequest {
  /** What the event is about, in the host's words. */
  topic: string;
  /** How many questions to propose, 1..12. */
  count: number;
  /** Language for the questions, e.g. "English" or "Indonesian". */
  language: string;
}

export const MAX_TEXT = 140;
export const MAX_OPTION = 40;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MAX_COUNT = 12;
export const MAX_TOPIC = 400;

/** Produces the raw assistant text for a prompt. Injected so tests never call a network. */
export type Completer = (system: string, user: string) => Promise<string>;

export type ParseResult = { ok: true; value: DraftRequest } | { ok: false; error: string };

export function parseDraftRequest(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "body must be an object" };
  const b = body as Record<string, unknown>;
  const topic = typeof b.topic === "string" ? b.topic.trim() : "";
  if (!topic) return { ok: false, error: "topic is required" };
  if (topic.length > MAX_TOPIC) return { ok: false, error: `topic is longer than ${MAX_TOPIC} characters` };
  const count = b.count === undefined ? 5 : Number(b.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) return { ok: false, error: `count must be 1..${MAX_COUNT}` };
  const language = typeof b.language === "string" && b.language.trim() ? b.language.trim().slice(0, 40) : "English";
  return { ok: true, value: { topic, count, language } };
}

export const SYSTEM_PROMPT = [
  "You write questions for a live guessing game played at a community event.",
  "Everyone in the room answers each question from their phone before the host reveals the result.",
  "Questions must be about things that will be settled during or right after the event, so the host can set a result:",
  "a vote in the room, a count, a timing, who wins a round, what the speaker will say, what the crowd will pick.",
  "Never ask trivia with a fixed known answer; the fun is that nobody knows yet.",
  "Each question has 2 to 4 short options. Keep every question under 100 characters and every option under 30.",
  "No money, betting, gambling, crypto or wallet vocabulary anywhere.",
  'Reply with JSON only, no prose, in this exact shape: {"questions":[{"text":"...","options":["...","..."]}]}',
].join(" ");

export function userPrompt(req: DraftRequest): string {
  return `Event: ${req.topic}\nWrite ${req.count} questions in ${req.language}.`;
}

/** Pulls the first JSON object out of a reply that may be wrapped in a code fence or chatter. */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? (fenced[1] ?? "") : raw).trim();
  // An object or a bare array, whichever opens first.
  const starts = [candidate.indexOf("{"), candidate.indexOf("[")].filter((i) => i !== -1);
  if (starts.length === 0) throw new Error("no JSON in reply");
  const start = Math.min(...starts);
  const end = candidate.lastIndexOf(candidate[start] === "{" ? "}" : "]");
  if (end <= start) throw new Error("no JSON in reply");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Turns a reply into questions the contract will accept. Anything malformed is dropped rather than
 * fixed up: the host sees only clean suggestions, and an empty result is an error, not a blank list.
 */
export function normalise(raw: string, count: number): DraftQuestion[] {
  const parsed = extractJson(raw) as { questions?: unknown };
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : null;
  if (!items) throw new Error("reply has no questions array");
  const seen = new Set<string>();
  const out: DraftQuestion[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const q = item as Record<string, unknown>;
    const text = typeof q.text === "string" ? q.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "";
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    const rawOpts = Array.isArray(q.options) ? q.options : [];
    const options: string[] = [];
    for (const o of rawOpts) {
      if (typeof o !== "string") continue;
      const v = o.replace(/\s+/g, " ").trim().slice(0, MAX_OPTION);
      if (v && !options.some((x) => x.toLowerCase() === v.toLowerCase())) options.push(v);
      if (options.length === MAX_OPTIONS) break;
    }
    if (options.length < MIN_OPTIONS) continue;
    seen.add(key);
    out.push({ text, options });
    if (out.length === count) break;
  }
  if (out.length === 0) throw new Error("reply had no usable questions");
  return out;
}

export async function draftQuestions(req: DraftRequest, complete: Completer): Promise<DraftQuestion[]> {
  const raw = await complete(SYSTEM_PROMPT, userPrompt(req));
  return normalise(raw, req.count);
}

export interface UpstreamConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

/** OpenAI-compatible chat completions (Venice, OpenAI and most self-hosted servers speak this). */
export function openAiCompleter(cfg: UpstreamConfig, fetchFn: typeof fetch = fetch): Completer {
  return async (system, user) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30_000);
    try {
      const res = await fetchFn(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.8,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`upstream ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("upstream reply had no content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Reads the upstream from env; undefined when drafting is not configured (the UI then hides it). */
export function upstreamFromEnv(env: NodeJS.ProcessEnv = process.env): UpstreamConfig | undefined {
  const apiKey = env.AI_API_KEY;
  if (!apiKey) return undefined;
  return {
    baseUrl: env.AI_BASE_URL ?? "https://api.venice.ai/api/v1",
    apiKey,
    model: env.AI_MODEL ?? "llama-3.3-70b",
    timeoutMs: Number(env.AI_TIMEOUT_MS ?? 30_000),
  };
}
