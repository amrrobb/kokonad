import { describe, expect, it } from "vitest";
import { MAX_OPTION, MAX_TEXT, draftQuestions, normalise, openAiCompleter, parseDraftRequest, upstreamFromEnv, userPrompt } from "../../src/questions.js";

const good = JSON.stringify({
  questions: [
    { text: "Who wins the first round?", options: ["Table 1", "Table 2", "Table 3"] },
    { text: "How long will the opening talk run?", options: ["Under 10 min", "10 to 20 min", "Over 20 min"] },
  ],
});

describe("parseDraftRequest", () => {
  it("fills defaults and trims", () => {
    expect(parseDraftRequest({ topic: "  Jogja dev meetup  " })).toEqual({ ok: true, value: { topic: "Jogja dev meetup", count: 5, language: "English" } });
  });
  it("refuses an empty topic, a silly count, a non-object", () => {
    expect(parseDraftRequest({ topic: " " }).ok).toBe(false);
    expect(parseDraftRequest({ topic: "x", count: 0 }).ok).toBe(false);
    expect(parseDraftRequest({ topic: "x", count: 13 }).ok).toBe(false);
    expect(parseDraftRequest({ topic: "x", count: 2.5 }).ok).toBe(false);
    expect(parseDraftRequest("x").ok).toBe(false);
  });
  it("mentions the count and language in the prompt", () => {
    const p = parseDraftRequest({ topic: "Pub quiz", count: 3, language: "Indonesian" });
    if (!p.ok) throw new Error(p.error);
    expect(userPrompt(p.value)).toContain("Write 3 questions in Indonesian");
  });
});

describe("normalise", () => {
  it("accepts a clean reply", () => {
    expect(normalise(good, 5)).toHaveLength(2);
  });
  it("reads JSON out of a code fence and chatter", () => {
    expect(normalise("Sure! Here you go:\n```json\n" + good + "\n```\nEnjoy.", 5)).toHaveLength(2);
  });
  it("accepts a bare array", () => {
    expect(normalise(JSON.stringify([{ text: "A?", options: ["x", "y"] }]), 5)).toHaveLength(1);
  });
  it("drops items the contract or the screen could not take, and dedupes", () => {
    const raw = JSON.stringify({
      questions: [
        { text: "One option only", options: ["x"] },
        { text: "", options: ["x", "y"] },
        { text: "Dup?", options: ["x", "y"] },
        { text: "dup?", options: ["x", "y"] },
        { text: "Same options twice", options: ["x", "X", "y"] },
        { text: "Too many options", options: ["a", "b", "c", "d", "e", "f", "g"] },
        { text: "x".repeat(200), options: ["y".repeat(60), "z"] },
        "not an object",
      ],
    });
    const out = normalise(raw, 10);
    expect(out.map((q) => q.text)).toEqual(["Dup?", "Same options twice", "Too many options", "x".repeat(MAX_TEXT)]);
    expect(out[1]?.options).toEqual(["x", "y"]);
    expect(out[2]?.options).toHaveLength(6);
    expect(out[3]?.options[0]).toHaveLength(MAX_OPTION);
  });
  it("caps at the requested count", () => {
    expect(normalise(good, 1)).toHaveLength(1);
  });
  it("throws rather than returning an empty list", () => {
    expect(() => normalise("I cannot help with that.", 5)).toThrow();
    expect(() => normalise('{"questions":[]}', 5)).toThrow();
    expect(() => normalise('{"questions":[{"text":"A?","options":["x"]}]}', 5)).toThrow();
  });
});

describe("draftQuestions", () => {
  it("passes topic and count to the completer and normalises the reply", async () => {
    const seen: string[] = [];
    const out = await draftQuestions({ topic: "Board game night", count: 2, language: "English" }, async (system, user) => {
      seen.push(system, user);
      return good;
    });
    expect(out).toHaveLength(2);
    expect(seen[0]).toContain("JSON only");
    expect(seen[1]).toContain("Board game night");
  });
});

describe("openAiCompleter", () => {
  it("posts a chat completion with the bearer key and returns the content", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init! };
      return new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), { status: 200 });
    }) as typeof fetch;
    const complete = openAiCompleter({ baseUrl: "https://api.example.test/v1/", apiKey: "k", model: "m" }, fetchFn);
    expect(await complete("sys", "usr")).toBe("hello");
    expect(captured!.url).toBe("https://api.example.test/v1/chat/completions");
    expect((captured!.init.headers as Record<string, string>).authorization).toBe("Bearer k");
    const body = JSON.parse(String(captured!.init.body));
    expect(body.model).toBe("m");
    expect(body.messages).toEqual([{ role: "system", content: "sys" }, { role: "user", content: "usr" }]);
  });
  it("throws on a non-2xx upstream", async () => {
    const fetchFn = (async () => new Response("nope", { status: 401 })) as typeof fetch;
    await expect(openAiCompleter({ baseUrl: "u", apiKey: "k", model: "m" }, fetchFn)("s", "u")).rejects.toThrow("upstream 401");
  });
});

describe("upstreamFromEnv", () => {
  it("is off without a key and defaults to Venice with one", () => {
    expect(upstreamFromEnv({})).toBeUndefined();
    expect(upstreamFromEnv({ AI_API_KEY: "k" })).toMatchObject({ baseUrl: "https://api.venice.ai/api/v1", model: "llama-3.3-70b" });
  });
});
