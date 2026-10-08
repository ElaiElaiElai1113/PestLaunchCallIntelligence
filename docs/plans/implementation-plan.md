# PestLaunch Call Intelligence Implementation Plan

> For agentic workers: use `superpowers:executing-plans` and implement sequentially in this standalone checkout. Do not use subagents unless the human explicitly requests them. Track each checkbox and fresh evidence.

**Goal:** A private deployed V1 that processes a new recording into a timestamped transcript, correct call outcome, inspectable scorecard and specific coaching.

**Architecture:** Next.js frontend and server API on Vercel; Supabase Auth/Postgres/private Storage for persistent data; Groq for both transcription and structured analysis; Vercel Workflows for durable orchestration. Customer content never appears in public assets, workflow state, Git or ordinary logs.

**Tech stack:** Next.js App Router, TypeScript, Tailwind, customized shadcn/ui, Lucide, TanStack Query, Zod, Supabase, Groq SDK, Vercel Workflow SDK, Vitest, Playwright and axe. Verify and pin compatible versions in Task 1.

This supersedes the earlier FastAPI/SQLite/Ollama/Render plan. Full implementation is authorized in the requested GPT-6.1 Sol Medium chat; provider/account/cost/privacy checks remain real execution prerequisites rather than assumed facts.

## Boundaries and evidence

Root: `C:/Users/Admin/Desktop/Projects/Portfolio/PestLaunchCallIntelligence`; branch `codex/call-intelligence`. No edits to other client repositories. One editing owner. No customer outreach, recruiter START message, paid subscriptions, paid API usage, public source/data, unrelated integrations or quota bypass.

Use a dedicated Supabase project after selecting its organization and confirming actual cost as required by its connector. Use an existing authorized Vercel Pro workspace or a specifically approved commercial plan. Groq free quota is the initial budget. Account visibility is not setup evidence. Complete independent local work while resolving external prerequisites.

Evidence ledger: `docs/evidence/progress.md`; customer-bearing evidence goes only to ignored `.private/`. Track implementation, local tests, synthetic real-provider tests, real-call review and deployed acceptance separately. The synthetic design fragment is not the app.

## File responsibilities

```text
src/app/(auth)/login/page.tsx                       private sign in
src/app/(workspace)/layout.tsx                     authenticated application shell
src/app/(workspace)/overview/page.tsx               owner counts and attention
src/app/(workspace)/calls/page.tsx                  searchable/filterable call log
src/app/(workspace)/calls/[callId]/page.tsx          call workspace
src/app/(workspace)/review/page.tsx                 unresolved assessments
src/app/(workspace)/settings/data/page.tsx          deletion and retention controls
src/app/api/calls/{upload-intent,finalize}/route.ts  authorized direct-upload lifecycle
src/app/api/calls/[callId]/{route.ts,retry/route.ts,reprocess/route.ts,review/route.ts,media/route.ts}
src/app/api/overview/route.ts                       safe aggregation
src/app/api/test-data/route.ts                      owner-only deletion
src/components/{app-shell,status-badge,empty-state,error-state}.tsx
src/features/calls/{call-log,call-detail,recording-player,transcript-pane,summary-panel,scorecard-panel,coaching-panel}.tsx
src/features/upload/{upload-dialog,processing-status}.tsx
src/features/review/{review-queue,decision-form}.tsx
src/lib/supabase/{browser,server,admin}.ts            distinct credential boundaries
src/lib/auth/{require-user,workspace-access}.ts     verified identity and membership
src/lib/domain/{schemas,outcomes,evidence,dates}.ts strict shared contracts
src/lib/scoring/{rubrics,engine,applicability}.ts    fixed standards and arithmetic
src/lib/groq/{client,transcribe,analyze,coach}.ts    sole hosted AI integration
src/lib/privacy/{redactions,media,retention}.ts      sanitized outputs and deletion
src/lib/jobs/{repository,idempotency}.ts            durable state and conflict control
src/workflows/{process-call,delete-call}.ts         stages with safe ID-only state
src/styles/{tokens,globals}.css                    PestLaunch visual system
supabase/config.toml                              local backend configuration
supabase/migrations/                              CLI-generated reviewed schema changes
scripts/{seed-test-users,import-private-calls,verify-deletion}.ts
tests/unit/{scoring,outcomes,evidence,dates,redaction,jobs}.test.ts
tests/integration/{rls,storage,review,deletion}.test.ts
tests/e2e/{upload,review,privacy,accessibility}.spec.ts
docs/{architecture,scoring-policy,privacy,submission}.md
```

