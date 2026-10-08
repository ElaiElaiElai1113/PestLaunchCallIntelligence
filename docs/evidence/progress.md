# Progress and evidence

## Baseline — 8 October 2026

- Standalone project handoff created; application implementation has not started at this baseline.
- Product/source/design and Vercel/Supabase/Groq execution guidance are present.
- Private anonymized call-context notes are ignored by Git.
- No cloud resources, provider calls, paid services or deployment are claimed by this baseline.

## Implementation ledger

### Keyless build — 8 October 2026

Verified implementation commit: `7d31ce234d8f801792161aa65e8ac8e553494339`. This follow-up records that revision without changing application code.

User direction: build the frontend/backend and AI integration with the AI key empty. Completed in the standalone sibling repository on `codex/call-intelligence`; baseline `026e98b9e23ffcaacdc4bef53214fe61c7c39cd7`. Native project/chat registration remained unavailable; no separate GPT-6.1 Sol Medium implementation chat was launched.

Implemented: all primary screens, persistent fictional sample data, authenticated API boundary, correct rubric arithmetic, strict provider contracts, timestamp/quote checks, review conflicts/history, owner deletion, Supabase schema/RLS/private bucket adapter, keyless recording admission, direct upload/finalize and ID-only workflow code. Four distinct fictional text examples are present in the local preview. No imported real recording, actual AI request, paid resource, hosted migration or deployment occurred.

Fresh verification on the final owned source:

| Check | Result | Scope |
| --- | --- | --- |
| `npm run lint` | Pass, no warnings/errors | Owned source/config |
| `npm run typecheck` | Pass | All app/test TypeScript |
| `npm test` | 41 tests pass, 7 files | Rubrics, evidence, privacy, admission, sample persistence, mocked Groq HTTP contracts and embedded PostgreSQL RLS |
| `npm run test:http` | 9 tests pass | Actual local Next API: session, access denial, independent outcomes, reasoned/stale review, missing key, no-store and deletion |
| `npm run test:e2e` | 3 tests pass | Chromium: detail tabs, correction/history, transcript search, refresh, deletion, quick filters/back, keyboard dialog, responsive layouts, axe and zoom layout simulation |
| `npm run build` | Pass | Next production bundle and workflow compilation; not execution of a hosted workflow |
| `npm audit --omit=dev` | 0 vulnerabilities | Production dependency graph at this revision |
| `git diff --check` | Pass | Whitespace/patch integrity |

Responsive checks used 320, 390, 768, 1024 and 1440 px. Core tested views had no serious/critical axe findings after secondary-text contrast corrections. The zoom test uses a 200% CSS layout simulation, not native browser zoom certification. Fictional screenshot artifacts are ignored under `.private/evidence/`. Code verification is not proof of real transcription accuracy, cloud Auth/Storage behavior, speaker identity, audio sanitization, hosted recovery, or backup deletion.

Review/fix/review findings resolved: Next internal hostname versus actual origin; low-contrast secondary text; duplicate transcript IDs when its tab was open; review version snapshot stability; overlapping search/purpose navigation losing filters; workflow admission when the key is missing; tombstone checks around late writes and private-object cleanup. Actual hosted race/recovery tests remain pending.

Dependency limitation: the development ESLint chain still inherits the unpatched braces advisory GHSA-vfj7-8cjw-p6xm; no production dependency findings remain. Local Docker's engine did not become usable for Supabase. The incompatible existing Supabase CLI profile was temporarily preserved/restored for local migration creation and is unchanged; no unrelated configuration was removed. The existing Portfolio repository still has its original `output/` and `tmp/` untracked folders, with no edits from this work.

Pending: explicit Supabase organization choice (VishandCo or SU Org), actual cost confirmation/provisioning, cloud migration/Auth/Storage acceptance, Groq key/account retention verification, a new real-provider fictional recording, manual source sanitization including CALL-013, all-20-call accuracy evaluation, hosting/recovery/deletion/log/backup checks and submission artifacts. Do not mark the original twelve-task release plan complete from these local checks.

Record task, status, owned revision, test command/result, provider/hosted verification and concrete pending prerequisites as work proceeds. Keep customer content and secrets out of this checked-in ledger; private content-bearing evidence belongs in ignored storage and is deleted after the test.

### Projects organization setup — 8 October 2026

