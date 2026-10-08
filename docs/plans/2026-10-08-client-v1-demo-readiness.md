# Client V1 Demo Readiness Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement Tasks 1–7 sequentially in the existing standalone checkout. One editing owner; no subagents. The human explicitly requested this work be sent to the existing implementation chat. Do not stop after another plan or restart approval for the established product scope. Task 8 records the remaining external acceptance steps; its account/provider/deployment actions are outside this keyless execution slice.

**Goal:** Finish the client's requested recording → transcript → purpose/outcomes → appropriate scorecard → useful coaching → call-review flow, and prepare an accurate demonstration and submission handoff.

**Architecture:** Extend the existing Next.js application, protected Supabase payloads, deterministic rubric engine, Groq adapter and identifier-only Vercel workflow. Add a small, audited source-verification path because ordinary ASR currently supplies unknown speakers; re-analysis must use the verified source revision. Exercise the actual local sample APIs with a separate datastore and empty provider/backend environment overrides, keeping that evidence separate from a newly uploaded recording processed by the real provider on the deployed app.

**Tech stack:** Existing pinned Next.js/TypeScript/React/Tailwind, Supabase, Groq, Workflow SDK, Vitest, Playwright and axe. Preserve the approved Calm workspace design and current custom controls; do not replace the stack or add another AI vendor.

## 1. Human direction and source authority

Latest direction: “Okay please re3view then send back another set of work to make it ready for a client demo.” When asked about the demonstration target, the human replied: **“Just the things that the client is asking for.”** The target is the client's V1, not additional analytics, a redesign, or a fixture-only completion claim.

