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

- Verified policy/acceptance-code commit: `57af4ea549a02c62109ecf430278e84fcf939bc5` on `codex/call-intelligence`. This documentation-only follow-up records that source revision.
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

### Local keyless review remediation — 8 October 2026

Implementation/source commit: `511f86c702ad72e8c833c07639b02eded559d1e8`; starting plan revision `a87ccae1fc9748940c054c5fff26153ddf8cf521`, clean `codex/call-intelligence`. This evidence/plan-status follow-up changes documentation only.

Scope: implemented Tasks 1–6 of `docs/plans/2026-10-08-keyless-review-remediation.md`, sequentially with one editing owner and no subagents. No credentials were inspected, `.env.local` was not changed, and no hosted acceptance/cleanup script, migration application, provider request, user provisioning, key rotation, deployment, purchase, source push or message to another chat occurred. All new test content is explicitly fictional. CALL-013 remains quarantined.

| Finding | Reproduction and final result |
| --- | --- |
| Source admission/copies | Two fresh embedded SQL failures demonstrated alternative filenames and post-finalize uploads were accepted. The new helper contract initially had no implementation. After repair: focused SQL/cleanup tests pass (15 tests); additional repository-port tests verify inventory/remove/survivor/folder failures preserve the tombstone and never call the row/receipt deletion RPC. Cleanup inventories both buckets, paginates, removes registered/alternative owned copies and preserves unrelated copies. |
| Manual guidance/grouping | Both new authority tests failed on the old collecting-details label and quadrant mappings, then passed after correction. Local source-manual excerpts confirm future-service information and Sales referral guidance. IDs, order, original 17/12/12 totals and thresholds stay fixed. |
| Unsupported publication | Five ASR contract failures reproduced confidence/missing-quality completeness certification or absent durable review reasons. A separate numeric regression reproduced Gold despite an independent quality-review reason. New guard contracts initially lacked implementation. Final tests preserve timestamps/text, default ordinary ASR and legacy live source context to unverified, reject unknown/customer-only employee evidence and unrelated employee-ID laundering, omit unsupported coaching and withhold grades/policy awards as appropriate. Raw parsed model output remains separate and unchanged. |
| Uncertainty across retries/reviews | Two mocked workflow persistence regressions failed before integration, then passed. Analysis failure/retry retains completeness/quality metadata and preserves different original/effective assessments. Mocked live review tests reject a reason-only unsupported pass, preserve the original output and retain independent quality/completeness reasons. No public certification endpoint was added. |
| Dispatch failure | The actual retry handler under injected repository/workflow ports returned 500 and left the queued/analyzing version before the repair; it now returns safe 503 with retryable PROCESSING_START_FAILED. Four operation tests cover preserved artifacts, later retry, version advance, deletion and initial conflict. Raw workflow exception text is not returned. |
| Follow-up labels | Running the new outcome cases against the old component wrapper produced seven meaningful failures: re-service intent, promises/unknown/reported completion and unsupported acceptance all became agreement. The final pure helper tests pass; only an accepted follow-up with actual cited text earns Follow-up agreed. Independent treatment/inspection/cancellation labels remain separate. |

Additive migration created by the installed CLI after command-help discovery: `20261008114517_bind_source_upload_to_registered_path.sql`, using `--profile supabase`. It restricts admission to the exact registered pending path and retains owner/workspace/live-call/tombstone guards. Both earlier migrations are unchanged. **This migration is not applied remotely.** Current Storage helper/list/remove docs and changelog were checked through public documentation only; no project connection was made. Embedded SQL and mocked Storage do not certify hosted in-flight upload races or backup retention.

Fresh final verification on the committed application source:

| Command | Result | Boundary |
| --- | --- | --- |
| `npm test` | 88 tests pass, 15 files | Fictional domain/store fixtures, injected Groq HTTP responses, PGlite policies, mocked repository/Storage/workflow/review/retry ports; no hosted/provider calls |
| `npm run lint` | Pass | Owned code/config |
| `npm run typecheck` | Pass | Application and test TypeScript |
| `npm run build` | Pass | Production Next bundle and workflow compilation (19 steps, one workflow); no execution of a provider or hosted workflow |
| `git diff --check` | Pass | Owned patch whitespace |
| `npx playwright test --config playwright.mocked.config.ts` | One Chromium test passes | Separate port 3001 and ignored QA build output; empty Supabase/Groq environment overrides; all `/api/` responses mocked, unexpected API/external requests rejected |

The mocked frontend check verifies Re-service discussed rather than Follow-up agreed, the truthful empty coaching message, and layout at 320/390/768/1024/1440 px. Screenshot is ignored under `.private/evidence/`. It does not establish live Auth/Storage, sample CRUD, native zoom/AA accessibility conformance, recording playback or durable recovery. The earlier HTTP/sample E2E suites target port 3000 and mutate persisted sample data; they were deliberately not run against the configured backend or another running app. Their fresh full-journey acceptance remains pending a separate isolated sample datastore/harness. Playwright emitted only environment color-setting warnings, not application errors or test failures.

Review → fix → review was completed on the owned changes: checked admission privilege narrowing, cleanup failure ordering, immutable originals, guarded score/status publication, error mapping, unchanged missing metadata and no-store/auth boundaries, and default/QA build isolation. A test-port implicit parameter type was corrected during focused typechecking. No persistent issue required more than the three-round cap. Documentation now explicitly states that a sanitized-bucket copy is not automatic redaction and that trusted completeness/attribution review is still missing.

Residual gates: replace the exposed server key before any hosted use; deliberate hosted application/reconciliation of all three migrations; ongoing invited owner/reviewer accounts; trusted source completeness/attribution and verified private sanitization; Groq model/quota/ZDR/no-training and real-provider fictional recording; hosted Storage races/workflow run reconciliation/recovery/deletion/log/backup retention; authorized commercial deployment; all-20-call private evaluation; source/Loom submission and end-of-test retention/deletion. None is closed by this local slice or the historical 31 hosted checks.

