# Review follow-up repairs implementation plan

> For agentic workers: use superpowers:executing-plans, systematic-debugging, test-driven-development and verification-before-completion. Execute sequentially in the existing checkout with one editing owner. The human requested delivery to the implementation chat for execution. Do not spawn subagents.

**Goal:** Close the three remaining review findings: unfinished bulk deletion, dispatch recovery during database failure, and mixed Playwright suite discovery.

**Architecture:** Keep tombstones and versioned repository writes. Give each processing attempt a durable identifier in the existing protected call payload and require a workflow to claim it before provider work. Keep owner retention counts separate from the ordinary call list, and isolate mocked browser checks through their existing preview configuration.

**Tech stack:** Existing locked Next.js/TypeScript, Supabase, Workflow 5.1.0, Vitest/PGlite and Playwright. No new dependency, hosted service or schema migration is expected.

## Baseline, authority and boundaries

- Repository: C:/Users/Admin/Desktop/Projects/Portfolio/PestLaunchCallIntelligence.
- Branch: codex/call-intelligence.
- Reviewed application commit: 511f86c702ad72e8c833c07639b02eded559d1e8.
- Reviewed clean HEAD: b4e47c42b7e3d40c52fee659e3eebe8053fe57b8, documentation follow-up.
- Implementation chat: Continue PestLaunch keyless implementation, 01a11b01-3253-76d0-a0ec-b9e482b50c8b. Retain its current model and thinking settings.
- This planning chat writes only this plan. Application edits belong to the implementation chat. Recheck HEAD/status and preserve unrelated changes before editing.
- Read AGENTS.md, IMPLEMENTATION_PROMPT.md, docs/specs/product-design.md, docs/plans/implementation-plan.md, docs/architecture.md, docs/context/source-register.md and docs/evidence/progress.md before application edits. This plan is the bounded follow-up to docs/plans/2026-10-08-keyless-review-remediation.md.
- Keep GROQ_API_KEY empty and REAL_CALL_PROCESSING_ENABLED=false. Do not inspect credentials or change .env.local. Inject explicitly fictional provider/workflow/Storage ports in tests.
- No hosted scripts, hosted migrations, provider requests, customer recordings, key rotation, user provisioning, deployment, purchases, source pushes, GitHub creation or client/recruiter messages are authorized by this slice. CALL-013 remains quarantined.
- The exposed server key still needs replacement before further hosted use. The local migration 20261008114517_bind_source_upload_to_registered_path.sql remains unapplied remotely. Do not modify or reapply the existing migrations.
- Preserve Sales 17, General 12 and Retention 12, grade guards, raw original analyses, trusted-source uncertainty, missing metadata and private playback restrictions.
- Cap persistent review/fix/review issues at three repair rounds. Record the concrete cause if that cap is reached. Do not expand this into stale-running-job recovery, automatic redaction, a source-attribution editor or live deployment acceptance.

## Review evidence and required outcomes

| Finding | Root cause and reproduction | Acceptance |
| --- | --- | --- |
| P1 unfinished bulk deletion | Actual DELETE handler + Repository under fictional in-memory Supabase/Storage ports: first request returned 503 DELETE_STORAGE_FAILED and left a tombstone plus row; second returned 200 deleted=0 because repo.list() hides tombstoned rows. Owner Data controls also shows zero and disables deletion when only pending rows remain. | Owner bulk cleanup includes tombstoned rows, a later retry completes cleanup, counts include pending rows, and ordinary listing/playback still hides them. |
| P1 failed dispatch restoration | Actual dispatchRetry under injected ports: initial analyzing write succeeded, start rejected, restoration put threw DATABASE_UNAVAILABLE; helper returned PROCESSING_START_FAILED but left analyzing/errorCode=null/version=2, which the route rejected on the next retry. The earlier supplied plan missed this case. | Recovery after a read/write outage survives process restart and does not depend on the same failing database restoration. Repeated starts for one pending attempt permit one workflow owner before provider work. Running/untracked calls remain protected. |
| P2 mixed browser suite | Default playwright.config.ts discovers remediation.mocked.spec.ts at port 3000; that test only permits port 3001, so its own route rejects default navigation. Discovery was verified; the default browser failure was inferred from configuration, not executed. | Default discovery excludes mocked specs. Mocked discovery includes all mocked specs using the existing isolated port-3001 harness. |

