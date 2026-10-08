# Keyless review remediation implementation plan

> For agentic workers: use superpowers:executing-plans and execute sequentially in the existing checkout. The human authorized this plan and its delivery to the implementation chat. Do not spawn subagents or message other chats. Keep one application editing owner.

**Goal:** Resolve the six reviewed correctness, deletion and retry findings while the AI key remains empty.

**Architecture:** Keep the current Next.js application, Supabase repository and ID-only Workflow boundary. Add small, testable domain/operation helpers where production code currently mixes validation and external effects. Preserve raw model assessments separately from guarded effective assessments.

**Tech stack:** Existing locked TypeScript, Next.js, Supabase, Groq SDK, Workflow SDK, Vitest/PGlite and Playwright dependencies. No dependency upgrade or replacement stack is part of this slice.

## Baseline and authorization

- Root: C:/Users/Admin/Desktop/Projects/Portfolio/PestLaunchCallIntelligence.
- Reviewed application baseline: 58384d16bbb48d0748873aad78876913c904fb03 on codex/call-intelligence, clean before this plan.
- Implementation chat: Continue PestLaunch keyless implementation, 01a11b01-3253-76d0-a0ec-b9e482b50c8b.
- Recheck the actual revision and preserve unrelated changes. This plan is the only document written by the planning chat. Work in this existing branch; no worktree is necessary for the current clean standalone checkout.
- Read AGENTS.md, IMPLEMENTATION_PROMPT.md, docs/specs/product-design.md, docs/architecture.md, docs/context/source-register.md and the latest docs/evidence/progress.md before editing.
- Later evidence supersedes earlier setup statements. The dedicated hosted project already exists; do not create another project or reapply the initial migration.
- GROQ_API_KEY stays empty. REAL_CALL_PROCESSING_ENABLED stays false. Mocked provider tests use an explicitly fictional token and an injected fetch implementation; they never use the configured account.
- Do not inspect credential values, modify .env.local, rotate keys, provision users, apply hosted migrations, run hosted acceptance/cleanup scripts, deploy, purchase services, create/push GitHub repositories or process customer calls in this slice.
- The exposed Supabase server key must be replaced before further hosted use. That is an external prerequisite, not a reason to leave independent local fixes unfinished.
- Customer recordings, full private transcripts, signed URLs and content-bearing real-data evidence remain out of this plan and Git. CALL-013 remains quarantined.
- Do not expand this slice into automatic audio redaction, a new diarization service, a full reviewer attribution editor, large-file chunking or the all-20-call evaluation. Record these pending boundaries honestly.

## Evidence and source authority

Fresh read-only review reproduced:
1. The source policy accepted call-ID-prefixed alternative filenames not registered in sourcePath. Modeled registered-path cleanup plus delete_call left two alternative objects in embedded SQL.
2. A mocked 60-second transcription with only one 1-second segment and missing quality fields returned complete=true.
3. A mocked all-passed Sales assessment supported by an unknown speaker was accepted and computed as 17/17 Gold.

Code inspection found:
4. final_information means collecting details in code, while both manuals mean offering future-service information; Sales additionally includes referral information.
5. Retry persists queued/analyzing before dispatch, with no recovery if workflow start fails.
6. Re-service intent alone is displayed as Follow-up agreed.

Rubric authority:
- Sales manual: https://docs.google.com/document/d/11MmhUKGkMc2cx4NFTLHV-RRk0rrDxz3U/edit
- Office manual: https://docs.google.com/document/d/1xSofO54L_TY5MnkbO_Wq2DiEZdXdOgJVmCb2OVLr4lE/edit
- Source metadata is missing rep, direction and original timestamp. Never substitute upload time.
- Sales stays 17 points; General and Retention remain distinct 12-point rubrics. Gold/Green/Below thresholds remain unchanged.
- No-sales-objections awards four points only with reliable complete evidence. Unknown or unresolved applicability cannot change denominators or silently become passes.
- The 31 hosted checks and 42 local tests in the old ledger are historical evidence, not verification of this new revision.

