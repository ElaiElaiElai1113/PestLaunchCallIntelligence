# PestLaunch Call Intelligence

Private call review, evidence-backed scorecards and coaching. Standalone sibling project; the existing Portfolio app is untouched.

## Run the keyless version

Use Node 22.13+ or 24. From this repository:

```powershell
npm ci
npm run dev
```

With Supabase environment values absent, open http://127.0.0.1:3000 and choose **Open sample workspace**. No credentials are needed for this development-only mode. Add a fictional call, inspect outcome/scorecard/coaching/transcript, save reviews, search/filter calls and delete test data. Fictional data persists in ignored `.private/app/`. Samples are explicitly labeled and text-only. Uploaded recordings never receive these sample results. This checkout now has the dedicated Supabase environment configured, so normal invited sign-in is active instead. Temporary fictional acceptance accounts were removed after QA; provision authorized owner/reviewer memberships before ongoing use.

The AI key has intentionally **not** been entered. No real recording was imported or sent to a provider, and no paid resources were purchased.

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

Add `GROQ_API_KEY` server-side only. Defaults: `whisper-large-v3` and `openai/gpt-oss-120b`. Verify model availability, quotas, Zero Data Retention and no-training settings. First test a newly recorded fictional call through the actual provider. After verified privacy preparation, explicitly enable `REAL_CALL_PROCESSING_ENABLED=true`. CALL-013 must be fully redacted and privately reviewed before upload.

Current ceilings are 25 MB/60 minutes. Excessive transcript input is refused rather than truncated. Recordings require manual private redaction first. Comprehensive automatic PII/audio redaction, verified diarization, chunking, resumable transfers, hosted recovery/deletion race checks and all-20-call accuracy evaluation remain release work. Whisper speaker roles are unknown, so uncertain employee checkpoints stay partial until reviewed. Sample audio playback is unavailable because the fixtures contain no recorded audio.

ASR quality cannot certify completeness. Uploaded transcripts persist unverified completeness/review reasons; original model output is kept separate from the guarded effective assessment. Unknown/customer-only employee evidence cannot publish passes, no-objection awards or employee coaching. Independent review reasons withhold official grades without changing 17/12/12 denominators. A reasoned checkpoint correction cannot certify attribution or source completeness. Trusted source review is still pending. The sanitized-bucket copy does not itself redact audio.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build

# With npm run dev running separately:
npm run test:http
npx playwright install chromium --only-shell --no-remove
npm run test:e2e
```

Exact results: `docs/evidence/progress.md`. Reports and content-bearing screenshots remain ignored. Production dependency audit was clean during implementation; ESLint's development dependencies retain an unpatched braces advisory. Do not supply untrusted glob patterns to that toolchain; recheck before release.

For the isolated mocked frontend regression, run `npx playwright test --config playwright.mocked.config.ts`. It starts its own preview on port 3001 with empty Supabase/Groq overrides and separate ignored build output. Every browser `/api/` request is mocked; unexpected API/external requests fail the test. It verifies the corrected follow-up label and empty coaching message at five widths. It does not exercise real Auth/Storage, sample CRUD or durable workflows. Do not run the older HTTP/E2E sample-mutation suites against the configured backend or reuse a different running app.

`npm run test:e2e:mocked` runs all mocked journeys, including owner pending-deletion retries/unavailable counts and processing-start error/reload recovery. Default `test:e2e` discovery excludes `*.mocked.spec.ts`; its three sample-CRUD journeys still need their own isolated datastore before execution. Pending processing is shown as Waiting to start, with an owner retry action when provider/privacy configuration permits it. Durable pending attempt metadata survives dispatch-recovery outages, and one workflow claims ownership before either provider stage. Duplicate pending starts may enqueue idle duplicate runs; this does not claim provider effects are exactly once across a single owner's step retries. Hosted recovery and stale-running reconciliation remain unverified.

## Deployment and handoff

Prepared for Next.js/Vercel plus Supabase; not deployed. Production disables the local sample route. Configure an authorized commercial Vercel project, production secrets/origin, invited access and verified retention before client testing. Acceptance requires a new hosted recording and negative access/recovery/deletion checks. No recruiter START message, client outreach, source invitation or Loom recording occurred.

Read `docs/architecture.md`, `docs/scoring-policy.md`, `docs/submission.md`, `IMPLEMENTATION_PROMPT.md` and `docs/context/source-register.md` for architecture, exact policy, remaining acceptance and source material.

