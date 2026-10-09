# PestLaunch Call Intelligence

A private, reviewer-assisted call intelligence test demo: recording, transcript, source evidence, scorecard, coaching and review history.

## Hosted demo

[Open the hosted demo](https://pestlaunch-call-intelligence.vercel.app/login). Login is invite-only. Test credentials and the fictional upload kit are shared privately, never in this repository.

The saved fictional service call was uploaded through the deployed browser, transcribed by Groq, source-verified and re-analyzed by the hosted Workflow. All 92 scripted words matched after case/punctuation normalization; 10 speaker roles were verified against the generation manifest. The actual model assessments earned General 12/12 Gold with one strength and two employee-linked improvement suggestions. The manual confidence confirmation did not increase that AI-earned score.

Playback, evidence seeking, reload, source/manual review history, stale-review rejection, foreign-workspace denial and deletion of the owned failed fictional test case passed. Current application logic passed 333 tests across 40 files, seven isolated browser journeys, eleven isolated HTTP checks, lint/typecheck and build/privacy verification. Local and hosted acceptance are recorded separately in [the evidence ledger](docs/evidence/progress.md).

This is a reviewed-source demo, not acceptance of the full client dataset. The approved Drive CALL-001 excerpt was tested separately through the authenticated application; its incomplete source and unknown roles correctly withheld an official grade. Hosted client-demo data is fictional and real-customer uploads remain disabled.

## How to demonstrate it

1. Open the saved fictional call and review Summary, Scorecard, Coaching and Transcript.
2. Click evidence timestamps to seek the protected recording and supporting transcript.
3. Inspect source review and the reasoned confidence decision; original ASR/model history stays separate.
4. For a fresh upload, use a newly prepared fictional spoken recording. Initial roles are Unknown and employee scoring/coaching are withheld.
5. Review the prepared audio, assign only clear roles, verify completeness/quality and save a reason. Re-analyze that source revision to obtain current model assessments and a deterministic score.

Use [the Loom walkthrough](docs/demo-script.md) and [deployment runbook](docs/deployment-runbook.md). The agent did not record/send a Loom or contact the client.

## Architecture

- Next.js 16.4, React 19.3 and TypeScript with a responsive review interface.
- Supabase Auth, workspace-scoped Postgres RLS and private source/sanitized Storage.
- Groq `whisper-large-v3` transcription and `openai/gpt-oss-120b` structured extraction/scoring, with fixed model IDs and no fallback.
- Vercel Workflows with identifier-only parameters/returns; customer content stays in protected application storage.
- Exact source IDs resolve excerpts in code. Deterministic rubrics retain Sales 17, General 12 and Retention 12 denominators. Unresolved evidence/source verification withholds the official grade.
- Unknown employee attribution deliberately skips the unsupported scoring request. The stored provider provenance marks scoring withheld; it does not fabricate employee assessments or coaching.
- Source/version/attempt checks fence recovery and publication. Quota headroom pacing rechecks ownership after waiting. The hosted test configuration sets provider retries to zero; normal bounded recovery supports at most three.

## Local setup

Use Node 24, install dependencies with `npm ci`, and copy `.env.example` into ignored `.env.local`. Configure only the dedicated Supabase project, public publishable key, server-only secret, Groq key and exact `APP_ORIGIN`. Never expose server credentials through `NEXT_PUBLIC_` or logs. Keep `REAL_CALL_PROCESSING_ENABLED=false` for fictional testing. Set `GROQ_WORKFLOW_RETRIES=0` for bounded verification.

`npm run dev` serves the authenticated application on loopback. Invited users need a workspace membership. For local Supabase, use Docker/Supabase CLI and the checked-in migrations; `npm run db:seed` refuses cloud targets. Do not blindly rerun an initial schema against an already provisioned hosted project.

For an isolated interface rehearsal, run `npm run demo` and open `http://127.0.0.1:3003`. Its clearly labeled fictional text samples use empty backend/provider overrides. Those prepared samples have no audio or live AI execution.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run test:http
```

Run browser and HTTP harnesses sequentially because they both use port 3002. They create fresh ignored fictional stores and force empty provider/backend credentials. Build verification excludes private/environment files from deployment traces. Live-provider/hosted checks use separately documented controlled phases; ordinary tests do not dispatch Groq calls.

## Privacy and practical limits

Real recordings and derivatives are confidential, test-only, excluded from Git and deleted after the full test. CALL-013 remains quarantined. Global Groq ZDR was visibly verified on Free; batch/fine-tuning stay off. Private Storage, authenticated playback, scoped memberships and protected deletion/tombstones are required.

Automatic speaker diarization and automatic audio redaction are not implemented. ASR confidence cannot certify completeness. Human review of prepared recordings remains necessary; ambiguous roles and applicability stay unresolved. Booking, treatment, signature, payment and verified account actions remain distinct. A generic return visit cannot establish an inspection booking without inspection evidence.

The upload ceiling is 25 MB/60 minutes, but analysis has a smaller conservative byte/token budget. Long transcripts can be refused even below the upload ceiling; they are retained rather than truncated or assigned simulated results. Free quota and organization concurrency can cause safe provider failures. Input estimates and quota headers are not a guarantee against every external rate limit.

Remaining production work includes representative full client-recording accuracy acceptance, an authorized long-call processing strategy, deeper hosted concurrency/recovery and retention verification, and end-of-test confidential-data cleanup. A successful demo does not certify all 20 recordings or production readiness.