## Task 1 — Repair source admission and cleanup of alternative copies

**Files**
- Modify tests/integration/rls.test.ts.
- Create one CLI-generated additive migration under supabase/migrations.
- Create src/lib/server/storage-cleanup.ts and tests/unit/storage-cleanup.test.ts.
- Modify src/lib/server/repository.ts.
- Preserve both existing migration files unchanged.

- [x] Extend the embedded call fixture to include mode=live, sourcePath equal to the exact admitted WAV path, status=queued and errorCode=UPLOAD_PENDING.
- [x] Add failing owner-upload cases for the same call ID with .mp3 and .extra.wav filenames. Also reject the exact path when errorCode is AI_NOT_CONFIGURED. Preserve valid pending-owner allowance, reviewer/cross-workspace/nested-path denial and tombstone denial.
- [x] Run npm test -- tests/integration/rls.test.ts and record the new failures before changing the policy.
- [x] Discover the installed CLI command through its help, then create an additive migration:

~~~powershell
.\node_modules\.bin\supabase.cmd migration new --help --profile supabase
.\node_modules\.bin\supabase.cmd migration new bind_source_upload_to_registered_path --profile supabase
~~~

Use the actual filename returned by the CLI. Do not invent its timestamp or apply it to the hosted project. Replace its body with:

~~~sql
alter policy source_owner_upload on storage.objects
with check (
  bucket_id = 'call-source'
  and array_length(storage.foldername(name), 1) = 1
  and exists (
    select 1
    from public.workspace_members m
    join public.calls c on c.workspace_id = m.workspace_id
    where m.workspace_id::text = (storage.foldername(name))[1]
      and c.id::text = split_part(storage.filename(name), '.', 1)
      and c.payload->>'sourcePath' = name
      and c.payload->>'mode' = 'live'
      and c.payload->>'status' = 'queued'
      and c.payload->>'errorCode' = 'UPLOAD_PENDING'
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and not exists (
        select 1 from public.deletion_tombstones t where t.call_id = c.id
      )
  )
);
~~~

- [x] Add this cleanup helper. The port intentionally isolates Storage from tests:

~~~ts
import type { CallRecord } from '../domain/types';

export type StoragePort = {
  list(bucket: string, prefix: string, offset: number, limit: number):
    Promise<{ name: string; id: string | null }[]>;
  remove(bucket: string, paths: string[]): Promise<void>;
};

export async function deleteCallMedia(port: StoragePort, call: CallRecord) {
  const prefix = call.workspaceId + '/';
  for (const [bucket, registered] of [
    ['call-source', call.sourcePath],
    ['call-sanitized', call.sanitizedPath],
  ] as const) {
    if (registered && !registered.startsWith(prefix))
      throw new Error('DELETE_STORAGE_FAILED');
    const inventory = async () => {
      const paths: string[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await port.list(bucket, call.workspaceId, offset, 100);
        for (const item of page) {
          if (item.name === call.id || item.name.startsWith(call.id + '.')) {
            if (!item.id) throw new Error('DELETE_STORAGE_FAILED');
            paths.push(prefix + item.name);
          }
        }
        if (page.length < 100) return paths;
      }
    };
    const paths = [...new Set([
      ...(registered ? [registered] : []),
      ...await inventory(),
    ])];
    for (let offset = 0; offset < paths.length; offset += 100)
      await port.remove(bucket, paths.slice(offset, offset + 100));
    if ((await inventory()).length)
      throw new Error('DELETE_STORAGE_FAILED');
  }
}
~~~

The folder failure is deliberate: an unexpected legacy nested copy must not produce a successful deletion receipt. Diagnose it privately; do not broaden deletion to unrelated calls or workspaces.