The prior review freshly passed 88 tests in 15 files, lint, typecheck and whitespace checks. Those are historical baseline evidence for this round; rerun on the owned repair revision. No fresh build or browser execution was performed by the planning review.

## Task 1 — Make unfinished deletion visible and retryable to its owner

**Files**
- Modify src/app/api/test-data/route.ts.
- Modify src/lib/server/repository.ts.
- Modify src/app/(workspace)/settings/data/page.tsx.
- Modify src/components/workspace-shell.tsx for safe deletion error copy.
- Extend tests/integration/repository-deletion.test.ts.
- Create tests/integration/test-data-routes.test.ts.
- Create tests/e2e/data-controls.mocked.spec.ts, executed only after Task 3.

- [x] Add a failing route/repository regression using the actual Repository.list and delete methods with fictional Supabase/Storage ports. Do not spy away list/get; the missing tombstoned row is the bug. Seed one retained live/synthetic call and source/derivative objects. Make Storage inventory fail on the first request. Assert 503, tombstone retained, call retained and no delete_call RPC/receipt. Assert the owner summary is retained=1, pendingDeletion=1 while ordinary list/get hides the call. Restore the fake Storage port, repeat DELETE, and assert deleted=1, both bucket inventories empty, row removed and one deletion receipt. A third request returns deleted=0 without another receipt.
- [x] Add owner-only GET/DELETE coverage, workspace isolation, malformed confirmation rejection and a continuing Storage failure that never returns successful deletion. Count only tombstones that still have a retained call row; historical tombstones are not retained content.
- [x] Run the focused regression before repair:

~~~powershell
npm test -- tests/integration/repository-deletion.test.ts tests/integration/test-data-routes.test.ts
~~~

Expected new regressions fail on the existing implementation, while the existing cleanup-failure contracts remain passing.

- [x] Add Repository.retentionSummary() as a server-side count-only operation. Require an owner even if called outside the route; remain workspace-scoped. A suitable implementation using the existing list path is:

~~~typescript
async retentionSummary(): Promise<{ retained: number; pendingDeletion: number }> {
  if (this.identity.role !== "owner") throw new AppError("OWNER_REQUIRED", 403);
  const calls = await this.list(true);
  if (this.identity.mode === "sample")
    return { retained: calls.length, pendingDeletion: 0 };
  const { data, error } = await adminClient()
    .from("deletion_tombstones")
    .select("call_id")
    .eq("workspace_id", this.identity.workspaceId);
  if (error) throw new AppError("DATABASE_UNAVAILABLE", 503);
  const pending = new Set((data ?? []).map((row) => row.call_id));
  return {
    retained: calls.length,
    pendingDeletion: calls.filter((call) => pending.has(call.id)).length,
  };
}
~~~

The summary is a refreshed observation, not an atomic certification of concurrent storage deletion. It returns no labels, paths, transcripts or other deleted-content payloads to the browser.

- [x] Export a dynamic, authenticated owner GET from /api/test-data returning {retained,pendingDeletion}. Keep respond() no-store behavior. Change DELETE's inventory to await repo.list(true), retaining typed DELETE confirmation and existing verified cleanup ordering:

~~~typescript
export const dynamic = "force-dynamic";
export async function GET() {
  return respond(async () => {
    const identity = await requireIdentity();
    requireOwner(identity);
    return new Repository(identity).retentionSummary();
  });
}
// Within the existing DELETE handler, after confirmation:
const calls = await repo.list(true);
for (const call of calls) await repo.delete(call.id);
return { deleted: calls.length, at: new Date().toISOString() };
~~~

Keep ordinary Repository.list()/get()/media filtering unchanged. Keep failures explicit; do not emit success for a partially finished batch. Cleanup must still verify both buckets before the row/receipt RPC.

- [x] Update Data controls to load the owner summary on entry and refresh it after either successful or failed deletion. Keep an explicit loading/error state; unavailable counts must not be shown as zero. Owner deletion is enabled whenever retained>0, including pending-only rows. Use the summary in the confirmation count. After a failure, refresh the ordinary call list as well, since tombstoned content must disappear there.

