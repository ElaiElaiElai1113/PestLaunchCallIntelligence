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

## Recorded stop and control repair

The round reached eleven actual requests. Same-contract diagnostics identified a six-fact overflow, Groq's explicit array-type requirement beside a refined reference, overlapping checkpoint-object union discriminators, and aggregate coaching above three. Corrected scoring finally passed wire/public/guard validation using retained successful fictional extraction. Semantic acceptance remains withheld: customer-only consensus evidence was downgraded and suggested company guarantees/discounts were unsupported. A lexical policy screen now withholds those suggestions and retains review reasons/raw original; it does not certify semantics.

The human told the agent to continue with the prepared client derivative. One private extraction diagnostic used only retained local ASR segments, unknown speakers and incomplete source; it classified the excerpt General and left cancellation outcomes unknown. This does not establish full-call classification or a completed pipeline. The owner stopped the process during its quota wait before scoring after independent review identified source-binding/phase/case-lock gaps. No app publication occurred. The stopped flag, consumed counter and held lock remain; no second client transmission is authorized by the local control repair.

The tracked runner now checks full-sequence headroom before credential reads, holds a whole-case lock, requires explicit hash-bound six-area fictional semantic acceptance for client cases, and checks exact source/derivative/ASR/input hashes plus unchanged ASR text/IDs/times and unknown/incomplete audit state. A normal client analysis cannot fit the single remaining slot. Additional external validation requires a separately bounded continuation after the stable control repair is reviewed; do not clear stops or reset counts to obtain it.
