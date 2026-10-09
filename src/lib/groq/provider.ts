import type { Segment, ProviderOutput } from "../domain/types";
import Groq, { toFile } from "groq-sdk";
import { z } from "zod";
import { createHash } from "node:crypto";
import { buildAnalysisRequest, buildScoringRequest } from "./analysis-request";
import { scoringHeadroomWait } from "./rate-headroom";
import {
  STAGED_CONTRACT,
  resolveStaged,
  validateExtraction,
} from "./staged-contract";
export class GroqProvider {
  constructor(
    readonly config: {
      apiKey?: string;
      fetch?: typeof fetch;
      beforeScoring?: () => Promise<void>;
      waitForHeadroom?: (ms: number) => Promise<void>;
      cachedExtraction?: ProviderOutput & { requestHash: string };
      saveExtraction?: (
        output: ProviderOutput & { requestHash: string },
      ) => Promise<void>;
    },
  ) {}
  private client(onResponse?: (response: Response) => void) {
    if (!this.config.apiKey?.trim()) throw new Error("AI_NOT_CONFIGURED");
    return new Groq({
      apiKey: this.config.apiKey,
      fetch: onResponse
        ? async (input, init) => {
            const response = await (this.config.fetch ?? fetch)(input, init);
            onResponse(response);
            return response;
          }
        : this.config.fetch,
      maxRetries: 0,
      timeout: 120000,
    });
  }
  async transcribe(
    bytes: Buffer,
    extension: string,
  ): Promise<{
    segments: Segment[];
    durationMs: number;
    complete: boolean;
    reviewReasons: string[];
  }> {
    const response = await this.client().audio.transcriptions.create({
      file: await toFile(bytes, `recording.${extension}`),
      model: process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
      language: "en",
      temperature: 0,
    });
    const parsed = z
      .object({
        duration: z.number().positive(),
        segments: z
          .array(
            z.object({
              start: z.number().nonnegative(),
              end: z.number().positive(),
              text: z.string(),
              no_speech_prob: z.number().optional(),
              avg_logprob: z.number().optional(),
            }),
          )
          .min(1),
      })
      .parse(response);
    const segments = parsed.segments.map((x, i) => ({
      id: `seg-${i + 1}`,
      startMs: Math.round(x.start * 1000),
      endMs: Math.round(x.end * 1000),
      text: x.text.trim(),
      speaker: "unknown" as const,
    }));
    if (
      segments.some(
        (x) => x.endMs < x.startMs || x.endMs > parsed.duration * 1000 + 1000,
      )
    )
      throw new Error("INVALID_TRANSCRIPT");
    const reviewReasons = ["Transcription completeness needs review."];
    if (
      parsed.segments.some(
        (x) =>
          x.no_speech_prob === undefined ||
          x.avg_logprob === undefined ||
          x.no_speech_prob >= 0.6 ||
          x.avg_logprob <= -1,
      )
    )
      reviewReasons.push("Transcription quality needs review.");
    return {
      segments,
      durationMs: Math.round(parsed.duration * 1000),
      // Confidence and plausible silence cannot certify complete source capture.
      complete: false,
      reviewReasons,
    };
  }
  async analyze(
    segments: Segment[],
    context: { transcriptComplete: boolean } = { transcriptComplete: false },
  ) {
    let headers = new Headers(),
      receivedAt = Date.now();
    const client = this.client((response) => {
      headers = response.headers;
      receivedAt = Date.now();
    });
    if (JSON.stringify(segments).length > 150000)
      throw new Error("TRANSCRIPT_TOO_LONG");
    const { request } = buildAnalysisRequest(segments, context);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(request))
      .digest("hex");
    const candidate = this.config.cachedExtraction;
    const cached =
      candidate &&
      candidate.contract === STAGED_CONTRACT &&
      candidate.model === request.model &&
      candidate.requestHash === requestHash
        ? candidate
        : undefined;
    const response = cached
      ? null
      : await client.chat.completions.create(request);
    if (response && response.choices[0]?.finish_reason !== "stop")
      throw new Error("INCOMPLETE_ANALYSIS");
    const content = cached?.content ?? response?.choices[0]?.message.content;
    if (typeof content !== "string") throw new Error("INCOMPLETE_ANALYSIS");
    const extracted = validateExtraction(JSON.parse(content), segments);
    if (!cached)
      await this.config.saveExtraction?.({
        contract: STAGED_CONTRACT,
        model: request.model,
        content,
        requestHash,
      });
    let scoringContent: string | null = null;
    let scoring: unknown = {
      noObjections: false,
      checkpoints: {},
      coaching: { strength: null, improvement1: null, improvement2: null },
    };
    if (extracted.purpose !== "unknown") {
      const next = buildScoringRequest(segments, context, extracted.purpose);
      const waitMs = scoringHeadroomWait(
        headers,
        next.budget.estimatedTotalTokens,
        Date.now() - receivedAt,
      );
      if (waitMs)
        await (
          this.config.waitForHeadroom ??
          ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
        )(waitMs);
      // Ownership/privacy is rechecked after waiting, immediately before effects.
      await this.config.beforeScoring?.();
      const scored = await client.chat.completions.create(next.request);
      if (
        scored.choices[0]?.finish_reason !== "stop" ||
        typeof scored.choices[0]?.message.content !== "string"
      )
        throw new Error("INCOMPLETE_ANALYSIS");
      scoringContent = scored.choices[0].message.content;
      scoring = JSON.parse(scoringContent);
    }
    const result = resolveStaged(extracted, scoring, segments, context);
    return {
      ...result,
      providerOutput: {
        contract: STAGED_CONTRACT,
        model: request.model,
        content: JSON.stringify({
          extraction: content,
          scoring: scoringContent,
        }),
      },
    };
  }
}