- Starting revision: `3593bc7665de9a0755e139c8e91cbe520b0a7363`, clean `codex/call-intelligence`. The new registered implementation chat supersedes the historical registration limitation above.
- Human selected Projects. Authenticated dashboard identified organization `tqzukvtntitbbjoatxet` with Free plan. The available connectors did not expose `get_cost` for either link; the authenticated CLI listed other organizations and did not include Projects. No alternate organization was substituted or created.
- Prepared dedicated project form with Data API enabled, automatic table exposure disabled and automatic RLS enabled. Human completed new database-credential entry and creation, then confirmed “done.” Dedicated project: `qwrukdqtuhqkbrbtnekz`, PestLaunch Call Intelligence, Sydney (`ap-southeast-2`), healthy Nano. No paid upgrade, API request, client recording or unrelated project change was made by this chat.
- Applied the reviewed initial schema through the dedicated project's SQL Editor; result: Success, no rows returned. This applied schema directly, without a CLI migration-history entry. History reconciliation remains pending; do not rerun the initial create-table migration blindly.
- Live SQL checks: seven expected public tables have RLS; two buckets are private with 25,000,000-byte limits; both application RPC functions use security invoker; anonymous call SELECT, authenticated call UPDATE and authenticated save RPC EXECUTE are false; source/storage SELECT/ALL policies count is zero. These checks verify deployed schema/privileges, not actual user-token or private-object behavior.
- Disabled public signup, kept anonymous sign-in disabled and email confirmation enabled; dashboard returned Successfully updated settings.
- Prepared ignored `.env.local` with this project's public values, local origin, empty server/AI secrets and real-call processing disabled. Server-secret entry is pending; no key was printed or committed.
- Added `scripts/verify-hosted-keyless.ts`, guarded to this exact project and local origin, with fictional users/workspaces and generated silence only. Hosted execution remains pending server credentials. The script explicitly verifies no transcript, analysis, score or job is fabricated, plus actual database/storage/application negative access and deletion guards. It retains fictional identities briefly for browser QA and records safe results in ignored storage.
- Fresh local command `npm run test:integration -- tests/integration/rls.test.ts`: 16 tests passed across three integration files (the script includes the integration directory, so this ran store/provider/embedded-RLS checks). These remain mocked-provider/embedded PostgreSQL evidence.
- Fresh `npm run typecheck`: pass. `npm run lint`: pass. `git diff --check`: pass. No full regression-suite rerun or deployment is claimed.
- Pending: server-secret configuration, authenticated frontend/hosted API/Storage tests, migration-history reconciliation, test-identity cleanup, provider/ZDR verification, real-provider fictional recording, manual source sanitization including CALL-013, all-20-call evaluation, hosted workflow/recovery/log/backup/deployment acceptance and submission.

### Hosted keyless acceptance and upload-policy repair — 8 October 2026

- Existing project server key obtained through the authorized dashboard UI and transferred via ignored private local file I/O. Windows and browser clipboards were separate, and an early copy contained masked text. Read-only Auth admin verification against the exact dedicated project succeeded with a server user agent; PowerShell's default browser-style user agent had caused 401 responses. Saved only the server secret in ignored `.env.local`; Groq remains empty and real processing remains false. Temporary transfer file and clipboard were cleared.
- Credential-handling incident: a diagnostic exposed server-key fragments. No key was committed. Replacement of the affected key is required before real-data use; no automatic generation/revocation occurred. This is a concrete outstanding security gate, not a provider-setup success claim.
- First actual owner upload failed. Current official [Storage helper documentation](https://supabase.com/docs/guides/storage/schema/helper-functions) and a live query both confirmed `foldername('fictional-workspace/fictional-call.wav')` returns only `["fictional-workspace"]`, while `filename` returns `fictional-call.wav`. The embedded test helper had incorrectly included the filename and concealed the policy error.
- Corrected the embedded helper, then observed the existing owner-upload test fail with RLS code 42501 before repair. Added CLI-generated `20261008104533_fix_source_upload_filename.sql`, retaining private owner/workspace/live-call/tombstone restrictions and requiring exactly one workspace folder. Uses `storage.filename(name)` for call ID extraction. The initial migration stays immutable. CLI generation succeeded with explicit built-in `--profile supabase`; unrelated profile/credentials were not changed.
- Applied the additive migration only to `qwrukdqtuhqkbrbtnekz` through SQL Editor: Success, no rows returned. Focused corrected RLS suite: seven tests pass, including owner allowance, reviewer denial, forged/nested paths and post-deletion denial.
- `npx tsx scripts/verify-hosted-keyless.ts --run`: **31/31 checks passed** against actual hosted Supabase and the local Next app. Covers invited fictional owner/reviewer/outsider identities, anonymous/cross-workspace denial, no-store responses, private direct upload, source download denial for all client roles, real-source admission block, duplicate handling, no-AI finalize/retry, absent transcript/analysis/grade/job, unsupported review denial, owner-only deletion, hosted object removal and late-save tombstone rejection.
- One intermediate test expected sample-style 404 for live unprocessed media. Actual documented route intentionally returns 403 `PLAYBACK_UNAVAILABLE`; corrected the acceptance assertion to require that error and no media URL. Application behavior was not changed for that assertion.
- Actual browser journey: fictional owner sign-in, generated one-second WAV selection/upload, Awaiting AI detail with no transcript/result, sign-out, reviewer sign-in and detail reload, no owner upload/delete controls, owner sign-in and typed-confirmation deletion, empty call log and sign-out. Fictional screenshots remain ignored. This is browser verification of a local frontend with hosted backend; it is not Vercel deployment acceptance or real AI.
- Fresh final local checks: `npm test` **42 tests pass in seven files**; `npm run lint`, `npm run typecheck` and `git diff --check` pass. No hosted-provider or workflow execution occurred.
- `npx tsx scripts/cleanup-hosted-keyless.ts --run`: removed three remaining fictional calls from failed/debug runs, six test workspaces and nine temporary users; revoked available test sessions, verified current bucket contents empty and deleted local test-account/recording files. The successful probe call and browser-upload call were already removed through application deletion. Ignored count/time-only cleanup receipt retained. This does not certify provider backups/log retention or end-of-real-test deletion.
- Remaining gates: server-key replacement, authorized ongoing owner/reviewer account provisioning, CLI migration-history reconciliation, Groq key/ZDR and actual provider fictional recording, CALL-013/source sanitization and all-20-call review, hosted workflow/recovery/log/backups, deployment and submission. No unrelated project, real call, paid plan, client message or recruiter START was used.