## Shared domain contract

`CallStatus`: queued, privacy_preflight, transcribing, privacy_review, analyzing, scoring, ready, needs_review, failed, deleting, deleted.

`Purpose`: sales, general, retention, unknown. Secondary intents include scheduling, billing, re-service, complaint, arrival-coordination and inspection.

Every segment has stable ID, start/end milliseconds, sanitized text, speaker/channel/role where supported and quality/completeness flags. `recordedAt`, `direction` and `repId` are nullable; `uploadedAt` is independent. Every fact, outcome or checkpoint carries segment IDs plus certainty/provenance.

Independent outcome fields: quoteProvided, inspectionBooked, treatmentAccepted, agreementSigned, paymentCollected, cancellationRequested, cancellationAccepted, retentionSaved. Each is true/false/null with evidence. Do not collapse them into a single won/lost flag.

Checkpoint status: passed, missed, policy_award, unknown, not_applicable. `score`: rubric, points, original denominator, unresolved count, nullable official grade. Follow-ups carry promised/accepted/reported_completed/unknown, nullable owner, source due-text and only a verified absolute date. Analysis versions record provider/model, prompt, schema, rubric and redaction versions.

Workflow steps load/store content inside the protected app boundary and return object/version IDs only. No transcripts/prompts/model responses in persisted workflow arguments/results. Negative access checks cover API, database, storage and old signed access links.

## Task 1 — Baseline, scaffold and feasibility

**Create:** app tooling, `.env.example`, lockfile, `src/lib/domain/schemas.ts`, `docs/architecture.md`, evidence ledger updates.

