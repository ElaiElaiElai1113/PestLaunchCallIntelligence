import { expect, it, vi } from "vitest";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
import { dispatchRetry, type RetryRepository } from "@/lib/jobs/retry-dispatch";
function setup() {
  let saved: CallRecord | null = sampleCall("service", "fictional-call");
  Object.assign(saved, {
    status: "failed",
    errorCode: "ANALYSIS_FAILED",
    transcriptCompleteness: "unverified",
    transcriptReviewReasons: ["Transcription quality needs review."],
  });
  const call = structuredClone(saved);
  const repo: RetryRepository = {
    get: async () => {
      if (!saved) throw new Error("CALL_NOT_FOUND");
      return structuredClone(saved);
    },
    put: async (next, expected) => {
      if (!saved || saved.version !== expected) return false;
      saved = structuredClone(next);
      return true;
    },
  };
  return {
    call,
    repo,
    read: () => saved,
    advance: () => {
      saved!.version++;
      saved!.status = "needs_review";
    },
    remove: () => {
      saved = null;
    },
  };
}
it("failed dispatch becomes retryable and preserves artifacts and uncertainty", async () => {
  const { call, repo, read } = setup();
  const snapshot = structuredClone(call);
  await expect(
    dispatchRetry(repo, call, async () => {
      throw new Error("fictional dispatch failure");
    }),
  ).rejects.toThrow("PROCESSING_START_FAILED");
  expect(read()).toMatchObject({
    status: "failed",
    errorCode: "PROCESSING_START_FAILED",
    version: 3,
    transcriptCompleteness: "unverified",
    transcriptReviewReasons: call.transcriptReviewReasons,
    segments: call.segments,
    analysis: call.analysis,
  });
  expect(call).toEqual(snapshot);
  await dispatchRetry(repo, structuredClone(read()!), async () => {});
  expect(read()).toMatchObject({
    status: "analyzing",
    errorCode: null,
    version: 4,
    transcriptCompleteness: "unverified",
  });
});
it("does not overwrite a concurrent version advance", async () => {
  const { call, repo, read, advance } = setup();
  await expect(
    dispatchRetry(repo, call, async () => {
      advance();
      throw new Error("failed");
    }),
  ).rejects.toThrow("PROCESSING_START_FAILED");
  expect(read()).toMatchObject({ version: 3, status: "needs_review" });
});
it("does not recreate a call deleted during dispatch", async () => {
  const { call, repo, read, remove } = setup();
  await expect(
    dispatchRetry(repo, call, async () => {
      remove();
      throw new Error("failed");
    }),
  ).rejects.toThrow("PROCESSING_START_FAILED");
  expect(read()).toBe(null);
});
it("initial version conflict never dispatches", async () => {
  const { call, repo, advance } = setup();
  advance();
  const start = vi.fn(async () => {});
  await expect(dispatchRetry(repo, call, start)).rejects.toThrow("CONFLICT");
  expect(start).not.toHaveBeenCalled();
});
