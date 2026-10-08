import { it, expect } from "vitest";
import { GroqProvider } from "@/lib/groq/provider";
import { analysis } from "../helpers/analysis";
import { wireFromAnalysis, stagedFromAnalysis } from "../helpers/provider-wire";
const segments = [
  {
    id: "s1",
    text: "Hello",
    startMs: 0,
    endMs: 1000,
    speaker: "unknown" as const,
  },
];
it("transcription refuses missing credentials before fetching", async () => {
  let requests = 0;
  const provider = new GroqProvider({
    fetch: async () => {
      requests++;
      return new Response();
    },
  });
  await expect(
    provider.transcribe(Buffer.from("fictional audio"), "wav"),
  ).rejects.toThrow("AI_NOT_CONFIGURED");
  expect(requests).toBe(0);
});
it("transcription preserves offsets and does not invent speaker identity", async () => {
  let format = "";
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async (_input, init) => {
      format = String((init?.body as FormData).get("response_format"));
      return Response.json({
        duration: 12.5,
        segments: [
          {
            start: 0.25,
            end: 4.5,
            text: "Fictional spoken example.",
            no_speech_prob: 0.1,
            avg_logprob: -0.2,
          },
        ],
      });
    },
  });
  const result = await provider.transcribe(
    Buffer.from("fictional audio"),
    "wav",
  );
  expect(format).toBe("verbose_json");
  expect(result.segments[0]).toMatchObject({
    id: "seg-1",
    startMs: 250,
    endMs: 4500,
    speaker: "unknown",
  });
  expect(result.durationMs).toBe(12500);
  expect(result.complete).toBe(false);
});
it.each([
  {
    label: "unexplained coverage gap with missing quality",
    duration: 60,
    segment: { start: 0, end: 1, text: "Fictional test" },
    qualityReview: true,
  },
  {
    label: "missing confidence fields",
    duration: 1,
    segment: { start: 0, end: 1, text: "Fictional test" },
    qualityReview: true,
  },
  {
    label: "low confidence",
    duration: 1,
    segment: {
      start: 0,
      end: 1,
      text: "Fictional test",
      no_speech_prob: 0.9,
      avg_logprob: -2,
    },
    qualityReview: true,
  },
  {
    label: "plausible trailing silence",
    duration: 4,
    segment: {
      start: 0,
      end: 1,
      text: "Fictional test",
      no_speech_prob: 0.1,
      avg_logprob: -0.2,
    },
    qualityReview: false,
  },
])(
  "ASR remains unverified: $label",
  async ({ duration, segment, qualityReview }) => {
    const provider = new GroqProvider({
      apiKey: "fictional-contract-token",
      fetch: async () => Response.json({ duration, segments: [segment] }),
    });
    const result = await provider.transcribe(
      Buffer.from("fictional audio"),
      "wav",
    );
    expect(result.complete).toBe(false);
    expect(result).toHaveProperty(
      "reviewReasons",
      expect.arrayContaining(["Transcription completeness needs review."]),
    );
    if (qualityReview)
      expect(result).toHaveProperty(
        "reviewReasons",
        expect.arrayContaining(["Transcription quality needs review."]),
      );
    expect(result.segments).toHaveLength(1);
    expect(result.durationMs).toBe(duration * 1000);
  },
);
it("transcription rejects an impossible timestamp", async () => {
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async () =>
      Response.json({
        duration: 1,
        segments: [{ start: 0, end: 15, text: "Fictional example" }],
      }),
  });
  await expect(
    provider.transcribe(Buffer.from("fictional audio"), "wav"),
  ).rejects.toThrow("INVALID_TRANSCRIPT");
});
it("missing AI key fails before any network request", async () => {
  let requests = 0;
  const provider = new GroqProvider({
    fetch: async () => {
      requests++;
      return new Response();
    },
  });
  await expect(provider.analyze(segments)).rejects.toThrow("AI_NOT_CONFIGURED");
  expect(requests).toBe(0);
});
it("uses strict structured output and computes no provider-owned grade", async () => {
  let body: Record<string, unknown> = {};
  let count = 0;
  const a = analysis();
  a.outcomes = Object.fromEntries(
    [
      "quoteProvided",
      "inspectionBooked",
      "treatmentAccepted",
      "agreementSigned",
      "paymentCollected",
      "cancellationRequested",
      "cancellationAccepted",
      "retentionSaved",
    ].map((key) => [
      key,
      {
        value: null as boolean | null,
        evidence: { segmentIds: [] as string[], quote: "" },
      },
    ]),
  ) as typeof a.outcomes;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      count++;
      return Response.json({
        id: "contract",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify(
                count === 1
                  ? stagedFromAnalysis(a).extraction
                  : stagedFromAnalysis(a).scoring,
              ),
            },
            finish_reason: "stop",
          },
        ],
      });
    },
  });
  const result = await provider.analyze(segments);
  expect(result.effective.purpose).toBe("sales");
  expect(result.original).toEqual(a);
  expect(count).toBe(2);
  expect(JSON.parse(result.providerOutput.content)).toEqual({
    extraction: JSON.stringify(stagedFromAnalysis(a).extraction),
    scoring: JSON.stringify(stagedFromAnalysis(a).scoring),
  });
  expect(
    result.effective.assessments.every((x) => x.status === "unknown"),
  ).toBe(true);
  expect(result.effective.complete).toBe(false);
  expect(
    (body.messages as { role: string; content: string }[]).find(
      (x) => x.role === "user",
    )!.content,
  ).toContain('"sourceVerification":{"transcriptComplete":false}');
  expect(body.response_format).toMatchObject({
    type: "json_schema",
    json_schema: { strict: true },
  });
  expect(result).not.toHaveProperty("grade");
});
it("invalid provider evidence is rejected before publication", async () => {
  const a = analysis();
  a.assessments[0].evidence = { segmentIds: ["fabricated"], quote: "Hello" };
  a.outcomes = Object.fromEntries(
    [
      "quoteProvided",
      "inspectionBooked",
      "treatmentAccepted",
      "agreementSigned",
      "paymentCollected",
      "cancellationRequested",
      "cancellationAccepted",
      "retentionSaved",
    ].map((key) => [
      key,
      {
        value: null as boolean | null,
        evidence: { segmentIds: [] as string[], quote: "" },
      },
    ]),
  ) as typeof a.outcomes;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async () =>
      Response.json({
        choices: [
          {
            message: { content: JSON.stringify(wireFromAnalysis(a)) },
            finish_reason: "stop",
          },
        ],
      }),
  });
  await expect(provider.analyze(segments)).rejects.toThrow();
});