Use existing panel/button styles, with this behavior and copy:

~~~typescript
type RetentionSummary = { retained: number; pendingDeletion: number };
// Owner display:
// heading: "Retained conversations"
// count: summary ? summary.retained : "—"
// pending text when >0:
// `${summary.pendingDeletion} conversation(s) still need deletion cleanup. Retry deletion to finish.`
// button label when pendingDeletion >0: "Retry deletion cleanup"
// otherwise: "Delete test data"
// disabled: loading || summary === null || summary.retained === 0
// DELETE_STORAGE_FAILED copy:
// "Some recording copies could not be removed. Retry deletion to finish cleanup."
// DELETE_FAILED copy:
// "Deletion could not finish. Retry cleanup after the workspace is available."
~~~

Reviewer views must not call the owner summary endpoint. Label their ordinary call count "Available conversations" so it does not claim to include inaccessible deletion-pending content. Do not expose a tombstoned call link or restore playback to make cleanup accessible.

- [x] Add an isolated mocked owner journey: ordinary /api/calls=[] and summary={retained:1,pendingDeletion:1}; Data controls shows 1, explains pending cleanup and has an enabled retry button. First mocked DELETE fails; summary stays 1/1 and no success is shown. Second succeeds; summary becomes 0/0 and the button disables. Also check failed GET displays an unavailable/loading state rather than zero. Mock all APIs, reject unexpected/external traffic, and keep screenshots fictional and ignored.
- [x] Rerun the focused tests and record red/green results. Commit only the owned deletion/UI/test changes.

## Task 2 — Persist dispatch intent and fence provider work by attempt ownership

