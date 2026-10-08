# PestLaunch private deployment runbook

The human requested Vercel hosting and a client-testable demo on 9 October 2026. This runbook makes the remaining work concrete; it is not deployment evidence.

## Verified accounts and pending handoffs

- Vercel CLI 54.0.0 is authenticated. Read-only `/v2/teams` confirms `setterlun-ventures` active Pro; personal team is Hobby. Human selection of Setterlun Ventures for this separate project is pending. Do not change unrelated team projects, billing, security settings or subscriptions.
- Dedicated Supabase project: `qwrukdqtuhqkbrbtnekz`, Projects organization, Sydney Free, healthy. Dashboard shows no recorded migrations/backups. Both available connector links denied access. This does not mean the previously SQL-applied schema is missing.
- The previously exposed server key must be replaced, the old key revoked, and the new value saved only in ignored `.env.local`. Browser credential creation/change requires human completion. Never reveal/copy the value to chat, source, screenshots or logs.
- GitHub CLI is authenticated to the user's account. The [private repository](https://github.com/ElaiElaiElai1113/PestLaunchCallIntelligence) was created, reviewed candidate `394553b` pushed and private visibility read back. No collaborator was added. History audit inspected 383 blobs: no private/media/env paths except `.env.example`, and no credential-pattern matches. Pattern scanning is not proof against every possible confidential detail. Only tracked application/docs history was pushed; new unreviewed work remains local until accepted.

Local semantic repair now passes292tests/33files and lint/typecheck/build; independent acceptance is pending. Direct provider aggregate is3of6, parent and diagnostic stopped. The exact replay is useful partial output but rejected by six-area review; no deployment/new-upload/Loom acceptance.

## Release sequence

1. Confirm the selected existing commercial Vercel team, included usage and spend controls. Pro can incur on-demand usage beyond included credit: do not call hosting free or purchase upgrades/add-ons. New paid usage needs an approved concrete cap. Current primary reference: [Vercel Pro billing](https://vercel.com/docs/plans/pro-plan).
2. After server-key replacement, reconcile exact SQL-applied schema and migration history. Review/apply only the pending `20261008114517_bind_source_upload_to_registered_path.sql`; do not blindly rerun the initial schema. Check private buckets, workspace RLS, grants and registered-path upload admission.
3. Provision isolated authorized owner/reviewer identities without sending client mail. Confirm public signup and anonymous sign-in remain disabled. Verify foreign-workspace and anonymous access denial.
4. Create/link only the separate PestLaunch Vercel project under the authorized scope. Keep preview protection; do not use `--public`, paid password-protection add-ons or broader source/data access. Production must use invited application authentication.
5. Set public Supabase URL/publishable key, server-only replacement Supabase key and Groq key, pinned transcription model, exact `APP_ORIGIN`, and initially `REAL_CALL_PROCESSING_ENABLED=false`. Transfer secrets through stdin or a supported secret API; never command-line literals or echoed output. Preview and production origins must each match the environment where operations run. Add only the observed app origin to Supabase Auth redirects.
6. Build with `npm run build`, including the privacy guard. Confirm the hosted Workflow runtime supports the installed pinned SDK. Deploy, inspect the returned URL/revision, and test invited login plus private upload while AI is disabled first.
7. Verify current Groq Free quota and Global ZDR, then run a newly recorded fictional spoken call through actual hosted ASR/extraction/scoring. Record source/model/revision/hash metadata privately. Unknown speaker roles/completeness require audited review and owner re-analysis; never infer them automatically. Inspect all seven client capabilities and exact rubric/coaching semantics.
8. Test reload, reviewer authorization, evidence playback, reasoned correction/history, transient failure/retry and disposable fictional deletion. Actual scheduler/concurrency/backup retention are distinct from local tests. Keep customer recordings quarantined/private until source preparation is verified.
9. Inspect an allowlisted private source package and create/verify the intended private source remote. Record a 4–5 minute Loom using the accepted fictional hosted flow in `docs/demo-script.md`. Verify playable app/source/video links before delivery. Client messages and recruiter START remain human actions.

## Safe demonstration while hosting is held

Run `npm run demo` and use the fresh isolated fictional text workspace on port 3003. State that these curated examples have no audio or AI execution. This is useful for rehearsing navigation, evidence, correction/history and the narration; it does not satisfy deployed recording processing.

Do not delete confidential test materials until the full test ends. Then verify source/derivative/transcript/analysis/review/local-copy cleanup and report any provider/log/backup retention limitation.
