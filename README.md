# PestLaunch Call Intelligence

A reviewer-assisted call intelligence application for pest control teams. Upload a recording, inspect the transcript and business outcomes, and review an evidence-backed scorecard and employee coaching in one workspace.

[Open the deployed demo](https://pestlaunch-call-intelligence.vercel.app/login). Access is invitation-only; demo credentials are shared privately.

## Features

- Private recording uploads and authenticated playback with timestamp navigation.
- Timestamped transcription and AI-assigned Employee/Customer labels that reviewers can correct.
- Primary call-purpose classification, important details, outcomes and follow-ups.
- PestLaunch Sales, General and Retention scorecards based on the supplied manuals.
- Evidence-linked checkpoint decisions and coaching.
- Call search/filtering, a review queue, source corrections and review history.

This V1 has been exercised on uploaded client recordings on Vercel. Its scores are provisional while source accuracy, completeness or checkpoint decisions remain unresolved. Hosted processing does not establish benchmark-level accuracy or production readiness.

## Architecture

| Layer                       | Implementation                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Application                 | Next.js App Router, React, TypeScript and Tailwind CSS                                  |
| Identity and data           | Supabase Auth, Postgres with workspace-scoped row-level security, private Storage       |
| Transcription               | Groq Whisper `whisper-large-v3`                                                         |
| Speaker labels and analysis | Gemini `gemini-3.5-flash-lite` for speaker inference, structured extraction and scoring |
| Processing                  | Vercel Workflows with guarded source/version/attempt ownership                          |
| Validation and scoring      | Zod contracts, source-reference validation and deterministic rubric arithmetic          |
| Hosting                     | Vercel                                                                                  |

The configured demo explicitly combines Groq transcription with Gemini analysis. There is no automatic provider fallback. The Groq text-analysis adapter remains available through explicit provider selection; it is not the current demo analysis path.

### Processing flow

1. An authenticated owner registers and uploads a recording. File constraints, workspace ownership and a source checksum bind the upload.
2. A workflow transcribes the audio and infers speaker labels. Original transcription is preserved; uncertain labels can remain Unknown.
3. Structured analysis identifies the purpose, details and outcomes, then evaluates the appropriate rubric and generates supported coaching.
4. Source-reference validation ties excerpts to transcript segments. Code computes points and grade thresholds.
5. Reviewers inspect evidence and correct source labels or checkpoint decisions. A source change invalidates the previous analysis until re-analysis.

Workflow inputs and step returns carry identifiers and safe metadata. Customer content is kept in protected application storage rather than workflow parameters or public assets.

### Scoring rules

Sales uses **17 checkpoints**; General and Retention use **12**. Unknown and non-applicable checkpoints preserve the original denominator. An official grade is withheld when source or assessment requirements remain unresolved. Sales objection-policy points require reliable, complete evidence that no objections occurred.

Inspection booking, treatment acceptance, agreement signature and payment collection are separate outcomes. A stated promise is not proof that an account action was completed.

## Getting started

### Requirements

- Node.js 24 and npm.
- A Supabase project, or Docker and the Supabase CLI for a local backend.
- Gemini and Groq API keys for the configured live pipeline.

### Install and configure

```powershell
npm ci
Copy-Item .env.example .env.local
```

Populate the ignored `.env.local` file:

| Variable                               | Purpose                                                       |
| -------------------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key                                  |
| `SUPABASE_SECRET_KEY`                  | Server-only administration and workflow access                |
| `APP_ORIGIN`                           | Exact application origin; use `http://127.0.0.1:3000` locally |
| `AI_PROVIDER`                          | Set to `gemini` for the demonstrated pipeline                 |
| `GEMINI_API_KEY`                       | Server-only Gemini key                                        |
| `TRANSCRIPTION_PROVIDER`               | Set to `groq` for Whisper transcription                       |
| `GROQ_API_KEY`                         | Server-only Groq key for transcription                        |
| `GROQ_WORKFLOW_RETRIES`                | Set to `0` for bounded demo processing                        |

Provision the database and private buckets using the checked-in migrations in `supabase/migrations`. Users also need a membership in `workspace_members`; an Auth account alone does not grant workspace access. Apply migrations in order and verify the backend before processing recordings.

For a fresh local Supabase backend:

```powershell
npm run db:start
npm run db:status
```

Copy the local backend values into `.env.local`, then run `npm run db:seed`. The seed script creates local owner/reviewer accounts, writes their credentials to ignored private storage and refuses cloud targets.

Start the application:

```powershell
npm run dev
```

Open `http://127.0.0.1:3000`. For an isolated interface preview without Supabase or provider calls, use `npm run demo` and open `http://127.0.0.1:3003`. Its clearly labelled fictional text samples have no recording or live AI execution.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Additional application checks:

```powershell
npm run test:http
npm run test:e2e
npm run test:e2e:mocked
```

Run these harnesses sequentially. The isolated HTTP/browser harnesses use port 3002; the mocked browser suite uses port 3001. Install Playwright Chromium with `npx playwright install chromium` if it is not available.

Ordinary QA uses fictional fixtures and empty backend/provider credentials. Build verification checks that private and environment files are excluded from deployment traces. Live-provider acceptance is recorded separately in [the evidence ledger](docs/evidence/progress.md); passing fixtures or schemas alone does not certify AI accuracy.

## Deployment

Deploy the Next.js project to Vercel with the same environment configuration and the deployed HTTPS origin as `APP_ORIGIN`. The project integrates Vercel Workflows through `next.config.ts`. Provision Supabase separately, retain workspace-scoped RLS/private buckets, and create authorized workspace memberships before sharing access.

The current hosted deployment is a test environment using operator-selected Free resources. Provider rate limits, account availability and transient failures can interrupt a run. SDK retries and Gemini workflow retries are disabled in the demo configuration; failures remain visible for deliberate recovery.

## Data handling

Recordings and derived customer information are confidential and used only for the build test. They are excluded from Git; credentials are server-side except for the Supabase publishable configuration. Playback requires authenticated workspace access, and database/storage permissions remain workspace-scoped.

Recording selection is controlled by the operator. The application does not automatically redact audio or certify that a recording is free of personal information. Groq transcription uses the verified ZDR configuration; Gemini Free is not represented as offering ZDR. Provider data handling must be appropriate for any future deployment.

The application supports deletion of owned call records and stored media. End-of-test cleanup must also account for private working copies and actual provider/backup retention; deleting an application record alone is not a complete retention guarantee.

## Known limitations

- Speaker labels are inferred from transcript context, not independently verified audio diarization. Mixed or unclear turns need review.
- Transcription confidence does not establish complete or accurate capture. Official grades can remain withheld even when provisional points are displayed.
- Independent scoring/coaching accuracy acceptance across representative supplied calls remains pending.
- Uploads are limited to MP3, WAV or M4A, up to 25 MB and 60 minutes. Transcript request limits are separate; a valid upload can still exceed analysis capacity.
- No automatic redaction, production-scale reliability claim or all-recording benchmark is established by this demo.

## Next steps

1. Audit purpose, outcomes, checkpoint decisions and coaching against independently reviewed source recordings and manuals.
2. Improve audio-based speaker separation and handling of overlapping dialogue.
3. Add a reviewed long-call processing strategy that preserves full context and source evidence.
4. Expand hosted concurrency/recovery testing and verify retention and cleanup behavior.

## Repository layout

```text
src/app/          Pages and authenticated API routes
src/components/   Workspace, call review and upload interfaces
src/lib/domain/   Source contracts, review rules and evidence guards
src/lib/scoring/  Rubrics and deterministic scoring
src/lib/gemini/   Gemini adapter
src/lib/groq/     Transcription and shared analysis contracts
src/workflows/    Durable call processing
supabase/         Backend configuration and migrations
tests/            Unit, integration, HTTP and browser coverage
docs/             Product design, implementation plans and evidence
```
