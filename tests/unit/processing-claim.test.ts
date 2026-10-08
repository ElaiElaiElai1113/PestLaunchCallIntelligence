import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import type { CallRecord } from "@/lib/domain/types";
import type { RetryRepository } from "@/lib/jobs/retry-dispatch";
import { claimProcessingAttempt } from "@/lib/jobs/processing-claim";
import {
  retryAvailable,
  ownsProcessing,
} from "@/lib/domain/processing-attempt";
it.each([true,false])("a delayed claim restores active status, existing transcript=%s",async hasTranscript=>{
  let saved=sampleCall("service","delayed-call");if(!hasTranscript)saved.segments=[];
  saved.status="failed";saved.errorCode="PROCESSING_START_FAILED";saved.processingAttempt={id:"pending-attempt",state:"pending",runId:null};
  const repo:RetryRepository={get:async()=>structuredClone(saved),put:async(next,expected)=>{if(saved.version!==expected)return false;saved=structuredClone(next);return true;}};
  await claimProcessingAttempt(repo,saved.id,"pending-attempt","run-a");
  expect(saved.status).toBe(hasTranscript?"analyzing":"queued");expect(saved.errorCode).toBe(null);expect(retryAvailable(saved)).toBe(false);
});
function setup() {
  let saved: CallRecord | null = sampleCall("service", "fictional-claim-call");
  saved.processingAttempt = {
    id: "fictional-attempt",
    state: "pending",
    runId: null,
  };
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
    repo,
    read: () => saved,
    remove: () => {
      saved = null;
    },
    replace: () => {
      saved!.processingAttempt = {
        id: "new-attempt",
        state: "pending",
        runId: null,
      };
      saved!.version++;
    },
  };
}
it("one workflow claims and its own retry retains ownership", async () => {
  const { repo, read } = setup();
  const results = await Promise.all([
    claimProcessingAttempt(
      repo,
      "fictional-claim-call",
      "fictional-attempt",
      "run-a",
    ),
    claimProcessingAttempt(
      repo,
      "fictional-claim-call",
      "fictional-attempt",
      "run-b",
    ),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const owner = read()!.processingAttempt!.runId!;
  expect(
    await claimProcessingAttempt(
      repo,
      "fictional-claim-call",
      "fictional-attempt",
      owner,
    ),
  ).toBe(true);
  expect(retryAvailable(read()!)).toBe(false);
});
it("claim outages propagate before provider effects", async () => {
  const { repo } = setup();
  repo.put = async () => {
    throw new Error("DATABASE_UNAVAILABLE");
  };
  await expect(
    claimProcessingAttempt(
      repo,
      "fictional-claim-call",
      "fictional-attempt",
      "run-a",
    ),
  ).rejects.toThrow("DATABASE_UNAVAILABLE");
});
it("deletion cannot be reconstructed by a claim", async () => {
  const { repo, remove, read } = setup();
  const put = repo.put;
  repo.put = async (...args) => {
    remove();
    return put(...args);
  };
  await expect(
    claimProcessingAttempt(
      repo,
      "fictional-claim-call",
      "fictional-attempt",
      "run-a",
    ),
  ).rejects.toThrow("CALL_NOT_FOUND");
  expect(read()).toBe(null);
});
it("a later attempt wins over an old claimant", async () => {
  const { repo, replace, read } = setup();
  const put = repo.put;
  repo.put = async (...args) => {
    replace();
    return put(...args);
  };
  expect(
    await claimProcessingAttempt(
      repo,
      "fictional-claim-call",
      "fictional-attempt",
      "run-a",
    ),
  ).toBe(false);
  expect(read()!.processingAttempt!.id).toBe("new-attempt");
});
it("legacy or untracked active calls cannot steal a tracked attempt or reopen running work", () => {
  const { read } = setup();
  expect(ownsProcessing(read()!, undefined, "old-run")).toBe(false);
  const untracked = sampleCall("service", "untracked");
  untracked.status = "analyzing";
  untracked.errorCode = null;
  expect(retryAvailable(untracked)).toBe(false);
  untracked.processingAttempt = {
    id: "running-attempt",
    state: "running",
    runId: "run-a",
  };
  untracked.status = "failed";
  expect(retryAvailable(untracked)).toBe(false);
});
