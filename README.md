# PestLaunch Call Intelligence

Private call review, evidence-backed scorecards and coaching. Standalone sibling project; the existing Portfolio app is untouched.

## Run the keyless version

Use Node 22.13+ or 24. From this repository:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:3000 and choose **Open sample workspace**. No credentials are needed for this development-only mode. Add a fictional call, inspect outcome/scorecard/coaching/transcript, save reviews, search/filter calls and delete test data. Fictional data persists in ignored `.private/app/`. Samples are explicitly labeled and text-only. Uploaded recordings never receive these sample results.

The AI key has intentionally **not** been entered. No real recording was imported or sent to a provider, and no paid resources were purchased.

## Implemented

- Responsive Overview, Calls, Summary/Scorecard/Coaching/Transcript, Needs review, invited login and owner Data controls.
- Persistent sample CRUD, authenticated APIs, origin checks, optimistic review conflicts, original/effective history and deletion tombstones.
- Exact 17/12/12 rubrics, deterministic grades, four-point no-objection policy and withheld grades for unresolved checkpoints.
- Production Supabase adapter, protected memberships, SQL migration, private source/sanitized buckets and RLS.
- Direct private uploads with metadata-only server requests, checksum/container validation and duplicate/resume admission.
- Groq timestamped transcription and strict structured-analysis adapter with evidence validation. Vercel Workflow stages use ID-only state and safe retries/errors.

The usable app is currently the **local fictional workspace**. Cloud Supabase Auth/Storage, actual Groq behavior, hosted recovery/deletion and deployment remain unverified. SQL policy tests use actual embedded PostgreSQL with simulated Supabase auth/storage schemas; they are not hosted acceptance.

## Connect Supabase with AI still disabled

Use a dedicated PestLaunch project, never another client's backend. Organization selection and actual cost confirmation are required before creation. Available organizations were read as VishandCo and SU Org; selection is pending.

Apply `supabase/migrations/20261008075016_call_intelligence.sql` to the verified target after security review. Disable public signup and anonymous auth. Provision invited users and protected `workspace_members` rows through a trusted administrative process. No public signup or self-assigned membership is exposed. Do not send invitations without authorization.

Copy `.env.example` to ignored `.env.local`. Set the dedicated public URL, publishable key, server secret and exact `APP_ORIGIN`. **Leave `GROQ_API_KEY` empty and `REAL_CALL_PROCESSING_ENABLED=false`.** Restart the app. Normal invited login replaces the sample login. Fictional recordings can upload privately and remain explicitly **Awaiting AI**, with no transcript/result invented. Add the key later and choose Resume analysis. Client-call upload stays held until privacy approval. For local Supabase, start Docker/Supabase, obtain local credentials, apply the schema and run `npm run db:seed`. Seeding refuses cloud targets, sends no email and saves fictional account credentials to ignored `.private/app/local-test-accounts.json`.

## Enable real AI later

Add `GROQ_API_KEY` server-side only. Defaults: `whisper-large-v3` and `openai/gpt-oss-120b`. Verify model availability, quotas, Zero Data Retention and no-training settings. First test a newly recorded fictional call through the actual provider. After verified privacy preparation, explicitly enable `REAL_CALL_PROCESSING_ENABLED=true`. CALL-013 must be fully redacted and privately reviewed before upload.

Current ceilings are 25 MB/60 minutes. Excessive transcript input is refused rather than truncated. Recordings require manual private redaction first. Comprehensive automatic PII/audio redaction, verified diarization, chunking, resumable transfers, hosted recovery/deletion race checks and all-20-call accuracy evaluation remain release work. Whisper speaker roles are unknown, so uncertain employee checkpoints stay partial until reviewed. Sample audio playback is unavailable because the fixtures contain no recorded audio.

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

## Deployment and handoff

Prepared for Next.js/Vercel plus Supabase; not deployed. Production disables the local sample route. Configure an authorized commercial Vercel project, production secrets/origin, invited access and verified retention before client testing. Acceptance requires a new hosted recording and negative access/recovery/deletion checks. No recruiter START message, client outreach, source invitation or Loom recording occurred.

Read `docs/architecture.md`, `docs/scoring-policy.md`, `docs/submission.md`, `IMPLEMENTATION_PROMPT.md` and `docs/context/source-register.md` for architecture, exact policy, remaining acceptance and source material.