- [x] Replace the two registered-path-only removal blocks in Repository.delete with a port backed by client.storage.from(bucket).list(prefix, {offset, limit, sortBy:{column:'name',order:'asc'}}) and remove(paths). Throw DELETE_STORAGE_FAILED for any SDK error. Call deleteCallMedia after tombstoning and before delete_call. On any inventory/remove/verification error, preserve the tombstone and call row for retry; do not issue the deletion receipt.
- [x] Add cleanup tests that construct a fictional call with sampleCall('service', 'fictional-call'). Use a mutable in-memory port containing its registered WAV, .mp3, .extra.wav and an unrelated call's WAV. Assert that all owned copies disappear from both buckets and the unrelated call remains. Include a match on page two, a remove failure, an object surviving removal and a matching folder. Each must either prove complete owned cleanup or retain a retryable failure.
- [x] Run npm test -- tests/integration/rls.test.ts tests/unit/storage-cleanup.test.ts. Expected: all prior access cases and new path/cleanup cases pass.
- [x] Review the SQL diff for privilege widening. Record that embedded SQL and mocked Storage cannot certify hosted in-flight-upload races or backup deletion.

## Task 2 — Correct manual meaning and grouping

**Files**
- Modify src/lib/scoring/rubrics.ts.
- Add tests/unit/rubric-authority.test.ts.
- Update docs/scoring-policy.md.

- [x] Write failing assertions for the final_information label/guidance and distinct Sales referral guidance:

~~~ts
import { expect, it } from 'vitest';
import { RUBRICS } from '@/lib/scoring/rubrics';

it('offers future-service information instead of collecting details', () => {
  for (const purpose of ['sales', 'general'] as const) {
    const checkpoint = RUBRICS[purpose].find(x => x.id === 'final_information')!;
    expect(checkpoint.label).toBe('Offer future-service information');
    expect(checkpoint.guidance).toContain('future pest-control needs');
    expect(checkpoint.guidance).not.toContain('Collect');
  }
  expect(RUBRICS.sales.find(x => x.id === 'final_information')!.guidance)
    .toContain('referral program');
  expect(RUBRICS.general.find(x => x.id === 'final_information')!.guidance)
    .not.toContain('referral program');
});
~~~

- [x] Run npm test -- tests/unit/rubric-authority.test.ts and record the failure.
- [x] Replace the shared final_information definition with:

~~~ts
final_information: [
  'Offer future-service information',
  'Verify',
  'Tell the customer to contact the company for future pest-control needs.',
],
~~~

In the existing rubric mapping, keep the shared guidance for General and override Sales final_information with:

~~~ts
guidance: purpose === 'sales' && id === 'final_information'
  ? 'Tell the customer to contact the company for future pest-control needs and explain the referral program.'
  : common[id][2],
~~~

- [x] Correct the manual's quadrant grouping: expectation_understand belongs to Validate; expectation_solve belongs to Understand; Retention transition and research belong to Validate; validate_expectation belongs to Understand. Keep the same checkpoint IDs, order and totals. Add assertions covering these mappings.
- [x] Preserve manual-specific exceptions and do not turn example prices, discounts or contract terms into universal business rules.
- [x] Run npm test -- tests/unit/rubric-authority.test.ts tests/unit/domain.test.ts. Expected: source meaning/grouping and all numeric thresholds/policy-denominator cases pass.

## Task 3 — Publish guarded assessments and persist transcript uncertainty

**Files**
- Modify src/lib/domain/types.ts, src/lib/groq/provider.ts and src/lib/scoring/engine.ts.
- Create src/lib/domain/assessment-guards.ts.
- Modify src/workflows/process-call.ts and the checkpoint review route.
- Modify tests/integration/provider.test.ts; add tests/unit/assessment-guards.test.ts and a mocked workflow persistence regression.
- Modify src/components/call-detail.tsx only for a truthful empty coaching state.