- [ ] Inspect repo status, branch, instructions and available Node/npm/Docker/Supabase/Vercel tools. Preserve unrelated work.
- [ ] Scaffold Next.js TypeScript with App Router and pinned compatible Tailwind/shadcn, Groq, Supabase and workflow packages. Use frontend-design skill to customize components.
- [ ] Define scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`. Configure fixture-backed deterministic test environment explicitly as synthetic.
- [ ] Verify current Vercel function/upload/workflow limits, Supabase Auth/Storage/RLS docs and Groq current models/quotas/retention. The current free-function upload route must receive metadata, not audio bodies.
- [ ] Test Groq on short/long fictional recordings after key/retention verification. Record completeness, latency, schema validity and exact model. Do not claim transcript or coaching quality from schema compliance alone.
- [ ] Select Supabase org and verify cost before cloud creation; use local backend or synthetic domain/UI work in the meantime. Never borrow a different client's project.

**Verify:** scaffold builds, schema rejects invalid values, available integrations recorded without secrets. Commit owned baseline.

## Task 2 — Data model, Auth, memberships and RLS

**Create:** Supabase config/migration, `src/lib/supabase/*`, `src/lib/auth/*`, `tests/integration/rls.test.ts`, `scripts/seed-test-users.ts`.

- [ ] Create workspaces, workspace_members, calls, call_jobs, transcript_segments, redaction_ranges, analysis_versions, checkpoint_assessments, followups, review_decisions and deletion_receipts. Add foreign keys, workspace indexes, uniqueness/idempotency keys and deletion tombstones.
- [ ] Enable RLS on all exposed tables. Policies check protected workspace membership/role, not editable user metadata. Owner manages sensitive/raw/deletion operations; reviewer can read sanitized content and make reasoned review decisions.
- [ ] Configure invite-only Auth, verified server identity, CSRF/origin controls on mutations and no-store private responses. Secret key is server-only. Do not send invitations to real people without explicit messaging authorization.
- [ ] Create CLI-named migrations through the current Supabase workflow, run advisors and verify local/cloud schema target before applying. Avoid security-definer/public bypass functions and unsecured views.
- [ ] Seed two private fictional users for security tests. Test unauthenticated denial, cross-workspace denial, reviewer raw/deletion denial and valid owner/reviewer access.

**Run:** `npm run test:integration -- rls` → positive and negative policies pass. Commit reviewed migration and code.

## Task 3 — Direct private uploads and durable job admission

**Create:** upload-intent/finalize APIs, `src/lib/jobs/*`, upload UI, `tests/unit/jobs.test.ts`, storage integration tests.

- [ ] Create source and sanitized private buckets with membership-scoped policies. User supplies original rep/direction/time optionally; missing metadata stays null.
- [ ] Validate supported container, actual size/duration, generated object path, ownership and checksum at finalize. Use resumable upload where current SDK recommends it. Show actual configured limits; do not silently drop audio.
- [ ] Finalize creates call/job idempotently. Duplicate offers open-existing; reprocess creates a new version without replacing a good active result prematurely.
- [ ] Workflows start from a persisted job ID. Add version/lease/idempotency guards at every stage so duplicate deliveries do not publish duplicate analyses.
- [ ] Quarantine known unsanitized CALL-013 before any provider upload. Source privacy preflight is a distinct state.

**Verify:** direct upload bypasses 4.5 MB API body limit; forged object/finalize/cross-user requests fail; duplicate creates one call/job.

## Task 4 — Groq transcription, timestamps and privacy

**Create:** `src/lib/groq/transcribe.ts`, privacy utilities, process workflow transcription steps, redaction/media tests.

- [ ] Verify Groq ZDR/no-training settings and keep real-data uploads disabled until verified. Known payment exchange must be locally redacted and privately checked first; use fictional values in regression tests.
- [ ] Obtain supported timestamped transcription from Groq. Preserve source duration and offsets; chunk large files without losing endings or duplicating overlap text.
- [ ] Keep stereo channel/role information where genuinely separated and verified; otherwise use unknown role. Groq's downmixing is not diarization or verified employee identity.
- [ ] Detect/hold uncertain redactions, sanitize text and prepare muted audio intervals with padded boundaries. Owner privacy review releases only verified sanitized presentation.
- [ ] Media authorization checks current membership. Use short-lived authorized playback and no-store. Never serve raw audio to reviewers or leak signed URLs in logging.

**Verify:** complete timestamps, preserved ending, merged redactions, payment/identifier removal, pricing numbers retained, authorized seek/playback and blocked raw access. Provider checks and local tests remain separate evidence.

## Task 5 — Purpose, outcome, facts and evidence validation

**Create:** `src/lib/groq/analyze.ts`, domain validators, semantic regression tests.

- [ ] Extract purpose/secondary intents and independent outcomes/facts/followups via strict schema. Treat transcript content as untrusted data, with no tools or executable instructions.
- [ ] Validate exact segment IDs, quote membership, speaker evidence, prices and date provenance. Unsupported claims become review reasons, not citations.
- [ ] Chunk/reconcile long transcripts without silent truncation; contradictions remain visible. Unknown original date prevents derived absolute appointment dates.
- [ ] Bound provider error/schema repair. Persist last valid artifact and safe error code. Quota waits use durable workflow sleep; do not keep a function running while waiting hours.

**Tests:** inspection not treatment sale; payment setup not collection; verbal acceptance not signature; one-time acceptance not lost sale; promise not confirmed CRM action; prompt injection ignored; missing evidence rejected.

## Task 6 — Deterministic rubrics and coaching

**Create:** `src/lib/scoring/*`, Groq coaching stage, `docs/scoring-policy.md`, scoring/coaching tests.

- [ ] Define exact Sales 17, General 12 and Retention 12 checkpoint IDs from the specification. Reject duplicates/missing items.
- [ ] Code applies thresholds and the four-point no-sales-objections exception once, requiring complete reliable evidence. No N/A denominator normalization or invisible passes.
- [ ] Unresolved applicability/research/speaker evidence yields partial assessment and no official grade. Appropriate no-cost re-service close may use solution/consensus per manual.
- [ ] Generate one specific strength and up to two prioritized improvements, each linked to a checkpoint and evidence with a concrete better response. Avoid unmeasured tone/interruptions and invented rep identity.
- [ ] Reviewer effective scores are deterministic and separately versioned from original model results.

**Boundary test example:**

```ts
import { describe, expect, it } from 'vitest';
import { officialGrade } from '@/lib/scoring/engine';
describe('fixed rubric grades', () => {
  it.each([[13,17,'below'],[14,17,'green'],[16,17,'green'],[17,17,'gold'],[10,12,'below'],[11,12,'green'],[12,12,'gold']] as const)(
    '%i of %i', (points, denominator, expected) => {
      expect(officialGrade(points, denominator, 0)).toBe(expected);
    });
  it('withholds an unresolved assessment', () => {
    expect(officialGrade(11, 12, 1)).toBeNull();
  });
});
```

**Run:** `npm run test -- scoring` → thresholds, exact policy award and unresolved cases pass. Commit.

## Task 7 — Polished shell, Calls and upload/status UX

**Create:** workspace layout, styled shell, call log, upload dialog, polling hooks and UI tests.

- [ ] Implement the Calm workspace tokens, content hierarchy and navigation. No dummy destinations or stock component styling. Local/system fonts avoid third-party traffic.
- [ ] Search sanitized content, filter purpose/outcome/status/grade, paginate and preserve URL state. Mobile call cards retain key fields. Missing metadata is Not provided.
- [ ] Upload stage progress is truthful and persistent across dialog close/reload. Provide empty/no-results/loading/failure/privacy-blocked states and explicit retry/reprocess.
- [ ] Keep private data out of browser persistence; use verified session and server state. Every action has visible label/focus and meaningful feedback.

**Verify:** build/typecheck, keyboard controls, back-navigation filter retention and small-screen layout. Commit.

## Task 8 — Recording/transcript, Scorecard and Coaching detail

**Create:** call detail and panels/player, `tests/e2e/review.spec.ts`.

- [ ] Summary/Scorecard/Coaching/Transcript tabs preserve call and recording context. Desktop splits panes; mobile uses readable tabs/cards.
- [ ] Evidence action highlights and seeks the right source segment. Transcript search preserves time context and supports keyboard use.
- [ ] Group checkpoints in Validate/Understand/Solve/Verify. Distinguish observed pass/miss, policy award, unclear and N/A. Show original denominator and unresolved count without fabricated final grade.
- [ ] Separate need, agreement, facts and outstanding actions; coaching is specific and evidence-linked. Next/previous respects active call filters.

**Run:** `npm run test:e2e -- review` → actual UI evidence seek, tab/back state, uncertainty and responsive review pass.

## Task 9 — Review queue, immutable decisions and Overview

**Create:** review APIs/forms, overview aggregation/page and conflict/security tests.

- [ ] Prioritize privacy, contradictory outcomes, missing evidence and applicability. Reasoned corrections use optimistic active-version checking; stale review returns conflict with refresh recovery.
- [ ] Preserve original and effective versions. Resolving one issue does not clear other issues. Refresh score/overview consistently from active data.
- [ ] Show analyzed coverage, inspections, treatment acceptance and needs-review counts with drill-down. Failed/processing excluded appropriately. Independent metrics may overlap.
- [ ] No invented customer conversion rates, revenue, dates, saved-account actions or rep rankings from absent data.

**Verify:** stale conflict, preserved model result, independent unresolved issues and correct counts; no cross-workspace aggregation leaks.

## Task 10 — Deletion and retention lifecycle

**Create:** deletion API/workflow, owner controls, verify-deletion script and integration tests.

- [ ] Mark/tombstone/cancel jobs before deletion. Every write rechecks deletion/version guards so late retries cannot restore removed content.
- [ ] Remove source/sanitized audio, transcripts, analysis/review/followup versions, created exports and local private copies at test completion. Restrict deletion to owner with deliberate confirmation.
- [ ] Check current Supabase Storage/database backups, Vercel workflow/run state/log retention and Groq ZDR behavior. Do not persist customer content in workflow state. Verify actual cleanup and record provider limitations honestly.
- [ ] Old detail/media access fails. Keep only a receipt with time/counts. Preserve only code and fictional fixtures after checking for customer content.

**Run:** synthetic delete/restart/late-retry regression → no resurrection and no remaining accessible customer objects. Actual end-of-test cleanup stays pending until the test ends.

## Task 11 — Evaluate all 20 calls and finish UI/security QA

**Create:** private import/review ledger, public non-content evidence summaries, accessibility/upload/privacy E2E.

- [ ] Reacquire all 20 source recordings privately after privacy/retention prerequisites. Verify IDs/checksums/durations; keep source copies ignored. Never hard-code context notes as app results.
- [ ] Establish reviewed purpose/outcome/score evidence through private audio checks. Context summaries are not truth grades. Flag unresolved transcription/applicability rather than forcing a number.
- [ ] Required priority cases: 001, 002, 006, 010, 011, 013, 016 and 020; inspect the rest too. Account for all 20 with status and exact evidence.
- [ ] Require zero critical false confirmed sale/signature/payment/save claims in reviewed cases, no leaked payment credentials and all published evidence IDs valid. Report exact assessment denominator and unknown coverage.
- [ ] Verify 320/390/768/1024/1440, 200% zoom, keyboard, contrast and axe; core pages have no serious/critical violations. Check empty/loading/failure/retry/pending states and actual new-upload flow.

**Run:** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, `npm run build`, `npm run test:e2e`. Repeat beyond the focused suite only for new changes or unresolved failures.

## Task 12 — Private deployment and submission

**Create:** deployment configuration, README/setup, architecture/privacy/scoring limits, demo script and submission checklist.

- [ ] Deploy through authorized existing Vercel commercial resources with isolated Supabase backend. No new paid plan or public source/data. Reconfirm API keys/secrets, domain/origin rules and workflow availability on the actual target.
- [ ] Test anonymous direct API/media denial, reviewer versus owner actions, cross-workspace access, and a new synthetic recording through real Groq on the hosted revision. Simulate an interrupted stage and verify resume without duplicate results.
- [ ] Verify private repo/source access if creating the required GitHub repo; commit no `.private` content or secrets. Never send client messages/invitations without explicit authorization.
- [ ] Prepare demo sequence: owner overview → upload/stages → summary → grade/evidence → coaching → uncertainty review → technical trade-offs and next steps. Use fictional or verified sanitized examples.
- [ ] Provide app/source links, README, demo script/Loom status, evidence and specific remaining blockers. Do not label it production-ready from the test submission.

## Acceptance mapping

R01 processing: Tasks 1,3–6,11–12. R02 transcript/playback: 4,8. R03 classification: 5. R04 outcomes/details: 5,8,11. R05 scores: 6,8,11. R06 coaching: 6,8,11. R07 all-results interface: 3,7,9,11. R08 UX: 7–9,11. R09 privacy/security: 2–4,10–12. R10 submission: 12. R11 reliability: 3–5,9–10,12. R12 end-of-test deletion: 10.

## Schedule and handoff

Use a 48-hour planning allowance until the agreed window is confirmed: 0–4 h feasibility/scaffold/contracts; 4–12 h Auth/storage/upload/workflow; 12–22 h complete one real-provider call; 22–32 h all core UI/review; 32–40 h all-call QA and repairs; 40–48 h hosted verification and submission. These are allocation targets, not actual hours or a confirmed deadline. Extra time, if 72 h is confirmed, goes to accuracy and polish rather than new features.

Review → fix → review your owned revision, bounded to three persistent repair rounds. Finish independent local work when a specific provider/cost/account choice is pending. Final acceptance is a newly processed deployed recording plus verified privacy, rubric correctness and useful UI; fixtures alone do not close it.

