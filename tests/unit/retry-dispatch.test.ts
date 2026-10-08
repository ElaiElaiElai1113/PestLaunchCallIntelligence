import { expect, it, vi } from "vitest";
import type { CallRecord } from "@/lib/domain/types";
import { sampleCall } from "@/lib/samples/fixtures";
import { dispatchRetry, type RetryRepository } from "@/lib/jobs/retry-dispatch";
import { claimProcessingAttempt } from "@/lib/jobs/processing-claim";
import {
  pendingProcessing,
  retryAvailable,
} from "@/lib/domain/processing-attempt";
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
    errorCode: "PROCESSING_START_PENDING",
    version: 4,
    transcriptCompleteness: "unverified",
  });
});
it.each(["read", "write"] as const)(
  "pending intent survives recovery %s outage and a fresh request",
  async (failure) => {
    let saved = sampleCall("service", "fictional-recovery-call");
    saved.status = "failed";
    saved.errorCode = "ANALYSIS_FAILED";
    let outage = true,
      writes = 0;
    const repo: RetryRepository = {
      get: async () => {
        if (outage && failure === "read")
          throw new Error("DATABASE_UNAVAILABLE");
        return structuredClone(saved);
      },
      put: async (next, expected) => {
        writes++;
        if (outage && failure === "write" && writes > 1)
          throw new Error("DATABASE_UNAVAILABLE");
        if (saved.version !== expected) return false;
        saved = structuredClone(next);
        return true;
      },
    };
    await expect(
      dispatchRetry(repo, structuredClone(saved), async () => {
        throw new Error("fictional failure");
      }),
    ).rejects.toThrow("PROCESSING_START_FAILED");
    expect(saved.processingAttempt).toMatchObject({
      state: "pending",
      runId: null,
    });
    const attempt = saved.processingAttempt!.id;
    outage = false;
    const restarted = { get: repo.get, put: repo.put },
      start = vi.fn<(id: string, attemptId: string) => Promise<void>>(
        async () => {},
      );
    await dispatchRetry(restarted, await restarted.get(saved.id), start);
    expect(start).toHaveBeenCalledWith(saved.id, attempt);
    expect(saved.processingAttempt!.id).toBe(attempt);
  },
);
it("successful delayed dispatch retains pending intent and reuses its ID", async () => {
  const { call, repo, read } = setup();
  const start = vi.fn<(id: string, attemptId: string) => Promise<void>>(
    async () => {},
  );
  await dispatchRetry(repo, call, start);
  const attempt = read()!.processingAttempt?.id;
  expect(attempt).toBeTruthy();
  await dispatchRetry(repo, structuredClone(read()!), start);
  expect(start.mock.calls.map((x) => x[1])).toEqual([attempt, attempt]);
});
it("recovery CAS false keeps pending intent retryable without overwriting state", async () => {
  const { call, repo, read } = setup();
  const put = repo.put;
  let writes = 0;
  repo.put = async (...args) => (++writes === 2 ? false : put(...args));
  await expect(
    dispatchRetry(repo, call, async () => {
      throw new Error("fictional failure");
    }),
  ).rejects.toThrow("PROCESSING_START_FAILED");
  expect(pendingProcessing(read()!)).toBe(true);
  expect(retryAvailable(read()!)).toBe(true);
  expect(read()!.version).toBe(2);
});
it("a worker claim before a reported start error cannot be restored over", async () => {
  const { call, repo, read } = setup();
  await expect(
    dispatchRetry(repo, call, async (id, attempt) => {
      expect(await claimProcessingAttempt(repo, id, attempt, "early-run")).toBe(
        true,
      );
      throw new Error("fictional late dispatch error");
    }),
  ).rejects.toThrow("PROCESSING_START_FAILED");
  expect(read()!.processingAttempt).toMatchObject({
    state: "running",
    runId: "early-run",
  });
  expect(retryAvailable(read()!)).toBe(false);
});
it("a finished failed attempt gets a new ID; a running one is unavailable", async () => {
  const { call, repo, read } = setup();
  call.processingAttempt = {
    id: "old-attempt",
    state: "finished",
    runId: "old-run",
  };
  await dispatchRetry(
    repo,
    call,
    async () => {},
    () => "new-attempt",
  );
  expect(read()!.processingAttempt!.id).toBe("new-attempt");
  const running = structuredClone(read()!);
  running.processingAttempt!.state = "running";
  const start = vi.fn();
  await expect(dispatchRetry(repo, running, start)).rejects.toThrow(
    "RETRY_UNAVAILABLE",
  );
  expect(start).not.toHaveBeenCalled();
});
it("an initial repository exception never starts a run", async () => {
  const { call, repo } = setup();
  repo.put = async () => {
    throw new Error("DATABASE_UNAVAILABLE");
  };
  const start = vi.fn();
  await expect(dispatchRetry(repo, call, start)).rejects.toThrow(
    "DATABASE_UNAVAILABLE",
  );
  expect(start).not.toHaveBeenCalled();
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
