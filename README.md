# PestLaunch Call Intelligence

Private call review, evidence-backed scorecards and coaching. Standalone sibling project; the existing Portfolio app is untouched.

## Current delivery status — 9 October 2026

The human authorized completing the demo and Vercel hosting, with review in **PestLaunch planning and review**. The Drive assignment and both manuals were refreshed. The reviewed application uses extraction followed by purpose-specific scoring, exact source references, fixed coaching slots and protected extraction reuse after transient scoring failures. Fresh local verification reached 313 tests in 37 files plus lint/typecheck and production build; final build privacy status is recorded in progress. This is not hosted acceptance.

The historical renewal is stopped at eleven requests and remains preserved. The separate fictional-only validation phase is closed at six actual requests, including its diagnostic and repair children. Valid scoring responses passed structure but failed complete semantic acceptance; no result was published. V3 source-grounded recap/details are implemented locally with exact source-role/time snapshots and await independent/live acceptance. Unsupported commercial advice and ambiguous roadmap order are withheld, with targeted reasoned review. Do not reset/reopen any stopped ledger or present the diagnostic as client-ready AI. One incomplete CALL-001 extraction occurred in the historical round; no full customer analysis or deployed new-upload result is accepted.

Authenticated Vercel discovery confirms **Setterlun Ventures: active Pro** and **personal team: Hobby**. Authorization to use Setterlun Ventures for this separate client project is pending. The dedicated Supabase dashboard confirms healthy Sydney Free; both connector links currently deny access. Replace the exposed server key before hosted operations. The [private source repository](https://github.com/ElaiElaiElai1113/PestLaunchCallIntelligence) is created and visibility verified; no client collaborator has been added. No deployed URL or recorded Loom is verified. Follow [the deployment runbook](docs/deployment-runbook.md) and [the Loom script](docs/demo-script.md). Older sections below preserve implementation/setup history; current progress controls readiness claims.

## Run the keyless version

Use Node 22.13+ or 24. From this repository:

```powershell
npm ci
npm run demo
```

Open the printed `http://127.0.0.1:3003` URL and choose **Open sample workspace**. This launcher uses a fresh UUID directory under ignored `.private/demo/`, separate build output/session key, empty Supabase/Groq overrides and real processing disabled. It never edits `.env.local` or reuses another server. Add a clearly fictional text example, inspect outcomes/scorecard/coaching/transcript, save reasoned reviews, search/filter calls and delete disposable data. Ctrl+C stops only the launcher's process tree. No recorded audio exists for these examples; they are not AI output or replacement results for an uploaded file.

Ordinary `npm run dev` retains `.private/app/` only when Supabase is absent. This checkout's dedicated backend environment is configured, so ordinary development uses invited sign-in. **Replace the exposed server key before any further hosted use**, then provision authorized owner/reviewer memberships; temporary hosted QA users were removed. Use the isolated demo while those prerequisites remain pending.

The human supplied a server-only Groq test key and authorized bounded fictional direct-provider tests. It exists only in ignored `.env.local`; ordinary sample QA overrides it empty. Real customer processing stays disabled. Direct Whisper transcription passed on newly generated fictional speech; reference-contract ASR analysis passed structural/safety checks but lacked an accepted follow-up. Known-source grading is still blocked by missing required Sales checkpoints and a General `json_validate_failed` response. No customer recording, hosted/deployed workflow, paid upgrade or purchase occurred.

The latest remediation is local only. It tightens registered-path admission and complete owned-media cleanup, corrects manual guidance/grouping, guards effective assessments against unverified attribution/completeness, recovers failed retry dispatch and derives follow-up labels from accepted evidence. The new additive migration is **not applied remotely**. The earlier hosted checks predate these changes; the exposed server key must be replaced before any further hosted use.

## Implemented

- Responsive Overview, Calls, Summary/Scorecard/Coaching/Transcript, Needs review, invited login and owner Data controls.
- Persistent sample CRUD, authenticated APIs, origin checks, optimistic review conflicts, original/effective history and deletion tombstones.
- Exact 17/12/12 rubrics, deterministic grades, four-point no-objection policy and withheld grades for unresolved checkpoints.
- Production Supabase adapter, protected memberships, SQL migration, private source/sanitized buckets and RLS.
- Direct private uploads with metadata-only server requests, checksum/container validation and duplicate/resume admission.
- Groq timestamped transcription and strict structured-analysis adapter with evidence validation. Vercel Workflow stages use ID-only state and safe retries/errors.

The local app is now connected to the dedicated hosted Supabase backend. Thirty-one keyless hosted checks passed, plus actual browser owner upload, reviewer view/reload and owner deletion. Those checks used explicitly fictional generated silence and temporary accounts, which were removed after QA. Actual Groq behavior, hosted workflow/recovery, backup/log retention and deployment remain unverified. Embedded PostgreSQL policy tests remain a separate local verification layer.

## Connect Supabase with AI still disabled

The user selected **Projects** (`tqzukvtntitbbjoatxet`, Free) and completed project creation in the authenticated dashboard. The dedicated PestLaunch project is `qwrukdqtuhqkbrbtnekz` (Sydney); the existing Portfolio project was not changed. The reviewed schema and additive filename-policy fix were applied through SQL Editor, and live Auth/Storage/keyless checks passed. Public signup and anonymous sign-in are disabled. CLI migration-history reconciliation is still pending; do not blindly reapply the initial schema. A diagnostic exposed server-key fragments during setup; replacement of that key remains required before real-data use.

The initial schema comes from `supabase/migrations/20261008075016_call_intelligence.sql`; it is already applied to this target. For a future fresh target, apply it only after security review and disable public signup and anonymous auth. Provision invited users and protected `workspace_members` rows through a trusted administrative process. No public signup or self-assigned membership is exposed. Do not send invitations without authorization.

With the dedicated server secret in ignored `.env.local` and the local app running, run `npx tsx scripts/verify-hosted-keyless.ts --run`. This guard accepts only the dedicated project above with an empty AI key and real processing disabled. It creates three fictional test users and two isolated test workspaces, sends no email, uploads generated silence, verifies access/keyless/deletion behavior and writes a non-content report under ignored `.private/evidence/`. Test identities are retained temporarily for UI QA. After QA, run `npx tsx scripts/cleanup-hosted-keyless.ts --run` to revoke/delete those test identities and remove owned workspaces, remaining objects/rows and local credential files. This is a local app against hosted Supabase, not deployment or real-AI acceptance.

Copy `.env.example` to ignored `.env.local`. Set the dedicated public URL, publishable key, server secret and exact `APP_ORIGIN`. **Leave `GROQ_API_KEY` empty and `REAL_CALL_PROCESSING_ENABLED=false`.** Restart the app. Normal invited login replaces the sample login. Fictional recordings can upload privately and remain explicitly **Awaiting AI**, with no transcript/result invented. Add the key later and choose Resume analysis. Client-call upload stays held until privacy approval. For local Supabase, start Docker/Supabase, obtain local credentials, apply the schema and run `npm run db:seed`. Seeding refuses cloud targets, sends no email and saves fictional account credentials to ignored `.private/app/local-test-accounts.json`.

## Enable real AI later

Add `GROQ_API_KEY` server-side only. Transcription defaults to `whisper-large-v3`; reference analysis is pinned to `openai/gpt-oss-120b`. Verify model availability, quotas, Zero Data Retention and no-training settings. First test a newly recorded fictional call through the actual provider. After verified privacy preparation, explicitly enable `REAL_CALL_PROCESSING_ENABLED=true`. CALL-013 must be fully redacted and privately reviewed before upload.

Current ceilings are 25 MB/60 minutes. Excessive transcript input is refused rather than truncated. Recordings require manual private preparation/redaction first. Comprehensive automatic PII/audio redaction, automatic diarization, chunking, resumable transfers, hosted recovery/deletion race checks and all-20-call accuracy evaluation remain release work. Whisper speaker roles start unknown; an authorized reviewer can annotate clear roles and attest completeness/quality against prepared media. Unknown/mixed roles stay unknown. Legacy real recordings without checksum-bound preparation remain held. Sample review concerns fictional text only; playback is unavailable because no recording exists.

ASR quality cannot certify completeness. Uploaded transcripts start unverified; original ASR/model output stays separate from guarded effective results. Source review is an audited human attestation with fixed words/timestamps, not automated certification. It increments the source revision and makes previous analysis history-only with no current grade. Owners can re-analyze that prepared revision when AI is configured; an empty key produces no result or dispatch. First raw snapshots remain immutable, latest raw model is separate, and old manual decisions remain history rather than being replayed. Model uncertainty can still withhold grade after verification. Checkpoint corrections require actual employee evidence and reliable complete source for passes/misses. Denominators remain 17/12/12. A sanitized-bucket copy does not itself redact audio.

Transcript review includes protected prepared-recording controls and per-segment seek without losing annotation drafts. Unavailable or expired playback requires an explicit refresh through the protected media route; no raw recording fallback is exposed. Source/checkpoint review and deletion dialogs block Escape while a request is in flight; review failures retain visible drafts for retry. Text-only samples have no player.

A settled eligible transcript without a current result has an explicit owner Analyze transcript/Re-analyze action, including a failed first analysis after source review. Saving a review does not dispatch analysis. Previous failure codes remain in source-review history. Admission uses the current source/request with the same byte budget; an unchanged oversized request stays blocked, while an audited revision that now fits can be started by its owner. Privacy, preparation, active-work, version and owner/reviewer checks remain mandatory, and waiting transcripts are not labelled active processing.

Retry processing uses the same provider-input preparation/privacy/budget admission in both UI and server. Pending-start retries retain their existing attempt; running work stays blocked. Initial audio resumption keeps its existing validated-upload/transcription checks rather than requiring a derivative that does not yet exist. A current accepted result can restore its status without another provider effect. These paths do not fabricate source preparation or a new assessment.

Analysis now uses provider-only source references and nested checkpoint coaching; displayed excerpts come from the exact selected segments. Raw provider JSON is preserved separately from immutable normalized originals and guarded results. Invalid references or rubric membership never become published results. GPT-OSS120B uses low reasoning, no returned reasoning and separate 1,600-token extraction / 2,400-token scoring output caps. A 12,000-UTF-8-byte messages/schema preflight is an English/JSON heuristic, not an exact tokenizer or quota guarantee. Oversized inputs retain the complete transcript/history and require a reviewed processing plan; the 60-minute upload ceiling does not promise 60-minute analysis within Free limits.

`test:groq:fictional` is a separate explicit opt-in probe, never called by ordinary tests/builds. On Windows, invoke its script with `node --import tsx scripts/test-groq-fictional.ts` plus the reviewed `--run --free-confirmed --case` flags to avoid npm PowerShell argument forwarding. It maintains the existing round ledger, preserves unique private artifacts and refuses automatic retries, redirects, other endpoints, parallel requests or more than six attempts. The present initial cases did not all succeed, so optional probes remain blocked; do not reset its ledger or start another strategy without review.

The current round is now explicitly closed at three requests; its immutable request/response artifacts and historical flags are preserved. New audit controls separate conservative fixture assertions from complete manual semantic acceptance bound to the source/result hashes and all required audit areas. Legacy `semanticPass` booleans or a primary-purpose/follow-up check cannot authorize optional probes. These local instrumentation fixes made no provider request and do not resolve the known-source AI failures.

Audit controls now distinguish required evidence/business checks from display-label review notes. A fact with identical content and cited evidence but a different display label remains pending without review; only a complete hash-bound manual audit can accept that variation. Changed claims/evidence, wrong outcomes, uncertainty and missing coverage remain blocking. This is not fuzzy matching or a blanket manual override. The failed current round remains closed.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build

# Each suite owns a fresh isolated loopback server/datastore:
npm run test:http
npx playwright install chromium --only-shell --no-remove
npm run test:e2e
npm run test:e2e:mocked
```

Exact results: `docs/evidence/progress.md`. Reports and content-bearing screenshots remain ignored. Production dependency audit was clean during implementation; ESLint's development dependencies retain an unpatched braces advisory. Do not supply untrusted glob patterns to that toolchain; recheck before release.

`test:http` and default `test:e2e` now own a fresh actual sample app on port 3002, with independent UUID datastores/session keys/build output and empty backend/provider overrides. They exercise real local APIs and persisted changes; they do not call hosted Auth/Storage/Groq. Run them sequentially. Direct HTTP-suite execution without its validated harness URL fails closed. Sample-root overrides are server-only and restricted to ignored QA/demo descendants; ordinary data and customer context are not reset.

`test:e2e:mocked` is separate on port 3001, intercepts every browser API and rejects unexpected/external requests. It covers live review/role/conflict/re-analysis/failure states without provider calls; default discovery excludes mocked specs. Pending processing is Waiting to start, and a delayed claim restores queued/analyzing status. Durable attempts survive dispatch-recovery outages; one claimed run owns provider effects. Idle duplicate runs and same-owner step retries still require hosted acceptance; no exactly-once or stale-running-recovery claim is made.

Read `docs/demo-script.md`, `docs/client-requirements-matrix.md`, `docs/privacy.md` and `docs/evidence/client-v1-demo-checklist.md`. A client sequence and separate local walkthrough are prepared. The recording-processing/deployed-source/Loom submission is not complete until Task 8 acceptance passes.

## Deployment and handoff

Prepared for Next.js/Vercel plus Supabase; not deployed. Production disables the local sample route. Configure an authorized commercial Vercel project, production secrets/origin, invited access and verified retention before client testing. Acceptance requires a new hosted recording and negative access/recovery/deletion checks. No recruiter START message, client outreach, source invitation or Loom recording occurred.

Read `docs/architecture.md`, `docs/scoring-policy.md`, `docs/submission.md`, `IMPLEMENTATION_PROMPT.md` and `docs/context/source-register.md` for architecture, exact policy, remaining acceptance and source material.

