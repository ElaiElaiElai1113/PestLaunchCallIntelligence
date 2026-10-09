## Gemini demo migration (10 October)

The human selected Gemini Free for downloaded-call testing. Set AI_PROVIDER=gemini and server-only GEMINI_API_KEY. The pinned demo model is gemini-3.5-flash-lite; the first3.8Flash audio request returned503/high demand and its stopped receipt is retained. No automatic model/provider fallback. Groq credentials are used only for explicit Groq provider/transcription selection. Private auth/storage/source integrity remain; Gemini Free is not Zero Data Retention. User accepted its data handling for this test, not a production privacy claim.

Set TRANSCRIPTION_PROVIDER=groq for the demonstrated hybrid: Whisper transcription uses its separate Free audio quota; Gemini handles all extraction/scoring, with no Groq text inference. Gemini-native inline audio remains an experimental explicit alternative (14MB raw/20MB request), but returned invalid timestamps on Call014 and is not the demo transcription selection. There is no automatic fallback. Machine-generated timestamps/words need source review; new uploads receive source-bound AI Employee/Customer labels by default, as explicitly requested by the operator. Original ASR remains preserved, and reviewers can correct any label to Employee/Customer/Unknown. Low-confidence turns remain Unknown. Extraction/scoring and supported coaching use these inferred labels, while the provisional result does not certify diarization, transcript quality or completeness. Official grades remain withheld until source review resolves the relevant facts. SDK and Gemini workflow retries are zero. Existing source-reference validators and deterministic manual denominators remain authoritative. Keyless QA clears both provider keys. Local/schema/build success is not live accuracy or hosted acceptance.

# PestLaunch Call Intelligence

A private, reviewer-assisted call intelligence test demo: recording, transcript, source evidence, scorecard, coaching and review history.

## Hosted demo

[Open the hosted demo](https://pestlaunch-call-intelligence.vercel.app/login). Login is invite-only; credentials and the current guide are shared privately. Current actual-call tests use Gemini text analysis and Free GroqWhisper audio transcription. The old fictional Gold record was deleted in the human-authorized reset; historical evidence remains in the ledger.

AI assigns Employee/Customer labels by default, preserving original ASR. Reviewers can correct labels or leave uncertain turns Unknown. Hosted re-analysis returned provisional General9/12 forCall005, Sales15/17 forCall014 and Sales14/17 forCall017. Source evidence quotes, exact request/source/deployment bindings, protected playback and reload passed. Call017 scoring first returned503, then a separately reserved recovery passed. These scores and coaching are based on inferred labels; source accuracy/completeness and independent business/manual acceptance remain pending. No official grade or100%client-ready claim follows. Full details are in [the evidence ledger](docs/evidence/progress.md).

## How to demonstrate it

1. Sign in and open a current call; show Summary, Scorecard, Coaching and Transcript.
2. Explain the provisional points and unresolved checkpoints. A fully unresolved call says Not scored yet, rather than0/12.
3. Click evidence timestamps to seek protected recording/transcript. Keep customer content private.
4. Open Review transcript. Correct any AI label to Employee/Customer/Unknown; confirm accuracy/completeness only after actually checking the source.
5. Save the review and Analyze transcript again when the source changed. Original ASR/model history stays preserved. Free quotas and transient provider availability can interrupt processing.
6. New uploads include automatic speaker assignment before extraction/scoring; plan all possible provider effects. Full independent accuracy, playable Loom and final test cleanup remain open.
## Architecture

- Next.js 16.4, React 19.3 and TypeScript with a responsive review interface.
- Supabase Auth, workspace-scoped Postgres RLS and private source/sanitized Storage.
- Groq `whisper-large-v3` transcription and `openai/gpt-oss-120b` structured extraction/scoring, with fixed model IDs and no fallback.
- Vercel Workflows with identifier-only parameters/returns; customer content stays in protected application storage.
- Exact source IDs resolve excerpts in code. Deterministic rubrics retain Sales 17, General 12 and Retention 12 denominators. Unresolved evidence/source verification withholds the official grade.
- Unknown employee attribution deliberately skips the unsupported scoring request. The stored provider provenance marks scoring withheld; it does not fabricate employee assessments or coaching.
- Source/version/attempt checks fence recovery and publication. Quota headroom pacing rechecks ownership after waiting. The hosted test configuration sets provider retries to zero; normal bounded recovery supports at most three.

## Local setup

Use Node 24, install dependencies with `npm ci`, and copy `.env.example` into ignored `.env.local`. Configure only the dedicated Supabase project, public publishable key, server-only secret, Groq key and exact `APP_ORIGIN`. Never expose server credentials through `NEXT_PUBLIC_` or logs. Recording admission no longer depends on the legacy `REAL_CALL_PROCESSING_ENABLED` variable. Set `GROQ_WORKFLOW_RETRIES=0` for bounded verification; normal local/CI harnesses override provider/backend keys empty.

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


