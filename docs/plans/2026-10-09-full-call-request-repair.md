# Full-call request repair

Human direction: continue test → repair → test until the client task works, using downloaded CALL 014 or Drive when necessary. This renews implementation authority for the size failure; old provider ledgers, caps and terminal locks remain immutable. No review-chat messages, subagents, paid upgrades or unrelated changes.

## Design

Keep the existing extraction/scoring pipeline and short-call contract. If its whole-case admission fails, use a versioned compact wire contract: evidence selects zero-based row indices. Each row presents exact role and text; original IDs/timestamps remain unchanged in storage and an explicit index-to-ID provenance map. No turns are summarized, clipped, merged, selected or reordered. Source binding for extraction reuse includes the entire segment object, including timestamps, rather than only the compact prompt. Integer schema ranges replace repeated all-source ID enums; scoring retains employee-only index membership. Decode only evidence.segmentIds, then run every existing exact-source, ordering, attribution, semantic and grade guard. Store raw model bytes; never salvage invalid old output.

Local sizing showed whole-rubric guidance still exceeds admission. Split scoring checkpoint keys into groups of at most six while each group sees the entire dialogue. Validate every group before the next transmission and require agreement on noObjections; retain full rubric order/denominator and all raw group bytes. Never publish a partial group result. Display up to three supported coaching items in group order, without claiming global prioritization. The observed Sales case requires extraction plus three groups; General/Retention require extraction plus two groups.

Compact extraction and scoring prompts retain primary/secondary purpose rules, distinct outcomes/actions, complete-source and employee evidence rules and all selected manual checkpoint guidance. Output reserves may be lower for the compact representation, but the 12,000-byte and 8,000-estimated-token per-request limits remain. Admission checks every possible scoring stage before extraction. No automatic retries or paid model fallback. Inputs still exceeding admission remain honestly blocked; this is not unbounded 60-minute acceptance.

## Sequential execution

- [x] Reproduce a synthetic 112-turn, approximately 5,100-character input with a failing whole-case admission test. Confirm full source equality and final-turn presence, schema membership and no customer scoring evidence.
- [x] Implement compact request/schema/decoder in src/lib/groq/indexed-contract.ts, integrate fallback in analysis-request.ts and validated decode/provenance/cache binding in provider.ts. Extend ProviderOutput and workflow cache contract recognition.
- [x] Integration regressions: exact materialized final-turn evidence, raw bytes preserved, malformed index/duplicate/out-of-order/customer references rejected, timestamp/source edits invalidate extraction reuse, unknown roles withhold scoring. No real keys in tests.
- [x] Identify CALL 014 by local file hash and Drive context; local ASR/privacy preparation only. Do not infer consent to upload a new unverified derivative or treat local machine ASR as known-reference accuracy.
- [x] Run focused/full tests, lint/build, browser/HTTP sequentially. Inspect fresh hosted request-size admission read-only before any live retry. Review own revision and repair at most three rounds per persistent issue.
- [ ] Deploy the verified repair to the same personal test project. Actual provider checks need current Free/ZDR verification and enough whole-sequence headroom; reserve a fresh bounded ledger before transmission. No old cap resets. Preserve failed/previous client results.
- [ ] Verify a new normal-size fictional recording end to end on Vercel; independently audit source fidelity, purpose, outcomes, grade eligibility and coaching. Supplied-call acceptance remains separate until privacy/source roles/completeness facts exist. Record remaining blockers without a ready claim.