it("budget admission fails before fetch and preserves complete input", async () => {
  let requests = 0;
  const provider = new GroqProvider({
    apiKey: "fictional-contract-token",
    fetch: async () => {
      requests++;
      return new Response();
    },
  });
  const input = [{ ...segments[0], text: "Fictional ".repeat(2000) }];
  await expect(provider.analyze(input)).rejects.toThrow(
    "ANALYSIS_BUDGET_EXCEEDED",
  );
  expect(requests).toBe(0);
  expect(input[0].text.endsWith("Fictional ")).toBe(true);
});
it.each(["length", "content_filter"])(
  "rejects provider termination %s",
  async (finish_reason) => {
    const provider = new GroqProvider({
      apiKey: "fictional-contract-token",
      fetch: async () =>
        Response.json({
          choices: [{ finish_reason, message: { content: "{}" } }],
        }),
    });
    await expect(provider.analyze(segments)).rejects.toThrow(
      "INCOMPLETE_ANALYSIS",
    );
  },
);
it.each(["not JSON", "{}"])(
  "rejects malformed wire response %s",
  async (content) => {
    const provider = new GroqProvider({
      apiKey: "fictional-contract-token",
      fetch: async () =>
        Response.json({
          choices: [{ finish_reason: "stop", message: { content } }],
        }),
    });
    await expect(provider.analyze(segments)).rejects.toThrow();
  },
);