**Contract decision**
ASR confidence is a quality indicator, not proof of complete capture. In this bounded slice, normal uploaded ASR output remains unverified until a future trusted source-review mechanism establishes completeness. Do not invent a gap tolerance that certifies completeness. Existing clearly fictional, curated sample fixtures may retain their known-complete state. This is a partial-assessment product state, not a transcription failure.

- [x] Add optional persisted fields to CallRecord, preserving compatibility with old JSON payloads:

~~~ts
transcriptCompleteness?: 'verified' | 'unverified';
transcriptReviewReasons?: string[];
~~~

Absence on a live record means unverified. These fields are server-owned; add no public request field or endpoint that lets the browser/model certify them.

- [x] Write and run the failing regressions listed below before adding the helper. Use this target implementation after the failures are recorded:

~~~ts
import type { Analysis, Evidence, Segment } from './types';

export function guardAssessment(
  original: Analysis,
  segments: Segment[],
  context: { transcriptComplete: boolean },
): Analysis {
  const effective = structuredClone(original);
  const lookup = new Map(segments.map(x => [x.id, x]));
  const normalize = (value: string) =>
    value.replace(/\s+/g, ' ').trim().toLowerCase();
  const employeeEvidence = (evidence: Evidence) => {
    if (!evidence.segmentIds.length || !evidence.quote.trim() ||
        evidence.segmentIds.some(id => !lookup.has(id))) return false;
    const employeeText = evidence.segmentIds
      .map(id => lookup.get(id)!)
      .filter(segment => segment.speaker === 'employee')
      .map(segment => segment.text).join(' ');
    return normalize(employeeText).includes(normalize(evidence.quote));
  };
  let attributionUnresolved = false;
  for (const item of effective.assessments) {
    const unsupportedPass =
      item.status === 'passed' && !employeeEvidence(item.evidence);
    const unsupportedMiss =
      item.status === 'missed' &&
      (!context.transcriptComplete || !segments.some(x => x.speaker === 'employee'));
    if (unsupportedPass || unsupportedMiss) {
      item.status = 'unknown';
      item.reason = 'Employee attribution or complete evidence needs review.';
      attributionUnresolved = true;
    }
  }
  effective.complete = original.complete && context.transcriptComplete;
  const attributableComplete =
    effective.complete && segments.length > 0 &&
    segments.every(x => x.speaker !== 'unknown') &&
    segments.some(x => x.speaker === 'employee') &&
    segments.some(x => x.speaker === 'customer');
  effective.noObjections = original.noObjections && attributableComplete;
  effective.coaching = effective.coaching.filter(item => {
    const supported = employeeEvidence(item.evidence);
    if (!supported) attributionUnresolved = true;
    return supported;
  });
  if (!effective.complete)
    effective.reviewReasons.push('Transcription completeness needs review.');
  if (attributionUnresolved)
    effective.reviewReasons.push('Speaker attribution needs review.');
  if (original.noObjections && !effective.noObjections)
    effective.reviewReasons.push('No-objection policy needs complete attributable evidence.');
  effective.reviewReasons = [...new Set(effective.reviewReasons)];
  return effective;
}
~~~

This guard is a necessary attribution/completeness boundary, not proof that a quote semantically satisfies a checkpoint. Actual rubric accuracy still needs later provider/audio review. Speaker labels supplied by transcription stay unknown; never ask the analysis model to promote its inferred labels into trusted attribution.

- [x] Add meaningful failing tests using the existing analysis() helper:
  - All passed checkpoints quoted from unknown-only or customer-only segments become unresolved; fixed denominator and null grade remain.
  - Adding an unrelated employee segment ID cannot authorize a quote spoken only by the customer. The quoted supporting behavior itself must be attributable.
  - Employee-specific coaching using those segments is omitted.
  - Unknown attribution cannot obtain four no-objection policy points even if the model says complete/noObjections.
  - A clearly fictional, explicitly complete employee/customer test with supported employee evidence preserves valid points and eligible policy awards.
  - original remains byte-for-byte unchanged after guarding.
  - A live legacy record without completeness metadata defaults to unverified.
  - Remaining review reasons with otherwise passed checkpoints withhold the official grade without changing points or the original denominator.
