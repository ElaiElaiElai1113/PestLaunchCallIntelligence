import type { Segment, ProviderOutput } from "../domain/types";
import Groq, { toFile } from "groq-sdk";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  buildAnalysisRequest,
  buildScoringRequests,
  type RequestLimits,
} from "./analysis-request";
import { INDEXED_CONTRACT, decodeIndexedEvidence } from "./indexed-contract";
import { scoringHeadroomWait } from "./rate-headroom";
import { RUBRICS } from "../scoring/rubrics";
import {
  STAGED_CONTRACT,
  resolveStaged,
  validateExtraction,
  scoringSchema,
} from "./staged-contract";
export class GroqProvider {
  constructor(
    readonly config: {
      apiKey?: string;
      analysisLimits?: RequestLimits;
      beforeDispatch?: (request: Request) => Promise<void>;
      baseURL?: string;
      prepareAnalysisRequest?: (
        request: ReturnType<typeof buildAnalysisRequest>["request"],
      ) => ReturnType<typeof buildAnalysisRequest>["request"];
      fetch?: typeof fetch;
      beforeScoring?: () => Promise<void>;
      waitForHeadroom?: (ms: number) => Promise<void>;
      cachedExtraction?: ProviderOutput & { requestHash: string };
      saveExtraction?: (
        output: ProviderOutput & { requestHash: string },
      ) => Promise<void>;
    },
  ) {}
  protected client(onResponse?: (response: Response) => void) {
    if (!this.config.apiKey?.trim()) throw new Error("AI_NOT_CONFIGURED");
    return new Groq({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      fetch:
        onResponse || this.config.beforeDispatch
          ? async (input, init) => {
              const wire = this.config.beforeDispatch
                ? new Request(input, init)
                : null;
              if (wire) await this.config.beforeDispatch!(wire.clone());
              const response = wire
                ? await (this.config.fetch ?? fetch)(wire)
                : await (this.config.fetch ?? fetch)(input, init);
              onResponse?.(response);
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
    sourceDurationMs?: number,
  ): Promise<{
    segments: Segment[];
    durationMs: number;
    complete: boolean;
    reviewReasons: string[];
  }> {
    void sourceDurationMs;
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
        (x, index) =>
          !x.text ||
          x.endMs <= x.startMs ||
          x.endMs > parsed.duration * 1000 + 1000 ||
          (index > 0 && x.startMs < segments[index - 1].startMs),
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
    const built = buildAnalysisRequest(
      segments,
      context,
      this.config.analysisLimits,
    );
    const request =
      this.config.prepareAnalysisRequest?.(built.request) ?? built.request;
    const extractionContract = built.indexed
      ? INDEXED_CONTRACT
      : STAGED_CONTRACT;
    const requestHash = createHash("sha256")
      .update(JSON.stringify(built.indexed ? { request, segments } : request))
      .digest("hex");
    const candidate = this.config.cachedExtraction;
    const cached =
      candidate &&
      candidate.contract === extractionContract &&
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
    const extractionValue = JSON.parse(content);
    const extracted = validateExtraction(
      built.indexed
        ? decodeIndexedEvidence(extractionValue, segments)
        : extractionValue,
      segments,
    );
    if (!cached)
      await this.config.saveExtraction?.({
        contract: extractionContract,
        model: request.model,
        content,
        requestHash,
      });
    const employeeEvidenceAvailable = segments.some(
      (s) => s.speaker === "employee",
    );
    let scoringContent: string | null = null;
    const scoringGroups: {
      content: string;
      checkpointIds: string[];
      indexed: boolean;
    }[] = [];
    let scoring: unknown = {
      noObjections: false,
      checkpoints: Object.fromEntries(
        (extracted.purpose === "unknown" ? [] : RUBRICS[extracted.purpose]).map(
          (item) => [
            item.id,
            {
              evidence: { segmentIds: [] },
              reason: "Employee attribution needs review; assessment withheld.",
              status: "unknown",
            },
          ],
        ),
      ),
      coaching: { strength: null, improvement1: null, improvement2: null },
    };
    if (extracted.purpose !== "unknown" && employeeEvidenceAvailable) {
      const requests = buildScoringRequests(
        segments,
        context,
        extracted.purpose,
        this.config.analysisLimits,
      );
      const groups: z.infer<ReturnType<typeof scoringSchema>>[] = [];
      for (const next of requests) {
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
        // Ownership/source is rechecked after waiting, immediately before effects.
        await this.config.beforeScoring?.();
        const scoringRequest =
          this.config.prepareAnalysisRequest?.(next.request) ?? next.request;
        const scored = await client.chat.completions.create(scoringRequest);
        if (
          scored.choices[0]?.finish_reason !== "stop" ||
          typeof scored.choices[0]?.message.content !== "string"
        )
          throw new Error("INCOMPLETE_ANALYSIS");
        scoringContent = scored.choices[0].message.content;
        const value = JSON.parse(scoringContent);
        const decoded = next.indexed
          ? decodeIndexedEvidence(value, segments)
          : value;
        const group = scoringSchema(
          segments,
          extracted.purpose,
          next.selectedIds,
        ).parse(decoded);
        groups.push(group);
        scoringGroups.push({
          content: scoringContent,
          checkpointIds:
            next.selectedIds ?? RUBRICS[extracted.purpose].map((c) => c.id),
          indexed: next.indexed,
        });
      }
      if (groups.some((g) => g.noObjections !== groups[0].noObjections))
        throw new Error("INCONSISTENT_ANALYSIS");
      const strengths = groups.flatMap((g) =>
        g.coaching.strength ? [g.coaching.strength] : [],
      );
      const improvements = groups
        .flatMap((g) => [g.coaching.improvement1, g.coaching.improvement2])
        .filter((g) => g !== null);
      // Preserve all group bytes below; show at most three supported suggestions
      // in authoritative checkpoint order, without combining model prose.
      scoring = {
        checkpoints: Object.assign({}, ...groups.map((g) => g.checkpoints)),
        noObjections: groups[0].noObjections,
        coaching: {
          strength: strengths[0] ?? null,
          improvement1: improvements[0] ?? null,
          improvement2: improvements[1] ?? null,
        },
      };
    }
    const result = resolveStaged(extracted, scoring, segments, context);
    return {
      ...result,
      providerOutput: {
        contract:
          built.indexed || scoringGroups.some((g) => g.indexed)
            ? INDEXED_CONTRACT
            : STAGED_CONTRACT,
        model: request.model,
        content: JSON.stringify({
          extraction: content,
          scoring:
            scoringGroups.length > 1
              ? JSON.stringify(scoringGroups.map((g) => g.content))
              : scoringContent,
          ...(built.indexed || scoringGroups.some((g) => g.indexed)
            ? {
                extractionIndexed: built.indexed,
                referenceMap: segments.map((s) => s.id),
                sourceHash: createHash("sha256")
                  .update(JSON.stringify(segments))
                  .digest("hex"),
                scoringGroups,
              }
            : {}),
          scoringStatus: scoringContent
            ? "returned"
            : employeeEvidenceAvailable
              ? "not_applicable"
              : "withheld_unattributed",
        }),
      },
    };
  }
}
