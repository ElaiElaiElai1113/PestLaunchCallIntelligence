import { afterEach, expect, it, vi } from "vitest";
import { GeminiProvider } from "@/lib/gemini/provider";
import {
  aiConfigured,
  createProvider,
  analysisModel,
} from "@/lib/server/ai-provider";
import { sampleCall } from "@/lib/samples/fixtures";
import { stagedFromAnalysis } from "../helpers/provider-wire";
afterEach(() => vi.unstubAllEnvs());
it("selects Gemini only with its own key and never falls back to Groq", () => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("GROQ_API_KEY", "fictional");
  expect(aiConfigured()).toBe(false);
  expect(analysisModel()).toBe("gemini-3.5-flash-lite");
  expect(createProvider()).toBeInstanceOf(GeminiProvider);
  vi.stubEnv("GEMINI_API_KEY", "fictional");
  expect(aiConfigured()).toBe(true);
});
it("uses Gemini transport/model with original evidence and source-bound provenance", async () => {
  const call = sampleCall("one-time", "gemini-fictional"),
    source = structuredClone(call.segments),
    wire = stagedFromAnalysis(call.originalAnalysis!);
  const bodies: Record<string, unknown>[] = [];
  const provider = new GeminiProvider({
    apiKey: "fictional",
    fetch: async (url, init) => {
      expect(String(url)).toBe(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      );
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      expect(body.model).toBe("gemini-3.5-flash-lite");
      expect(body.include_reasoning).toBeUndefined();
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(
                bodies.length === 1 ? wire.extraction : wire.scoring,
              ),
            },
          },
        ],
      });
    },
  });
  const result = await provider.analyze(call.segments, {
    transcriptComplete: true,
  });
  expect(bodies).toHaveLength(2);
  expect(call.segments).toEqual(source);
  expect(result.providerOutput.model).toBe("gemini-3.5-flash-lite");
  expect(result.original.purpose).toBe(call.originalAnalysis!.purpose);
});
it("does not retry quota failure or include provider messages in the error", async () => {
  let requests = 0;
  const provider = new GeminiProvider({
    apiKey: "fictional",
    fetch: async () => {
      requests++;
      return Response.json(
        { error: { message: "PRIVATE_TEXT" } },
        { status: 429 },
      );
    },
  });
  await expect(
    provider.transcribe(Buffer.from("fictional"), "mp3", 2000),
  ).rejects.toMatchObject({ status: 429 });
  expect(requests).toBe(1);
});
it("validates native audio timestamps while retaining unknown roles and unverified quality", async () => {
  const provider = new GeminiProvider({
    apiKey: "fictional",
    fetch: async (url, init) => {
      expect(String(url)).not.toContain("key=");
      const body = JSON.parse(String(init?.body));
      expect(body.contents[0].parts[1].inlineData.mimeType).toBe("audio/mpeg");
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    segments: [
                      {
                        startMs: 0,
                        endMs: 1000,
                        text: "Fictional ants concern.",
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      });
    },
  });
  const result = await provider.transcribe(
    Buffer.from("fictional"),
    "mp3",
    2000,
  );
  expect(result.segments[0].speaker).toBe("unknown");
  expect(result.complete).toBe(false);
  expect(result.reviewReasons).toContain("Transcription quality needs review.");
});
it("refuses oversized audio before dispatch", async () => {
  let requests = 0;
  const provider = new GeminiProvider({
    apiKey: "fictional",
    fetch: async () => {
      requests++;
      throw new Error("unexpected");
    },
  });
  await expect(
    provider.transcribe(Buffer.alloc(16_000_000), "wav", 2000),
  ).rejects.toThrow("AUDIO_REQUEST_TOO_LARGE");
  expect(requests).toBe(0);
});
it("uses an explicitly configured timestamped transcriber without Gemini audio fallback", async () => {
  const transcript = {
    segments: [
      {
        id: "seg-1",
        startMs: 0,
        endMs: 1000,
        text: "Fictional service concern.",
        speaker: "unknown" as const,
      },
    ],
    durationMs: 2000,
    complete: false,
    reviewReasons: ["Transcription completeness needs review."],
  };
  const transcribe = vi.fn().mockResolvedValue(transcript);
  const provider = new GeminiProvider({
    apiKey: "fictional",
    transcriber: { transcribe },
    fetch: async () => {
      throw new Error("Gemini audio must not be dispatched");
    },
  });
  expect(
    await provider.transcribe(Buffer.from("fictional"), "mp3", 2000),
  ).toEqual(transcript);
  expect(transcribe).toHaveBeenCalledTimes(1);
});
it("rejects invalid returned timestamps even when the schema declares bounds", async () => {
  const provider = new GeminiProvider({
    apiKey: "fictional",
    fetch: async () =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    segments: [
                      {
                        startMs: 1000,
                        endMs: 4000,
                        text: "Fictional service.",
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
  });
  await expect(
    provider.transcribe(Buffer.from("fictional"), "mp3", 2000),
  ).rejects.toThrow("INVALID_TRANSCRIPT");
});