- [x] Run npm test -- tests/unit/assessment-guards.test.ts before implementing the helper, then after it. Expected: the unsupported-publication regressions first fail and then pass.
- [x] Change GroqProvider.analyze to return Promise<{original: Analysis; effective: Analysis}> and accept context: {transcriptComplete:boolean} with a default of false. Preserve schema, exact quote/segment validation, exact rubric membership and coaching checkpoint-ID rejection on the original response. Return:

~~~ts
return {
  original: structuredClone(analysis),
  effective: guardAssessment(analysis, segments, context),
};
~~~

Update the existing provider tests to inspect effective results and preserve original output. No provider-owned grade or total is accepted.

- [x] Extend the transcribe return value with reviewReasons:string[]. Preserve timestamps/duration and impossible-timestamp rejection, but return complete:false for ordinary ASR. Always include 'Transcription completeness needs review.'; missing quality fields or low-confidence segments additionally include 'Transcription quality needs review.'. A large/unexplained coverage gap can add 'Recording coverage needs review.' but cannot label the file definitively truncated or silently discard text.
- [x] Add provider contract tests for the reproduced 60-second/1-second response, missing confidence fields, low confidence and plausible trailing silence. Each yields unverified completeness without a provider request outside injected fetch.
- [x] In transcriptionStep persist transcriptCompleteness='unverified' and transcriptReviewReasons before analysis. Do not depend on errorCode for this durable information.
- [x] In analysisStep pass transcriptComplete:call.transcriptCompleteness==='verified' into analyze. Save returned original in originalAnalysis, effective in analysis, and compute the score only from effective. Preserve reasons across retry. Both workflow and review status must be needs_review whenever score.grade===null or relevant review reasons remain.
- [x] In computeScore extend the official-grade withholding condition to unresolved || !analysis.complete || analysis.reviewReasons.length. Keep point arithmetic, denominator and thresholds unchanged; resolving one checkpoint cannot publish an official grade while independent review reasons remain.
- [x] In the checkpoint review route, validate the proposed live assessment through guardAssessment with server-owned completeness context; reject a requested passed status if the guarded checkpoint is not passed. A reason alone cannot establish attribution. Do not overwrite originalAnalysis or remove independent completeness/attribution reasons. This slice does not implement a new source-attribution reviewer; record that remaining capability.
- [x] Add a mocked processCall regression using vi.mock for systemRepository, adminClient and GroqProvider, with an already-persisted transcript so no credential branch or audio request is executed. Verify that a failed analysis retry cannot erase unverified completeness, original and effective assessments remain different, and no official grade appears.
- [x] If guarded coaching is empty, display 'Employee-specific coaching needs speaker review.' rather than an empty pane or fabricated feedback. Curated sample coaching remains explicitly fictional.
- [x] Run npm test -- tests/unit/assessment-guards.test.ts tests/integration/provider.test.ts and the new mocked workflow test. Expected: unsupported output never becomes an official employee grade; structural-invalid evidence remains rejected.

## Task 4 — Recover failed retry dispatch with version guards

**Files**
- Create src/lib/jobs/retry-dispatch.ts and tests/unit/retry-dispatch.test.ts.
- Modify src/app/api/calls/[callId]/retry/route.ts.
- Add PROCESSING_START_FAILED to the safe UI error map in src/components/workspace-shell.tsx.

- [x] Write and run the failing operation regressions listed below first. Use this target helper after recording those failures:

~~~ts
import type { CallRecord } from '../domain/types';

export type RetryRepository = {
  get(id: string): Promise<CallRecord>;
  put(call: CallRecord, expectedVersion: number | null): Promise<boolean>;
};

