# Progress and evidence

## Baseline — 8 October 2026

- Standalone project handoff created; application implementation has not started at this baseline.
- Product/source/design and Vercel/Supabase/Groq execution guidance are present.
- Private anonymized call-context notes are ignored by Git.
- No cloud resources, provider calls, paid services or deployment are claimed by this baseline.

## Implementation ledger

### Keyless build — 8 October 2026

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