The [original build instructions](https://docs.google.com/document/d/1UWDypghFlDjjjsRX3yO9zmiy0FWdfMsx-zfTmNVVZZk/edit) were fetched again during this review. They request seven minimum capabilities and a deployed usable app, source/GitHub, a short Loom, and a README explaining architecture/setup/limitations/next steps. Standalone code is allowed; the interface should feel native to PestLaunch. Accuracy/reliability, UX/design, product judgment and engineering/execution are the evaluation priorities.

Read `AGENTS.md`, `IMPLEMENTATION_PROMPT.md`, `docs/specs/product-design.md`, `docs/plans/implementation-plan.md`, `docs/context/source-register.md`, `docs/scoring-policy.md`, and this plan before editing. The original plan remains the full release target; this is the next bounded implementation slice. Use the manuals as rubric authority. Do not open customer recordings or full private transcripts during this slice.

| Existing requirement | Client demonstration evidence | Work in this round |
| --- | --- | --- |
| R01 Process a recording | A new recording completes the actual deployed pipeline | Repair active-state recovery and re-analysis; finish local contracts. Actual provider/deployed run remains Task 8 |
| R02 View transcript | Authorized reviewer reads timestamped segments and seeks prepared private audio | Add audited speaker/completeness review; retain protected playback and honest text-only fixtures |
| R03 Identify purpose | Primary sales/general/retention/unknown and secondary intents | Retain existing model contract; verify examples and review presentation |
| R04 Extract outcomes/details | Inspection, treatment, agreement, payment and account promises are independently evidenced | Repair examples and exercise outcome/evidence presentation |
| R05 Appropriate score/grade | Exact Sales 17, General 12, Retention 12; evidence; uncertainty withholds grade | Correct fixtures, verified-source re-analysis, safe reviewer evidence, immutable originals |
| R06 Useful coaching | Specific employee strength/improvement, checkpoint, quote and better response | Correct example coaching; re-analysis uses trusted speaker roles; unsupported coaching stays withheld |
| R07 Simple review interface | Persisted call log, search/filter/back, needs-review, correction/history | Actual local API/browser journeys and focused usability fixes |
| R08–R12 Design/privacy/delivery/reliability/deletion | Coherent responsive UI, private access, deployed/source/Loom, recovery, verified cleanup | Existing boundaries retained; local checks and concrete delivery runbook; external acceptance remains explicit |

## 2. Reviewed baseline and actionable findings

- Checkout: `C:/Users/Admin/Desktop/Projects/Portfolio/PestLaunchCallIntelligence`, branch `codex/call-intelligence`.
- Reviewed application: `ae76bcb87b86f8f7499a7fce3347f98f7b3d4c29`; clean documentation HEAD: `5b514f63bb8702b3cd6859dedc14efe4cc6fa969` before adding this plan.
- The previous three repairs are present: pending bulk-deletion retries, durable processing-attempt ownership, and disjoint default/mocked browser discovery. Earlier independent review ran 125 tests, lint and typecheck successfully. This planning turn additionally ran the claim/workflow/test-data focused set: 25 tests passed in three files. Neither result proves hosted AI or deployment.

**DEMO-01, P2: delayed claim still displays failed.** `src/lib/jobs/processing-claim.ts` claims a restored failed/pending attempt, clears its error and marks it running, but does not restore its active call status. With existing segments, transcription immediately returns, so analysis can run while the UI still displays failure and offers no retry. Reproduced with the actual helpers over fictional in-memory state: failed + `PROCESSING_START_FAILED` + pending becomes failed + null error + running.

**DEMO-02, accuracy: fixture grades and citations disagree with production guards.** `src/lib/samples/fixtures.ts` chooses assessment evidence by rubric index rather than checkpoint meaning. Actual `sampleCall` → `guardAssessment` → `computeScore` review gave:

| Example | Current displayed score | After production evidence guard | Specific defect |
| --- | --- | --- | --- |
| Service | 12/12 Gold | 8/12, four unresolved, grade withheld | Confidence/investigate/solution-expectation/consensus cite customer speech |
| One-time | 15/17 Green | 12/17, three unresolved, grade withheld | Confidence/investigate/consensus cite customer speech |

Both examples award `final_information` from closing/booking text without the manual's future-service guidance; Sales also needs referral information. Existing follow-ups all say promised even where the customer explicitly accepts a visit. Some improvement copy contradicts an existing summary. These examples must become internally accurate, clearly fictional illustrations.

**DEMO-03, functional gap: uploaded calls cannot establish employee attribution.** The ASR adapter correctly emits unknown roles and unverified completeness. There is currently no trusted source-review endpoint; a checkpoint reason cannot resolve this. The conservative guards therefore withhold employee passes/coaching and official grades. Implement a small manual verification path and re-analysis, rather than inventing diarization, silently trusting the model, or adding a second provider.

**DEMO-04, verification gap: actual app walkthrough is not isolated.** Default Playwright and HTTP tests target port 3000 and the ordinary sample datastore. Their fresh full journeys were deliberately not run against the configured backend. The six recent browser passes mock APIs. Build a separate actual-API sample harness before running the full local walkthrough.

**DEMO-05, submission gap: live evidence and artifacts remain pending.** No deployed recording run, private remote repository, Loom or agreed deadline is verified. `docs/submission.md` still asks to select a Supabase organization although the dedicated project already exists. Correct the stage descriptions and prepare exact acceptance and demo instructions.

## 3. Execution boundaries

- Execute locally, sequentially, in this checkout. Preserve unrelated work. No root reset/clean/stash/branch switch; no worktree is needed for the clean standalone repository. Use small owned commits.
- Keep `GROQ_API_KEY` empty and `REAL_CALL_PROCESSING_ENABLED=false`. Do not inspect secret values or change `.env.local`. Inject fictional provider responses in tests; never substitute results for an uploaded real recording.
- No hosted acceptance/cleanup scripts, migration application, key rotation, provisioning, actual provider requests, customer audio, deployment, purchases, source push, GitHub creation, recruiter START or client messages in Tasks 1–7.
- Dedicated Supabase project exists: `qwrukdqtuhqkbrbtnekz`, Projects organization `tqzukvtntitbbjoatxet`, Sydney Free. No new project selection is needed. Earlier exposed server-key material must be replaced before further hosted use. Migration `20261008114517_bind_source_upload_to_registered_path.sql` remains local/unapplied; earlier SQL-Editor applications require history reconciliation. Do not blindly reapply them.
- `.private/`, secrets, recordings, full customer transcripts, signed URLs and customer-bearing screenshots remain outside Git. CALL-013 stays quarantined. An upload attestation or sanitized-bucket copy is not proof of automatic redaction.
- Preserve missing rep/direction/original call time. Upload time is not call time. No fabricated CRM completion, revenue, representative rankings, dates or confidence percentages.
- Review → fix → review on the owned revision, at most three repair rounds for a persistent issue; then report its exact cause. Finish independent work before reporting specific external prerequisites.

## Task 1 — Restore truthful active status when a delayed worker claims

**Modify:** `src/lib/jobs/processing-claim.ts`.
**Tests:** `tests/unit/processing-claim.test.ts`, `tests/integration/workflow-publication.test.ts`, `tests/e2e/processing-recovery.mocked.spec.ts`.

- [x] Add a failing regression using the actual claim helper: begin with failed status, `PROCESSING_START_FAILED`, a pending attempt, and existing segments; claim and inspect persisted state. Repeat with no segments. Preserve existing competing-owner/deletion/outage tests.

```ts
// Extend the existing setup to accept/replace the starting CallRecord.
// No-segments variant expects queued; existing-segments variant expects analyzing.
expect(saved.status).toBe(saved.segments.length ? "analyzing" : "queued");
expect(saved.errorCode).toBeNull();
expect(saved.processingAttempt).toMatchObject({ state: "running", runId: "run-a" });
expect(retryAvailable(saved)).toBe(false);
```

- [x] In the same successful CAS that claims the pending attempt, explicitly restore its status:

```ts
const claimed = {
  ...call,
  status: call.segments.length ? ("analyzing" as const) : ("queued" as const),
  processingAttempt: {
    ...call.processingAttempt,
    id: attemptId,
    state: "running" as const,
    runId,
  },
  errorCode: null,
  version: call.version + 1,
};
```

- [x] Verify workflow publication with the restored-failed starting state and existing segments; active UI must say analyzing rather than failed. A different run still cannot steal ownership. Do not add age-based running-attempt reclamation.
- [x] Run `npm test -- tests/unit/processing-claim.test.ts tests/integration/workflow-publication.test.ts`; expected all focused tests pass. Commit only this repair and tests.

## Task 2 — Make the four fictional examples accurate and evidence-backed

**Modify:** `src/lib/samples/fixtures.ts`; extract `src/lib/samples/assessments.ts` if it keeps the fixture factory small.
**Create:** `tests/unit/sample-integrity.test.ts`.
**Retain:** `src/lib/scoring/rubrics.ts`, fixed denominators/thresholds, current four sample options.

- [x] Write failures that iterate the four actual sample records and validate evidence, complete rubric membership, employee-only pass/coaching quotes, and guarded scores.

```ts
for (const option of SAMPLE_OPTIONS) {
  const call = sampleCall(option.id, `fictional-${option.id}`);
  const original = structuredClone(call.originalAnalysis!);
  expect(validateEvidence(call.analysis!, call.segments)).toEqual([]);
  const effective = guardAssessment(call.analysis!, call.segments, assessmentContext(call));
  expect(effective.assessments).toEqual(call.analysis!.assessments);
  expect(effective.coaching).toEqual(call.analysis!.coaching);
  expect(computeScore(effective)).toEqual(call.score);
  expect(call.originalAnalysis).toEqual(original);
}
```

- [x] Replace index-derived assessment evidence with explicit checkpoint → status/reason/segment IDs/quote records. Require every checkpoint exactly once. No default pass for an unlisted checkpoint. A missed checkpoint needs known-complete evidence and a meaningful absence explanation; unresolved applicability stays unknown/not_applicable.
- [x] Review each mapping against `RUBRICS` and the authoritative manual guidance. Keep a valid, fully assessable general-service example and partial inspection/retention examples. Do not target a flattering grade. The existing service ending lacks future-service information: either deliberately score that checkpoint missed with complete evidence or explicitly extend the fictional dialogue with that guidance. Sales cannot pass it without both future-service and referral guidance.
- [x] Correct one-time summary/coaching contradictions. A recurring-plan objection is still an objection; never activate no-objection points for this example. In inspection, the four-point rule still needs complete attributable dialogue and reliable no-objection evidence; the inspection stage's pricing/applicability uncertainty still withholds the grade.
- [x] Accepted visit follow-ups cite the employee proposal plus explicit customer acceptance. A cancellation referral remains promised; account closure/payment/signature remain unverified unless the fictional text explicitly establishes the respective outcome. Label pests/causes as customer reports.
- [x] Construct effective sample assessments through the same guard/scorer as live assessments; preserve a separate immutable original. This prevents the fixture UI from bypassing production evidence rules. Keep sample/text-only/fictional labels and null source metadata.
- [x] Add semantic assertions for final information, acceptance/promise, payment and coaching, then run `npm test -- tests/unit/sample-integrity.test.ts tests/unit/outcomes.test.ts tests/unit/rubric-authority.test.ts tests/unit/assessment-guards.test.ts`. Update old tests that assumed arbitrary scores; retain the same behavior checks. Commit.

## Task 3 — Add a minimal audited transcript-source verification contract

**Modify:** `src/lib/domain/types.ts`, `src/lib/domain/schemas.ts`, `src/lib/domain/assessment-guards.ts`, `src/app/api/calls/upload-intent/route.ts`, `src/workflows/process-call.ts` at first transcript publication.
**Create:** `src/lib/domain/source-review.ts`, `src/app/api/calls/[callId]/source-review/route.ts`, `tests/unit/source-review.test.ts`, `tests/integration/source-review-routes.test.ts`.

This is an annotation/attestation step, not automated redaction or transcript editing. Keep text, segment IDs and timestamps fixed. Mixed-speaker/inaudible segments can remain unknown; that uncertainty must remain visible. No bulk “mark everything employee” shortcut.

- [x] Add optional payload fields with safe legacy defaults. Existing JSONB persistence and analysis-version snapshots can hold them; a schema migration is not required merely to add these fields.

```ts
// CallRecord additions; absent numeric revisions mean zero.
sourceRevision?: number;
analysisSourceRevision?: number;
originalSegments?: Segment[]; // first ASR/source snapshot, never overwritten by review
latestModelAnalysis?: Analysis | null; // latest raw model result; originalAnalysis stays first raw result
sourcePreparation?: {
  checksum: string;
  attestedBy: string;
  at: string;
  kind: "synthetic" | "privately_redacted";
};
sourceReviews?: {
  id: string;
  sourceRevision: number;
  previousVersion: number;
  sourceChecksum: string | null;
  userId: string;
  at: string;
  reason: string;
  changes: { segmentId: string; previous: Segment["speaker"]; next: Segment["speaker"] }[];
  completenessVerified: boolean;
  qualityVerified: boolean;
}[];
```

- [x] Preserve the first ASR segments before annotations. For older records, take a one-time snapshot of their existing source and document its legacy provenance. Do not label a later review as original ASR.
- [x] Persist the already-required upload preparation attestation using the authenticated owner's ID, server time, admitted checksum and source kind. It records a claim about private preparation, not certified detection/redaction. Do not infer preparation for legacy real calls.
- [x] Define the strict source-review request below. Flags are explicit affirmative statements the reviewer makes after checking the entire privately prepared recording against the transcript; false preserves the unresolved condition. Reason is required. Never accept source paths, workspace IDs, user IDs, timestamps, scores or raw analysis from the request.

```ts
export const sourceReviewSchema = z.strictObject({
  version: z.number().int().positive(),
  roles: z.array(z.strictObject({
    segmentId: z.string().min(1).max(100),
    speaker: z.enum(["employee", "customer", "unknown"]),
  })).max(5000),
  completenessVerified: z.boolean(),
  qualityVerified: z.boolean(),
  reason: z.string().trim().min(10).max(800),
});
```

- [x] Implement a pure source-review transition with tests first. Reject duplicate/unknown segment IDs; reject stale version; require at least one segment. Apply only supplied role changes, append server-owned audit, increment source revision and version via CAS. Preserve raw segments, original/latest model results, all checkpoint decision history and source metadata.
- [x] Live route requires authenticated workspace membership and same-origin mutation. Owner/reviewer may verify. Reject privacy-held/tombstoned/upload-pending records and pending/running attempts or queued/transcribing/analyzing work. Allow a settled failed record with a persisted transcript and safe media to be verified for retry. Source review itself makes no provider/Storage effects.
- [x] Live verification requires admitted preparation bound to the current checksum and a protected prepared-media path. Real calls additionally require the real-processing gate. Legacy real calls without the preparation record remain held for private preparation/re-upload. Samples can exercise annotation contracts on fictional text, but must never claim a reviewer listened to nonexistent fixture audio.
- [x] Resolve only the source-owned completeness/quality reasons actually attested in this request. Unknown roles still create an attribution reason. Preserve unrelated applicability, privacy and model-content review reasons. Saving annotations always marks existing analysis stale and withholds its official grade until re-analysis; a reason/checkbox alone never generates a new AI result.

```ts
export const analysisCurrent = (call: CallRecord) =>
  !!call.analysis && (call.analysisSourceRevision ?? 0) === (call.sourceRevision ?? 0);
// Stale transition must preserve the previous analysis for labelled history,
// add "Transcript source changed; re-analysis required.", and compute a null grade.
```

- [x] Route tests: anonymous/foreign-origin/other-workspace rejection, owner/reviewer success, malformed flags/duplicate IDs/stale version, active/privacy/tombstone rejection, legacy preparation failure, immutable source/originals, unresolved quality/roles, zero provider calls and no-store responses.
- [x] Run `npm test -- tests/unit/source-review.test.ts tests/integration/source-review-routes.test.ts tests/unit/assessment-guards.test.ts`; expected pass. Commit the source contract independently.

## Task 4 — Re-analyze the verified revision without losing originals or ownership

**Create:** `src/app/api/calls/[callId]/reanalyze/route.ts`, `tests/integration/reanalysis.test.ts`.
**Modify:** `src/workflows/process-call.ts`, `src/lib/groq/provider.ts`, `src/lib/domain/processing-attempt.ts` only where needed, `src/app/api/calls/[callId]/review/route.ts`, `src/lib/domain/schemas.ts`, workflow/provider/route tests.

- [x] Write an injected-port integration regression: initial ASR unknown/unverified → partial assessment/no employee coaching → audited speaker/completeness/quality review → old grade still withheld → actual workflow invokes the injected analysis provider with the new roles/source context → deterministic appropriate score/coaching. Preserve initial raw model and ASR snapshots byte-for-byte. This is provider-contract evidence, not live AI evidence.
- [x] Owner-only re-analysis accepts `{ version }`, verifies same origin/workspace, a persisted transcript, settled ownership, valid preparation/privacy and stale source analysis. Empty key returns `AI_NOT_CONFIGURED` before dispatch or mutation; no synthetic replacement response. Reviewers can verify/review but cannot initiate billable processing under the existing owner policy.
- [x] Dispatch through the durable pending-attempt helper. Use identifiers only in workflow arguments/return values. No second job launcher or raw content in durable step returns. Existing segments skip ASR; analysis runs for the new source revision.

```ts
// Replace the unconditional existing-analysis shortcut with this condition.
if (analysisCurrent(call)) {
  // Existing ownership-safe completion/restored ready-or-needs-review behavior.
  // Do not call the provider again for the already-published source revision.
}
// A stale existing analysis must proceed to provider analysis using call.segments.
```

- [x] Pass trusted source completeness as explicit context in the provider's user payload, alongside role-labelled segments. Explain in the fixed system instruction that reviewer verification is source context, not a command to pass checkpoints. Do not force the model's `complete` to true or override an unresolved semantic/applicability reason. Preserve privacy minimization.
- [x] Publish only if current attempt/run, source revision and version still match. Set `analysisSourceRevision` to the source revision analyzed; store current raw result as `latestModelAnalysis`; initialize `originalAnalysis` only if absent. Effective analysis comes from guards plus currently unresolved source reasons, then the deterministic scorer. Preserve prior manual decisions as history; do not blindly replay their statuses onto different source/model output.
- [x] Reject checkpoint-review mutations during pending/running/active processing and while analysis is stale. This prevents an editing race from stranding a running attempt or treating an old scorecard as current. Use CAS for both review and re-analysis dispatch.
- [x] Extend checkpoint review with an optional evidence selection `{ segmentIds, quote }`. A passed correction requires exact actual employee evidence on the verified source. Invalid IDs, customer-only quote, arbitrary text or a reason alone cannot bypass the guard. Absence-based misses still require complete reliable source; unresolved applicability keeps the original denominator and withholds the grade. Preserve the original model output and append decision audit tied to the reviewed source revision.
- [x] Tests cover: keyless no dispatch, stale request, reviewer dispatch denied, failure/retry retains source/originals, current result skips repeated analysis, stale result performs analysis once per owned attempt, duplicate/old run denied, version/source conflict cannot publish, deletion cannot resurrect, unknown roles/quality/model uncertainty cannot earn official grade/no-objection points, guarded reviewer evidence, and existing upload/retry behavior.
- [x] Run focused source/re-analysis/workflow/provider/review/claim suites. No network/provider calls. Commit.

## Task 5 — Finish the client review flow in the existing interface

**Modify:** `src/components/call-detail.tsx`, `src/components/call-list.tsx`, `src/components/workspace-shell.tsx`, existing global styles and protected overview aggregation only as needed.
**Create:** `src/components/transcript-source-review.tsx` to keep the source-review form separate; `tests/e2e/source-review.mocked.spec.ts`.

- [x] Add a compact “Review transcript” action in the transcript area with per-segment Employee/Customer/Unknown controls, explicit completeness and quality confirmations, a required reason, Save and Cancel. Explain exactly what the reviewer attests. Use existing protected prepared-media playback; no raw/source playback shortcut.
- [x] Show missing verification as “Speaker review needed”/“Transcript needs review,” and source changes as “Transcript updated — analysis needs to run again.” Retain prior results in clearly labelled history. List/detail/overview must not present their old grade as current or count stale grade coverage as accepted.
- [x] After saving, reload the versioned record. Owners get “Re-analyze” where appropriate; empty-key state explains that analysis is unavailable without producing results. Reviewer can save verification and see the owner action requirement. Do not expose secret values, technical stack detail or provider prompts in ordinary UI.
- [x] Let checkpoint review select actual transcript evidence for its correction; show the selected quote and timestamp before Save. Preserve original-versus-current decision history and disclose its source revision. A stale dialog refreshes safely on 409 rather than losing/replaying the decision.
- [x] Verify the primary journey: result → separate outcomes → scorecard → timestamped evidence → coaching → transcript → reasoned review → history → filtered call log. Preserve search/filter/back and next/previous navigation within that filter. Fix only defects observed along this journey; do not add charts, dashboards, report exports, CRM integrations or new product modules.
- [x] Scope polish to hierarchy/readability, realistic empty/loading/failure/partial states, focus restoration/dialog Escape, 44 px touch targets, reduced motion and responsive panels. Keep restrained blue/neutral visual language, local fonts and the existing navigation. Do not call text-only fixture evidence recording playback.
- [x] Mocked live UI checks: unknown speakers, safe verification form, stale grade, owner re-analysis, reviewer restriction, 409 refresh, analysis failure and preserved history. Unexpected API/external requests still fail; all content explicitly fictional. Commit after focused UI checks and typecheck.

## Task 6 — Verify an isolated actual local application journey

**Create:** `src/lib/server/sample-paths.ts`, `scripts/run-isolated-sample.mjs`, `scripts/test-isolated-http.mjs`, `tests/unit/sample-paths.test.ts`.
**Modify:** `src/lib/server/auth.ts`, `src/lib/server/repository.ts`, `playwright.config.ts`, `tests/e2e/workspace.spec.ts`, `tests/integration/http.test.ts`, `package.json`; share safe launcher code with `scripts/run-isolated-preview.mjs` only if useful.

- [x] Add one server-only sample-root resolver used by both datastore and HMAC session key. A launcher-selected root must resolve within this repository's ignored `.private/qa/` or `.private/demo/`; reject escaping/traversal/absolute outside paths. Ordinary development can retain `.private/app/` as its default. Do not accept this path from HTTP and do not enable sample mode in production/configured Supabase.
- [x] Launcher creates a fresh UUID run root, separate Next build directory and fresh empty sample state. Bind loopback port 3002 for actual sample tests and port 3003 for an optional repeatable presenter walkthrough. Override public Supabase URL/publishable key, server secret key and Groq key with empty strings; real processing false, matching `APP_ORIGIN`, `NEXT_TELEMETRY_DISABLED=1`, dedicated sample root and dist dir. Fail if the port is occupied; never reuse another server. Do not edit/read `.env.local` values.
- [x] Process cleanup stops only the launcher-owned process tree using native Windows operations and tracked process IDs. Any optional filesystem cleanup must verify the resolved UUID directory remains inside its intended ignored root. Retain fictional failure evidence when useful; no deletion of `.private/app/`, customer context or arbitrary paths.
- [x] Default `npm run test:e2e` uses this isolated actual-API server with `reuseExistingServer:false`, one worker and mocked specs excluded. Remove hard-coded port-3000 Origin headers. Existing `test:e2e:mocked` remains separate port 3001 with explicit API mocks.
- [x] Wrap `npm run test:http` so it owns the isolated server lifecycle, waits for readiness, passes a validated loopback base URL and stops its own server. Direct HTTP suite execution without the harness base URL must fail closed rather than default to port 3000. Readiness polling is bounded and surfaces child startup failure. Run HTTP and browser mutation suites sequentially with fresh independent run roots.
- [x] Actual API/browser checks must create examples through `/api/session` and `/api/calls`, not API interception. Confirm corrected outcomes/score/evidence, meaningful review, immutable original, reload persistence, stale-version conflict, filtered return, transcript search, inaccessible deleted call/media and actual owner count refresh. Do not fabricate recorded audio or make a live upload appear processed.
- [x] Exercise 320/390/768/1024/1440 widths, all four detail tabs, login/log/review/data controls and new form. Run axe serious/critical checks; manually inspect keyboard focus, dialog Escape/return and reading hierarchy. CSS zoom checks may supplement layout evidence but are not native browser zoom certification; record an actual 200% browser zoom check if available, otherwise keep it pending.
- [x] Optional `npm run demo` starts the isolated actual sample app on port 3003. It provides a repeatable local review walkthrough; ordinary existing Add fictional call controls are sufficient. Start with fresh data each launch and clear labels. Do not introduce a hosted demo backdoor or reset endpoint.
- [x] Run the resolver tests, `npm run test:http`, `npm run test:e2e`, then `npm run test:e2e:mocked`. Expected all pass with no unexpected provider/hosted/external traffic; verify the owned listener stops afterward. Restore only generated `next-env.d.ts` imports changed by QA, preserving any unrelated file edits. Commit.

## Task 7 — Prepare the exact client demonstration and submission package

**Create:** `docs/demo-script.md`, `docs/client-requirements-matrix.md`, `docs/evidence/client-v1-demo-checklist.md`.
**Modify:** `README.md`, `docs/submission.md`, `docs/architecture.md`, `docs/scoring-policy.md`, `docs/privacy.md`, `docs/evidence/progress.md`, and the current phase note in `docs/plans/implementation-plan.md`.

- [x] Correct stale current-stage statements: implementation chat already exists, dedicated Supabase project is already selected, third migration is unapplied, exposed server key must be replaced before hosted use, live provider/deployment/private source/Loom are unverified. Preserve historical evidence as historical. No fabricated links, acceptance checkboxes, deadline or scores.
- [x] Requirements matrix uses R01–R12 and separate columns: implemented; local actual app tested; injected provider tested; real provider tested; deployed tested; exact evidence/revision; pending action. R01 and R10 cannot be closed by samples or a successful build.
- [x] Write a 4–5 minute client-focused script with this sequence:
  1. State the purpose: reviewers understand what happened, how the employee performed and what to improve.
  2. Upload a new privately prepared fictional spoken recording in the deployed app and show its genuine processing state. This segment is pending until Task 8 passes; do not substitute a precomputed sample.
  3. Open purpose/secondary intents, key facts and independently evidenced outcomes; explain one meaningful ambiguity.
  4. Inspect the timestamped transcript/prepared recording and scorecard; show fixed denominator, evidence, and why unknown evidence withholds grade. If attribution review is needed, show that minimal review and re-analysis honestly.
  5. Show one specific strength and improvement/suggested response with evidence, then a reasoned correction and preserved history.
  6. Return to searchable/filterable call log, close with architecture/decisions/limitations/next steps. Keep any deletion demonstration on disposable fictional data; no end-of-test customer deletion until the test is complete.
- [x] Include a clearly separate local walkthrough using `npm run demo` while external acceptance is pending. It is useful presentation/UX evidence but does not satisfy the client's recording-processing submission.
- [x] README gives exact keyless/local setup commands and real deployment prerequisites, owner/reviewer boundaries, upload limits, source-review behavior, no automatic redaction/diarization, rubric rules, retention/deletion limits and architecture. Supply a sanitized source-delivery checklist and concise Loom talking points. Do not publish/record/send them in this slice.
- [x] Final full verification on the owned application revision: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, actual isolated HTTP/E2E suites and separate mocked suite, `git diff --check`. Once the suite passes, do not repeat it without new changes/failures. Record exact counts/commands and revision; distinguish actual APIs, mocks, embedded SQL and injected Groq responses.
- [x] Self-review source guards, ownership/version fencing, unchanged rubric totals, immutable originals, retained source uncertainty, protected access, tombstone/deletion behavior, production sample disablement and all seven minimum requirements. At most three rounds for a persistent issue; report specific residuals.
- [x] Commit app/test/config changes in focused commits and documentation separately if necessary. Report application revision, documentation HEAD, clean/dirty status, completed tasks, precise test evidence, remaining external gates and whether a deployed client demonstration is actually ready. Do not claim live AI or client-demo-ready from these local tasks alone.

## Task 8 — Remaining external client acceptance, prepared but not executed here

This is the completion checklist for the original client request. Finish Tasks 1–7 first. Under the current explicit empty-key/local execution boundary, record the needed concrete account/privacy actions and return them for the human's next direction. Do not invent a new organization choice, duplicate the dedicated project, or restart product-scope approval.

- [ ] Replace the previously exposed server key before further hosted access; confirm the server/browser credential boundary without printing values.
- [ ] Reconcile remote migration history and deliberately apply the exact-path admission migration under authorized access. Verify private buckets, workspace RLS, anonymous/cross-workspace rejection and invited owner/reviewer accounts. Do not run old scripts against an uncertain remote revision.
- [ ] Confirm an authorized existing Vercel Pro/commercial team/project and actual cost; no automatic subscription purchases/upgrades. Confirm deployed environment/origin and durable Workflow execution/recovery/log handling.
- [ ] Human supplies/configures Groq server key and verifies current model availability/free quota, organization Zero Data Retention/no-training and exceptions for each used feature. No paid API cap is authorized; stay within free quota or ask for a concrete total cap only if necessary after independent work is complete. Primary references: [speech transcription](https://console.groq.com/docs/speech-to-text), [structured output](https://console.groq.com/docs/structured-outputs), [data handling](https://console.groq.com/docs/your-data). Their existence does not verify account settings.
- [ ] First real-provider input is a newly recorded, clearly fictional **spoken conversation** with known expected facts and rubric behavior. Silence/container bytes can validate file admission but do not demonstrate transcription or analysis. Use approved accounts, private Storage and the deployed interface; record IDs/revision/timings/content-free evidence.
- [ ] Verify actual upload → persistent stages → transcript → correct purpose/outcomes → source review if needed → correct deterministic score/grade when applicable → employee coaching → authenticated playback → reasoned correction/history → reload/log. Confirm unknown fields, no guessed dates/rep, no false payment/signature/account closure and honest unresolved grades.
- [ ] Verify deployed auth/role/other-workspace denial, duplicate recording behavior, provider failure/retry, duplicate/stale run publication fences, deletion during processing and disposable fictional source/derivative/analysis/review cleanup. Inspect content-free workflow/log state and actual backup/retention policy; fixture/Storage mocks are not backup deletion evidence.
- [ ] Real customer testing is separately privacy-gated: authorized private preparation, CALL-013 full payment-exchange redaction/verification, no training/retention-sharing, and protected access. Evaluate the supplied calls against the manuals privately, documenting errors/uncertainty rather than assigning grades from context notes. Never commit/upload public customer content or use it in an unsanitized Loom.
- [ ] Create/push an authorized **private** GitHub repository and verify source contains no secrets/private content; use the intended account and repository visibility. No remote exists today. Produce a short sanitized Loom and actual deployed/source links; check usable reviewer access. Recruiter START/deadline/client submission messages remain human administrative actions unless explicitly requested.
- [ ] After the full test is complete, perform authorized source/derivative/transcript/analysis/review/local-context/provider/backup deletion and verify the retention policy/receipts. Do not execute customer end-of-test deletion prematurely.

**Client-demo acceptance:** The client can use the deployed app under an authorized reviewer account to inspect the result of a newly uploaded recording processed by the actual provider, with the seven requested capabilities, truthful uncertainty and appropriate grades/coaching. Local sample walkthroughs, injected contracts, screenshots, configured keys and a successful deploy alone do not meet this condition.