export async function dispatchRetry(
  repo: RetryRepository,
  call: CallRecord,
  startRun: (id: string) => Promise<void>,
) {
  const previous = call.version;
  const queued: CallRecord = {
    ...structuredClone(call),
    status: call.segments.length ? 'analyzing' : 'queued',
    errorCode: null,
    version: previous + 1,
  };
  if (!await repo.put(queued, previous)) throw new Error('CONFLICT');
  try {
    await startRun(call.id);
  } catch {
    try {
      const latest = await repo.get(call.id);
      if (latest.version === queued.version) {
        await repo.put({
          ...latest,
          status: 'failed',
          errorCode: 'PROCESSING_START_FAILED',
          version: latest.version + 1,
        }, latest.version);
      }
    } catch {
      // Deleted/unavailable content must not be reconstructed from the old snapshot.
    }
    throw new Error('PROCESSING_START_FAILED');
  }
}
~~~

- [x] Write failing tests with an in-memory RetryRepository:
  - Dispatch throws: saved status returns to failed with PROCESSING_START_FAILED and a later attempt is eligible.
  - Transcript completeness/reasons and existing artifacts survive failure and retry.
  - A concurrent version advance is not overwritten by recovery.
  - Deletion during dispatch is not recreated.
  - Initial version conflict does not dispatch at all.
- [x] Run npm test -- tests/unit/retry-dispatch.test.ts before and after the helper.
- [x] Replace the route's persist/start block with dispatchRetry. Adapt start(processCall,[id]) to the Promise<void> port by awaiting it. Map CONFLICT to 409 and PROCESSING_START_FAILED to a safe 503 AppError. Keep owner/privacy/key checks and duplicate/version restrictions.
- [x] Display 'Processing could not start. Try again.' for PROCESSING_START_FAILED. Do not print the raw workflow exception.
- [x] Run the focused tests. Do not claim durable hosted recovery from this mocked dispatch test; persist/run reconciliation beyond this failure path remains a hosted acceptance gate.

## Task 5 — Derive follow-up labels from agreement evidence

**Files**
- Create src/lib/domain/outcomes.ts and tests/unit/outcomes.test.ts.
- Modify src/components/call-list.tsx, retaining its existing outcome export for callers.

- [x] Extract a pure helper so tests do not import React/Next client components:

~~~ts
import type { CallRecord, Evidence } from './types';

const normalize = (value: string) =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

function supported(evidence: Evidence, call: CallRecord) {
  if (!evidence.segmentIds.length || !evidence.quote.trim()) return false;
  const lookup = new Map(call.segments.map(x => [x.id, x]));
  if (evidence.segmentIds.some(id => !lookup.has(id))) return false;
  const text = evidence.segmentIds.map(id => lookup.get(id)!.text).join(' ');
  return normalize(text).includes(normalize(evidence.quote));
}

export function outcomeLabel(call: CallRecord) {
  const values = call.analysis?.outcomes;
  if (values?.treatmentAccepted.value === true) return 'Treatment accepted';
  if (values?.inspectionBooked.value === true) return 'Inspection booked';
  if (values?.cancellationRequested.value === true) return 'Cancellation requested';
  if (call.analysis?.followups.some(item =>
    item.state === 'accepted' && supported(item.evidence, call)
  )) return 'Follow-up agreed';
  if (call.analysis?.secondaryIntents.includes('re-service'))
    return 'Re-service discussed';
  return call.analysis ? 'No confirmed commitment' : 'Awaiting analysis';
}
~~~