The installed Workflow docs and current official [start reference](https://workflow-sdk.dev/docs/api-reference/workflow-api/start) state that every start call creates a run. There is no caller-supplied run-ID/idempotency-key option to assume here. Therefore repeated pending dispatch may create idle duplicate runs; an application CAS claim must ensure only one of them can perform provider work. Use [getWorkflowMetadata](https://workflow-sdk.dev/docs/api-reference/workflow/get-workflow-metadata) to obtain workflowRunId. Recheck installed signatures before coding; do not introduce an imagined SDK option.

**Files**
- Modify src/lib/domain/types.ts.
- Create src/lib/domain/processing-attempt.ts (client-safe predicates).
- Modify src/lib/jobs/retry-dispatch.ts.
- Create src/lib/jobs/processing-claim.ts (repository-port CAS claim).
- Modify src/app/api/calls/[callId]/retry/route.ts.
- Modify src/app/api/calls/finalize/route.ts to use the same dispatch boundary.
- Modify src/workflows/process-call.ts to claim/fence new attempts.
- Modify src/components/call-detail.tsx and src/components/call-list.tsx for pending-start presentation.
- Extend tests/unit/retry-dispatch.test.ts and tests/integration/review-retry-routes.test.ts.
- Create tests/unit/processing-claim.test.ts.
- Extend tests/integration/workflow-publication.test.ts.
- Create tests/integration/finalize-dispatch.test.ts.
- Create tests/e2e/processing-recovery.mocked.spec.ts, executed only after Task 3.

- [x] Reproduce recovery get failure, recovery put exception, recovery put false, successful dispatch followed by worker delay, and process restart using a newly constructed helper/repository over the same saved fictional state. Tests must assert a later legitimate owner request can dispatch the pending attempt while unrelated active calls remain unavailable.
- [x] Add concurrent duplicate-run claim tests and a worker-before-start-error race. Only one run may own provider work; restoration cannot overwrite a worker claim. Preserve analysis/transcript/quality metadata across every transition. Assert tombstones/deletion and version advances are never overwritten or reconstructed from the pre-dispatch snapshot.
- [x] Run focused retry/route/workflow tests before implementation; record the new meaningful failures.

- [x] Add optional server-owned metadata to CallRecord. Existing records with no field keep their current behavior; do not infer that an untracked queued/analyzing call is safe to retry.

~~~typescript
export type ProcessingAttempt = {
  id: string;
  state: "pending" | "running" | "finished";
  runId: string | null;
};
// In CallRecord:
processingAttempt?: ProcessingAttempt;
~~~

This lives in the existing protected JSON payload. IDs are safe metadata; no new table, caller-controlled certification field, transcript or provider response belongs in it.

- [x] Implement the client-safe predicates:

~~~typescript
import type { CallRecord } from "./types";
export function pendingProcessing(call: CallRecord): boolean {
  return Boolean(call.processingAttempt?.id && call.processingAttempt.state === "pending");
}
export function retryAvailable(call: CallRecord): boolean {
  if (call.processingAttempt?.state === "running") return false;
  return pendingProcessing(call) || call.status === "failed" ||
    ["AI_NOT_CONFIGURED", "PRIVACY_APPROVAL_REQUIRED"].includes(call.errorCode ?? "");
}
export function ownsProcessing(
  call: CallRecord,
  attemptId: string | undefined,
  runId: string | undefined,
): boolean {
  if (!attemptId) return !call.processingAttempt; // legacy run cannot take a new attempt
  return call.processingAttempt?.id === attemptId &&
    call.processingAttempt.state === "running" &&
    call.processingAttempt.runId === runId;
}
~~~

Server auth, provider configuration and real-recording privacy checks still run before any dispatch. This predicate is eligibility, not authorization.

- [x] Replace the helper with a durable-pending transition. Reuse the ID of an existing pending attempt. A finished failed attempt receives a new ID; a running attempt is unavailable. Inject the ID factory for deterministic tests. A successful start must not depend on a further route-side database write. Use this algorithm:

~~~typescript
import { randomUUID } from "node:crypto";
import type { CallRecord } from "../domain/types";
import { pendingProcessing } from "../domain/processing-attempt";
export type RetryRepository = {
  get(id: string): Promise<CallRecord>;
  put(call: CallRecord, expectedVersion: number | null): Promise<boolean>;
};
export async function dispatchRetry(
  repo: RetryRepository,
  call: CallRecord,
  startRun: (id: string, attemptId: string) => Promise<void>,
  makeAttemptId: () => string = randomUUID,
) {
  if (call.processingAttempt?.state === "running") throw new Error("RETRY_UNAVAILABLE");
  const attemptId = pendingProcessing(call) ? call.processingAttempt!.id : makeAttemptId();
  const queued: CallRecord = {
    ...structuredClone(call),
    status: call.segments.length ? "analyzing" : "queued",
    errorCode: "PROCESSING_START_PENDING",
    processingAttempt: { id: attemptId, state: "pending", runId: null },
    version: call.version + 1,
  };
  if (!(await repo.put(queued, call.version))) throw new Error("CONFLICT");
  try {
    await startRun(call.id, attemptId);
  } catch {
    try {
      const latest = await repo.get(call.id);
      if (latest.version === queued.version &&
          latest.processingAttempt?.id === attemptId && pendingProcessing(latest)) {
        await repo.put({ ...latest, status: "failed", errorCode: "PROCESSING_START_FAILED",
          version: latest.version + 1 }, latest.version);
      }
    } catch {
      // Durable pending intent already exists; never recreate deleted content.
    }
    throw new Error("PROCESSING_START_FAILED");
  }
}
~~~

The fallback remains best effort, but correctness now rests on the earlier durable pending record. Do not clear pending on a route-side successful start: the worker owns that transition. Initial put failure/conflict must never dispatch. A false recovery CAS must leave the newer state untouched.

- [x] Add the repository-port claim helper. The same run can repeat its claim after a step retry; a different run cannot. A database error must propagate to the Workflow step retry mechanism before any provider effect. If the CAS loses, reread and accept only the same recorded owner:

~~~typescript
import { ownsProcessing } from "../domain/processing-attempt";
import type { RetryRepository } from "./retry-dispatch";
export async function claimProcessingAttempt(
  repo: RetryRepository, callId: string, attemptId: string, runId: string,
): Promise<boolean> {
  const call = await repo.get(callId);
  if (ownsProcessing(call, attemptId, runId)) return true;
  if (call.processingAttempt?.id !== attemptId || call.processingAttempt.state !== "pending")
    return false;
  const claimed = {
    ...call,
    processingAttempt: { id: attemptId, state: "running" as const, runId },
    errorCode: null,
    version: call.version + 1,
  };
  if (await repo.put(claimed, call.version)) return true;
  return ownsProcessing(await repo.get(callId), attemptId, runId);
}
~~~

- [x] Use retryAvailable in the retry route and client. Dispatch with start(processCall,[id,attemptId]); return only safe call identifiers/error codes. Map conflict to 409 and start failure to 503. Keep owner/key/privacy gates. An ordinary active call with no pending metadata, or a running attempt, remains RETRY_UNAVAILABLE.
- [x] Route successful upload-finalize admission through the same helper, after header/checksum/size/admission checks. For admission=run, dispatch from the validated UPLOAD_PENDING call directly; the helper's CAS is its finalization write. For awaiting_ai/privacy_held, retain the existing versioned persistence and do not start anything. Do not restore UPLOAD_PENDING after start failure. Remove the old route-side run-ID upsert for the new dispatch path; the claimed run ID in protected processingAttempt metadata is authoritative. Existing call_jobs history stays intact. No feature currently reads it; do not add a second conflicting dispatch state store.
- [x] Make processCall accept an optional attemptId for backward compatibility. Obtain workflowRunId in the workflow function and call a use-step claim wrapper before transcription or analysis. If another run owns the attempt, return {callId} without provider/Storage effects. For legacy calls, allow the old path only while no processingAttempt exists. Step arguments and return values remain identifiers, booleans and safe metadata.

~~~typescript
// Inside processCall, after "use workflow":
const runId = getWorkflowMetadata().workflowRunId;
if (attemptId && !(await claimAttemptStep(callId, attemptId, runId))) return { callId };
const allowed = await transcriptionStep(callId, attemptId, runId);
if (allowed) await analysisStep(callId, attemptId, runId);
return { callId };

async function claimAttemptStep(callId: string, attemptId: string, runId: string) {
  "use step";
  const repo = await systemRepository(callId);
  return claimProcessingAttempt(repo, callId, attemptId, runId);
}
~~~

Thread attemptId/runId through the existing transcriptionStep, analysisStep and safeFailure signatures. At each step's entry, check ownsProcessing against a fresh, non-tombstoned call before effects. Immediately before derivative upload and result publication, reread and reject deletion/supersession; keep the existing expected-version checks. Use the current local snapshot/version for writes; do not replace a newer record with an older content snapshot. Legacy runs encountering newly tracked metadata must exit.

When publishing an analysis, holding privacy review, or persisting a terminal provider failure for the same owner, set processingAttempt.state="finished" within that same versioned write. Retain id/runId for safe audit metadata. If analysis is already present on entry, finish the owned attempt without inventing a new result or grade. For a RetryableError, keep the running owner so the same run can resume. Never mark a different attempt finished. Do not reclaim running attempts by age or missing run-ID: hosted stale-job reconciliation remains pending.

For the already-present-analysis case, use its existing guarded score/review reasons to restore ready/needs_review while finishing the attempt; do not leave a finished call labeled analyzing. A deleted/not-found call exits without effects; only database availability errors should retry the claim step.

- [x] Add these focused regression contracts. Use real helper/predicate logic with in-memory saved state, not tests that simply return the desired result:

~~~typescript
// Table-driven expectations for a fresh helper instance over the persisted state:
// recovery get throws   -> pendingProcessing(saved) === true; retryAvailable(saved) === true
// recovery put throws   -> pendingProcessing(saved) === true; retryAvailable(saved) === true
// recovery CAS false    -> no overwrite of changed version/artifacts
// successful start, delayed worker -> pending remains durable and same ID is reused
// first put fails/conflicts -> startRun never called
// repeated pending starts -> both receive same attempt ID, only one run claims
// after claim           -> retryAvailable(saved) === false
// deleted/tombstoned    -> no dispatch/claim/provider effect or content resurrection
// unrelated queued call with no metadata -> retryAvailable(saved) === false
// finished failed attempt -> new ID on legitimate retry
// same run step retry   -> claim succeeds for same runId, different runId fails
~~~

In workflow tests, count injected transcribe/analyze effects under duplicate claims and assert one owner. Cover both no-segments transcription and existing-segments analysis, plus out-of-order old workflow delivery after a newer attempt. Add finalize contract coverage so it cannot bypass the claim. Assert preserved originalAnalysis, completeness/review reasons and no secret/raw exception text in route responses.

Add this executable regression to tests/unit/retry-dispatch.test.ts, alongside its existing imports. It fails the current helper because no durable pending attempt remains after the recovery outage:

~~~typescript
it.each(["read", "write"] as const)("pending intent survives recovery %s failure and a new request", async (failure) => {
  let saved = sampleCall("service", "fictional-recovery-call");
  saved.status = "failed";
  saved.errorCode = "ANALYSIS_FAILED";
  let outage = true;
  let writes = 0;
  const repo: RetryRepository = {
    get: async () => {
      if (outage && failure === "read") throw new Error("DATABASE_UNAVAILABLE");
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
  await expect(dispatchRetry(repo, structuredClone(saved), async () => {
    throw new Error("fictional dispatch failure");
  })).rejects.toThrow("PROCESSING_START_FAILED");
  expect(saved.processingAttempt).toMatchObject({ state: "pending", runId: null });
  const attemptId = saved.processingAttempt!.id;
  outage = false;
  const newRequestRepo: RetryRepository = { get: repo.get, put: repo.put };
  const startAgain = vi.fn(async (_id: string, _attemptId: string) => {});
  await dispatchRetry(newRequestRepo, await newRequestRepo.get(saved.id), startAgain);
  expect(startAgain).toHaveBeenCalledWith(saved.id, attemptId);
  expect(saved.processingAttempt!.id).toBe(attemptId);
});
~~~

Use this complete core contract for tests/unit/processing-claim.test.ts; extend it with the outage/deletion/version matrix above:

~~~typescript
import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import type { RetryRepository } from "@/lib/jobs/retry-dispatch";
import { claimProcessingAttempt } from "@/lib/jobs/processing-claim";
it("one workflow owns an attempt and its own step retry retains ownership", async () => {
  let saved = sampleCall("service", "fictional-claim-call");
  saved.processingAttempt = { id: "fictional-attempt", state: "pending", runId: null };
  const repo: RetryRepository = {
    get: async () => structuredClone(saved),
    put: async (next, expected) => {
      if (saved.version !== expected) return false;
      saved = structuredClone(next);
      return true;
    },
  };
  const results = await Promise.all([
    claimProcessingAttempt(repo, saved.id, "fictional-attempt", "fictional-run-a"),
    claimProcessingAttempt(repo, saved.id, "fictional-attempt", "fictional-run-b"),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const owner = saved.processingAttempt!.runId!;
  expect(await claimProcessingAttempt(repo, saved.id, "fictional-attempt", owner)).toBe(true);
  expect(saved.processingAttempt).toEqual({ id: "fictional-attempt", state: "running", runId: owner });
});
~~~

- [x] Update pending-start UI to show "Waiting to start" and explain "Processing has not confirmed a start yet. You can retry starting it." The owner can use "Retry starting analysis" for durable pending metadata. After claim, the normal processing state appears and retry disappears. Keep provider/privacy controls effective. Add a fully mocked browser reload journey for pending eligibility, retry error, reloaded pending state, and claimed running state. A separate untracked active fixture must have no retry control.
- [x] Run focused verification:

~~~powershell
npm test -- tests/unit/retry-dispatch.test.ts tests/unit/processing-claim.test.ts tests/integration/review-retry-routes.test.ts tests/integration/workflow-publication.test.ts tests/integration/finalize-dispatch.test.ts
npm run typecheck
~~~

Expected all focused contracts pass with no real provider/workflow/hosted request. Commit only the owned dispatch/workflow/UI/test changes. If installed SDK behavior differs, adapt the wrapper and record evidence while preserving durable-pending and single-owner invariants; do not drop these safeguards or claim hosted recovery from mocks.

## Task 3 — Separate default and mocked Playwright suites

**Files**
- Modify playwright.config.ts.
- Modify playwright.mocked.config.ts.
- Modify package.json only for an explicit mocked-suite script.
- Keep scripts/run-isolated-preview.mjs's empty provider/Supabase overrides and isolated output.

- [x] Verify the baseline discovery issue using list-only commands (these do not start the app):

~~~powershell
npx --no-install playwright test --list
npx --no-install playwright test --config playwright.mocked.config.ts --list
~~~

The current default list incorrectly includes remediation.mocked.spec.ts. Capture this before repair; do not run the default suite against the configured backend or an existing port-3000 server.

- [x] Exclude mocked specs from default discovery and include every mocked spec in the isolated configuration. Add an explicit script:

~~~typescript
// playwright.config.ts, alongside testDir:
testIgnore: "**/*.mocked.spec.ts",
// playwright.mocked.config.ts:
testMatch: "**/*.mocked.spec.ts",
~~~

~~~json
"test:e2e:mocked": "playwright test --config playwright.mocked.config.ts"
~~~

No dependency update is needed. Do not weaken the mocked tests' network allowlist or change the default suite to port 3001 merely to conceal the discovery issue.

- [x] Repeat both list-only commands. Default discovery contains only workspace.spec.ts's existing three tests; mocked discovery contains remediation.mocked.spec.ts and the new owner-cleanup/processing-recovery journeys. Record actual test counts rather than hardcoding a total across new test cases.
- [x] Run npm run test:e2e:mocked against the owned isolated preview. Confirm no existing server reuse, port 3001 only, empty provider/Supabase overrides and rejection of unexpected external/API requests. Verify pending-only cleanup stays accessible, loading/error counts are truthful, retry recovers after reload, running jobs have no retry control, and existing coaching/follow-up checks still pass. Check new states at 320/390/768/1024/1440 px using the existing layout checks.
- [x] Commit the owned suite-isolation changes. Default full-browser/sample-CRUD acceptance remains pending its own isolated datastore harness; list-only success does not prove those journeys run.

## Task 4 — Final verification and review handoff

- [x] Review the owned patch against the three acceptance rows and the authorization boundaries. Pay particular attention to deletion retries, counts after failed cleanup, attempt ownership before both provider stages, old-run delivery, version/tombstone preservation, raw original assessment preservation and suite discovery.
- [x] Run each check once on the final source revision; rerun only if a change/failure justifies it:

~~~powershell
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
npx --no-install playwright test --list
npx --no-install playwright test --config playwright.mocked.config.ts --list
npm run test:e2e:mocked
~~~

Do not run test:http, hosted acceptance/cleanup, default browser mutation suites or the real provider. A successful build compiles workflows; it does not execute or certify them.

- [x] Update docs/evidence/progress.md with exact source commit, red/green reproduction, command results/test counts, mocked-preview boundaries and remaining gates. Mark this plan's checkboxes only where verified. Distinguish application/provider effects claimed once in fictional tests from actual hosted workflow/queue acceptance. Record that duplicate pending starts can create idle runs but only one claimed run may perform provider effects.
- [x] Keep server-key replacement, unapplied local migration, trusted completeness/attribution, verified sanitization, real-provider fictional processing, hosted races/recovery/log/backup deletion and deployment acceptance pending.
- [x] Produce a concise completion handoff with source commit, final HEAD, clean/dirty status, changed files, each finding's result, exact checks and pending boundaries. The human previously authorized this implementation chat to send each completed implementation to the planning/review chat; use that existing direct authorization to return the owned revision there for read-only review. Do not claim review approval before that independent review occurs.

## Plan self-review

- The owner bulk path includes retained tombstoned rows while ordinary access keeps them hidden.
- The same database outage that defeats restoration cannot erase the earlier pending intent.
- Pending retries reuse an attempt ID and workflow ownership is claimed before provider work, including finalize dispatch and existing-segment analysis.
- An active untracked/running call is not reopened for arbitrary retries.
- Version conflicts, deletion and later attempt ownership take precedence over an old snapshot.
- Default and mocked test discovery are disjoint; only the isolated mocked browser suite executes in this round.
- No hosted or real-provider acceptance is implied by local tests.
