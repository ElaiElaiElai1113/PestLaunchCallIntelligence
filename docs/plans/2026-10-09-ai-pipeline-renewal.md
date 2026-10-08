# Renewed AI pipeline repair

The human requested a working AI pipeline using the supplied Drive recordings as examples on 9 October. This supersedes the previous local-only stop for this new work, without reopening or changing either historical probe round. The human separately authorized Global ZDR in the Personal Groq organization.

## Diagnosis and approach

Historical requests produced omitted rubric rows, provider JSON validation failures, and an omitted accepted-visit follow-up. The single request mixes extraction, purpose selection, every rubric, and coaching. Its array schema cannot enforce purpose-specific membership. Separate extraction from purpose-specific scoring. Require a strict object keyed by every selected rubric ID, resolve references exactly, and retain the unchanged public analysis/scorer/attribution guards. Preserve both exact responses as versioned provenance. No automatic model fallback, fabricated result, removed checkpoint, inferred speaker attribution or promoted completeness.

## Bounded verification

1. Reproduce fixed-membership and stage-publication failures locally before implementation.
2. Implement two-stage requests with conservative per-request admission, no SDK retries, and explicit quota handling in the private test harness.
3. Run focused tests, full tests, lint, typecheck and production build/privacy guard.
4. Use a new private persistent request ledger, capped at twelve actual requests including failures and ASR. Start with known fictional Sales, General and Retention calls. Stop on 413/429, exhausted cap or repeated semantic failure; no paid upgrade or fourth speculative repair within this renewed pass.
5. Only after fictional acceptance, verify ZDR saved state and Free plan, locally review/prepare one short Drive recording, then test transcription and analysis. CALL-013 remains quarantined. Never publish full recordings, transcript, prompts, responses, signed URLs or content screenshots to Git/logs/review messages.
6. Return exact revision and content-free evidence to PestLaunch planning and review under the standing human instruction.

## Acceptance boundaries

Client audio is explicitly authorized as test material, not public data. ZDR/privacy preparation are prerequisites for sending it to Groq. No new hosted database use, deployment, subscription purchase, client message or credential change is included. Direct provider acceptance is distinct from a new upload through the deployed app. Long calls that exceed conservative input admission remain unsupported until separately verified; do not silently truncate them.