- [x] Test a re-service-only fictional call, promised/unknown/reported-completed follow-ups, accepted follow-up without evidence, fabricated segment/quote and a supported accepted follow-up. Only the last may produce Follow-up agreed. Retain independent inspection/treatment/cancellation labels.
- [x] Keep the exported component wrapper as return outcomeLabel(call), avoiding a navigation/filter redesign.
- [x] Run npm test -- tests/unit/outcomes.test.ts. Expected: intent and promise never become an accepted commitment.
- [x] Add one focused fictional browser assertion for the corrected label when feasible without contacting the configured backend. Mock every /api/ request, reject unexpected API requests, and clearly classify this as mocked frontend evidence. Do not reuse the old hosted accounts or run actual sample CRUD against configured Supabase.

## Task 6 — Same-revision verification, evidence and handoff

- [x] Review owned changes against all six findings and the source manuals.
- [x] Verify that original/effective history, fixed 17/12/12 denominators, missing metadata, no-store/auth boundaries and honest Awaiting AI remain intact.
- [x] Run the focused tests while implementing, then this final suite once the owned changes settle:

~~~powershell
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
~~~

Expected: no failures, lint/typecheck/build exit zero and clean whitespace. Record actual test counts rather than retaining 42 as a target.

- [x] Existing HTTP/E2E suites perform actual sample CRUD and cannot be blindly pointed at the configured hosted backend. Run them only in a verified isolated fictional sample environment that does not change .env.local, reuse another running app, expose credentials or touch hosted services. If such isolation is not available within this slice, report that specific browser/HTTP acceptance gap; do not claim those suites were freshly run. The new mocked frontend check has a narrower scope.
- [x] Update docs/evidence/progress.md with each finding, exact owned source revision, red/green reproductions, commands/results, simulated versus actual boundaries and the unapplied additive migration.
- [x] Update README.md, docs/architecture.md and docs/scoring-policy.md for the guarded publication and persistent completeness behavior. Clarify that the sanitized-bucket copy is not automatic redaction and trusted source review remains pending.
- [x] Review -> fix -> review the same owned revision, at most three repair rounds for a persistent issue. After the cap, report its concrete cause and finish other independent tasks; do not attempt an unbounded rewrite.
- [x] Commit only owned remediation files, this plan and evidence. Never add .private, .env.local, customer content, keys, generated build output or test recordings. Preserve unrelated work.
- [x] Return a concise final report with implementation commit, exact tests, residual issues and deployment/provider/hosted prerequisites. Do not message another chat automatically.

## Acceptance checklist

- [x] Owner upload is bound to exactly the registered pending source path; alternatives, finalized calls, reviewers, outsiders, nested paths and tombstones are denied in embedded SQL.
- [x] Cleanup removes owned registered/alternative source and derivative copies, preserves unrelated copies, paginates and refuses success when cleanup is unverifiable.
- [x] Final information and quadrant placement match the manuals without changing checkpoint counts/thresholds.
- [x] Unknown/customer-only employee evidence does not publish passed employee checkpoints, official grades, policy points or employee-specific coaching.
- [x] Model complete=true cannot override unverified persisted transcription completeness, including analysis retries and legacy live records.
- [x] Raw model output stays distinguishable from effective guarded/reviewed output.
- [x] Workflow dispatch failure leaves a retryable state without overwriting a newer version or resurrecting deletion.
- [x] Re-service intent/promise alone never appears as Follow-up agreed.
- [x] Uploads with no AI key remain Awaiting AI without invented transcript, analysis, score or dispatched provider job.
- [x] Final verification/evidence correspond to the committed application revision.

## External gates after this slice

Server-key replacement; ongoing invited owner/reviewer provisioning; reconciliation of the two existing SQL-editor migrations plus deliberate hosted application of the new reviewed migration; Groq account/model/quota/ZDR/no-training verification; trusted source completeness/attribution and sanitation release; a new real-provider fictional recording; authorized commercial hosting and deployed recovery/deletion/access checks; all-20-call private evaluation; private GitHub and sanitized Loom submission; end-of-test deletion with log/backup retention handling.

None of these gates is closed by fixtures, the new local tests, a build or the old 31 hosted keyless checks.
