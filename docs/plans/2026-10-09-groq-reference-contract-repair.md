# Groq Reference Contract Repair Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` sequentially in the existing implementation chat. One editing owner, no subagents. Execute the local repair and bounded fictional-provider validation below, then return the exact revision and evidence for independent review. Do not stop after another plan. This is the next architectural repair attempt after the discarded prompt-only and full evidence-pair-enumeration experiments; if it remains unsuccessful after the bounded round, report the concrete failure rather than starting a fourth strategy.

**Goal:** Get actual fictional Groq analyses through strict application acceptance with faithful source evidence, valid coaching references and a request/output budget suitable for the current Free account.

**Architecture:** Keep one Groq analysis request and the current public `Analysis` format. Introduce a compact, versioned provider-only contract: the model chooses segment references rather than copying quotations, and optional coaching sits under its checkpoint assessment. A deterministic resolver obtains verbatim evidence from those exact source references and builds public coaching from the parent checkpoint. Preserve the raw provider contract alongside normalized original/effective history and retain every existing evidence, attribution, completeness, rubric and publication guard.

**Tech stack:** Existing pinned Groq SDK, Zod, TypeScript, Next.js/Workflow, Vitest and Playwright. No additional AI vendor, model switch, database migration, tokenizer installation or hosted operation is required for this slice.

## Authority and boundaries

The human supplied a Groq test key and directly said “Okay, conitnue with testing” in the implementation chat after Free quotas were shown. This review verified the human testing instruction without inspecting or printing credentials. That supersedes the old empty-key restriction **only for explicitly fictional Groq testing with the existing server-only configuration**. Ordinary sample/QA launchers must still force empty backend/provider keys. Real customer processing remains false.

- Root: `C:/Users/Admin/Desktop/Projects/Portfolio/PestLaunchCallIntelligence`; branch `codex/call-intelligence`. Starting clean documentation HEAD: `6dce8b1b2c9387659323e13a0e8678c9c3f8e2c9`; application: `3594559a70c681109e2395356ad52cb1963d0966`.
- Read `AGENTS.md`, required product/source/scoring documents, the latest evidence entry and this plan. Amend the stale current-direction paragraph in AGENTS/README to reflect fictional-provider authority; preserve every privacy/account/cost restriction.
- Do not print or inspect the key value, dump environment/header data, change other credentials, read Supabase secrets, launch the configured application against its hosted backend, or enable real processing. The probe process may use the already authorized Groq server configuration in memory.
- No customer audio/transcripts, hosted scripts/migrations/accounts/key rotation, deployment, Groq settings changes, paid usage/upgrades, purchases, GitHub creation/push or client/recruiter messages. Existing exposed server-key, migration-history/third-migration, invited-account, private Storage/RLS/Workflow, retention and deployment gates remain open.
- Current Groq privacy settings were reported off; newly generated fictional examples are the only permitted real requests. This is not customer-data/ZDR/no-training acceptance. Do not change data-sharing/batch/fine-tuning toggles or use those features.
- Preserve unrelated work and all old private artifacts. Application changes are owned by this implementation chat only; this review chat edited the plan only.

## Reviewed facts and limitations

The retained metadata confirms six requests: Whisper 200; chat 400 `json_validate_failed`; three chat 200 responses; final chat 413 `rate_limit_exceeded`. Reported successful chat usage totals 21,109 tokens; failed-generation usage is unknown. Saved ASR has 11 segments, unknown speakers and unverified completeness. The spoken source is explicitly fictional, 62.345 seconds; ordered-word recall is not WER or human accuracy proof.

The implementation reported rejecting the 200 responses for coaching/rubric-ID errors and real quotations attached to the wrong segment. Its safety behavior was correct: no analysis/grade was substituted. However, the runner overwrote `<case>-response.json`; only the final 413 response is retained in `known-response.json`, and the earlier 200 response bodies are absent from the current directory. Those old response-level defects cannot now be independently replayed. Fix probe evidence preservation in this round.

Fresh review ran 19 provider/sample-integrity tests successfully with injected responses and no actual provider request. Captured baseline request dimensions: 16,204 serialized characters; 9,894 message characters; 6,114 schema characters; `strict:true`; 12,000 maximum completion tokens. A local schema-sizing prototype using references, shared definitions and nested coaching was 3,717 schema characters. This is sizing evidence, not a proven provider fix.

Three approaches were considered:

1. More quotation instructions: already failed and still depends on copying/binding two independent outputs.
2. Full quote/ID-pair enumeration: repeats source content in the schema and exceeded the reported 8,000 TPM limit; do not restore it.
3. **Selected:** source-reference output, deterministic source excerpts, coaching attached to its checkpoint, shared schema definitions and shorter output. This removes copying and independent coaching-ID selection from the model's job. Semantic relevance still requires validation/review; a real quote alone never proves a checkpoint.

Current primary references support strict mode on GPT-OSS120B, closed/required object schemas, and `$defs`/`$ref`: [structured output](https://console.groq.com/docs/structured-outputs). GPT-OSS supports low/medium/high effort and `include_reasoning:false`; **do not use `reasoning_format` with GPT-OSS**, per [reasoning documentation](https://console.groq.com/docs/reasoning). Request controls are in the [API reference](https://console.groq.com/docs/api-reference); quota headers distinguish TPM from daily request limits in [rate-limit documentation](https://console.groq.com/docs/rate-limits). These docs do not prove schema transport or semantic success for our application.

## Task 1 — Define and test the compact provider contract

**Create:** `src/lib/groq/analysis-contract.ts`, `tests/unit/groq-analysis-contract.test.ts`.
**Use unchanged:** public `analysisSchema`, `validateEvidence`, `guardAssessment`, `computeScore`, `RUBRICS` and original 17/12/12 definitions.

- [ ] Build a schema factory from the actual supplied segments. Reject empty/duplicate source IDs. One shared evidence schema contains `segmentIds` chosen from the current source ID enum, with at most six references. It contains **no model-authored quote field**. All wire objects are strict; fields are required, nullable where appropriate.

```ts
const refs = z.strictObject({
  segmentIds: z.array(z.enum(segmentIds)).max(6),
});
const checkpointId = z.enum([...new Set(
  Object.values(RUBRICS).flatMap(rubric => rubric.map(item => item.id)),
)]);
const coach = analysisSchema.shape.coaching.element
  .omit({ evidence: true, checkpointId: true });
const checkpoint = analysisSchema.shape.assessments.element.extend({
  id: checkpointId,
  reason: z.string().max(240),
  evidence: refs,
  coaching: segments.some(segment => segment.speaker === "employee")
    ? coach.nullable()
    : z.null(),
});
```

- [ ] Build the wire root by omitting public top-level `coaching` and replacing evidence in outcomes/facts/follow-ups/assessments with `refs`. Assessment array still contains every checkpoint exactly once for the selected purpose. Unknown purpose has no assessments/coaching. Limit summary to 800 characters, facts to six, follow-ups to four; request concise reasons and a single useful strength plus at most two improvements across all checkpoints. No point/grade/rep/date fields may enter the wire contract.
- [ ] Generate JSON Schema with installed `z.toJSONSchema(wireSchema, { reused: "ref" })`; remove `$schema`. Reuse ID enums/objects through shared definitions. Do not repeat transcript text, quote enums or full evidence objects as enum values. Use the SDK's actual schema type rather than bypassing TypeScript with `any`.
- [ ] Implement a pure resolver. Validate refs before materialization: known IDs only, no duplicates, in source order, no silent reordering. Empty refs map to empty evidence; whether that is permitted depends on existing public evidence validation. Exact full text of selected segments, joined with a space in their referenced order, becomes the displayed source excerpt. If the excerpt exceeds the public 2,000-character limit, reject it; do not truncate, search another segment or generate replacement wording.

```ts
// A wire assessment's optional coaching is joined by its parent, not a second ID.
const publicItem = { id: item.id, status: item.status, reason: item.reason,
  evidence: resolveRefs(item.evidence, segments) };
const publicCoaching = item.coaching === null ? [] : [{
  ...item.coaching,
  checkpointId: item.id,
  evidence: structuredClone(publicItem.evidence),
}];
```

- [ ] Aggregate coaching and reject more than three items, more than one strength or more than two improvements; keep existing role/evidence guards. A wire coaching item must never carry an independent checkpoint ID or invented evidence. One optional item per checkpoint is sufficient for this compact request; prioritize the most useful feedback. Do not generate missing feedback with static templates. Explicitly reject nonempty assessments when purpose is unknown; the scorer's early unknown return alone does not check that rule.
- [ ] Validate materialized output with unchanged public `analysisSchema`, `validateEvidence`, rubric membership/scorer checks and coaching membership checks, then apply existing guards. Never omit an invalid reference or fabricate a pass to make the response acceptable.
- [ ] Tests: legacy wrong quote plus ID is rejected as an extra wire field; selected reference resolves to that exact segment, never another turn containing matching words; unknown/duplicate/out-of-order refs rejected; oversized excerpt rejected without truncation; wrong/duplicate/missing rubric IDs rejected; coaching derives only its parent ID/evidence; empty/unsupported employee coaching withheld or rejected; source and raw wire remain unchanged; public output passes its strict schema. Test irrelevant but technically valid citations as a **semantic review risk**, not as proof of correctness.
- [ ] Run `npm test -- tests/unit/groq-analysis-contract.test.ts tests/unit/assessment-guards.test.ts tests/unit/sample-integrity.test.ts`; expected focused tests pass after meaningful red/green failures. Commit this contract and tests.

## Task 2 — Integrate the adapter and a conservative Free request budget

**Modify:** `src/lib/groq/provider.ts`, `tests/integration/provider.test.ts`.
**Create:** `src/lib/groq/analysis-request.ts`, `tests/unit/groq-analysis-request.test.ts`.

- [ ] Keep model `openai/gpt-oss-120b`, `temperature:0`, one non-streaming strict JSON-schema request, SDK `maxRetries:0` and existing timeout. Set `reasoning_effort:"low"`, `include_reasoning:false`, `max_completion_tokens:3000`. No `reasoning_format`, automatic model fallback, best-effort/JSON-object fallback, tool calls or provider retries.
- [ ] Generate a compact rubric guide from `RUBRICS`: exact purpose → ordered IDs; a shared ID → guidance dictionary; explicit per-purpose overrides where guidance differs (especially Sales future-service/referral information). Omit repeated visual labels/group names. Test that every original purpose/checkpoint resolves to exactly its authoritative guidance. Never remove a checkpoint to save tokens.
- [ ] Prompt specifies the reference contract, untrusted transcript/source verification, independent business outcomes, no guessed identities/dates/account actions, complete-source/no-objection requirements, and optional coaching attached to the evaluated checkpoint. When no employee speaker is established, all checkpoint coaching is null. Coaching about an absent step on a reliable complete source must cite a real employee context segment (such as the actual closing), never invent the missing words; otherwise keep coaching null. Unknown/applicability uncertainty stays unresolved; the model cannot award grades.
- [ ] Preflight the actual serialized messages plus schema at **12,000 UTF-8 bytes maximum**. Record a coarse estimate `ceil(bytes/3)+256`, plus the 3,000 output cap, against the observed 8,000 TPM policy. This is a conservative English/JSON test heuristic, **not an exact tokenizer or proof of quota admission**. Use actual provider usage/headers to assess it. Oversized input fails before fetch with a safe `ANALYSIS_BUDGET_EXCEEDED` code; retain the complete source rather than truncating its ending. No new tokenizer dependency or automatic chunking system in this repair.
- [ ] Require `finish_reason:"stop"`, parse JSON strictly against the wire schema, resolve and validate, then return original/effective materialized assessments plus the exact raw wire JSON/provenance. A 400, 413, truncation, malformed JSON or bad reference yields no application-accepted analysis. A structurally accepted response can still be semantically wrong: that fails the separate probe/manual acceptance and cannot be presented as a correct client result. Do not claim the resolver can automatically judge every rubric meaning.
- [ ] Add request-capture tests for model/strictness/effort/output cap, no copied quotes or transcript body in schema enums, reused definitions, byte-budget refusal with zero fetches, complete rubric guidance, unknown-speaker null coaching, strict malformed/refusal/truncation handling and unchanged evidence guards. Update old injected responses to the real wire contract; do not have a mocked adapter bypass the new parser.
- [ ] Run `npm test -- tests/integration/provider.test.ts tests/unit/groq-analysis-contract.test.ts tests/unit/groq-analysis-request.test.ts`, lint and typecheck. Commit only the adapter/budget changes and tests.

## Task 3 — Preserve exact raw and normalized history through publication

**Modify:** `src/lib/domain/types.ts`, `src/workflows/process-call.ts`, `src/components/workspace-shell.tsx` safe error mapping, existing workflow/re-analysis tests and architecture/scoring documentation.

- [ ] Add optional protected payload provenance, using this type or its typed wire equivalent:

```ts
export type ProviderOutput = {
  contract: "call_analysis_refs_v1";
  model: string;
  content: string; // exact accepted message.content JSON, never credentials/reasoning
};
// CallRecord optional fields:
// originalProviderOutput?: ProviderOutput | null;
// latestProviderOutput?: ProviderOutput | null;
```

- [ ] Adapter returns `providerOutput` in addition to public original/effective results. Initialize first raw provenance only with the first original analysis of a new call; update latest provenance on a newly accepted result. Legacy original analyses remain unchanged and clearly legacy; do not pretend a later reference-contract output was their initial response. Preserve current source/analysis revisions, immutable original segments and historical review decisions.
- [ ] Publish these fields only inside the existing ownership/version/source-revision CAS. Workflow arguments/step returns remain identifiers and safe metadata; provider content stays only in protected call/analysis-version storage. Do not return it from a durable workflow step or log it. Invalid provider output never becomes an accepted original/effective assessment; fictional probe failure artifacts are stored separately for diagnosis.
- [ ] Handle `ANALYSIS_BUDGET_EXCEEDED` as a safe terminal failure with retained transcript/history and a truthful explanation that the current analysis limit was exceeded. Do not advertise complete 60-minute/free analysis support from this short fictional test. Do not increase quotas or start paid processing. Existing isolated QA remains keyless.
- [ ] Tests: raw wire content immutable, normalized source excerpts distinct from raw model JSON, first/latest behavior across re-analysis, legacy original preserved, no old manual decision replay, no publication after deletion/new owner/source revision conflict, budget failure preserves artifacts and finishes the owned attempt. Mocks that omit optional provenance must not erase existing provenance.
- [ ] Run the focused workflow/re-analysis suites, then `npm test`, lint, typecheck and `npm run build` including its mandatory privacy guard. Commit. Do not run real requests before local contract/publication checks pass.

## Task 4 — Run and retain one bounded fictional-provider validation round

**Create:** `scripts/test-groq-fictional.ts`, a deliberately separate `test:groq:fictional` command and local tests of the runner's request cap/artifact behavior.
**Private data:** reuse the existing fictional source/ASR under `.private/qa/groq-fictional-20261009` read-only; save new results to a fresh UUID folder under `.private/qa/groq-reference-20261009/`.

- [ ] Explicit opt-in only; `npm test`, builds and browser/HTTP suites never invoke this runner. Require the current authorized configuration and a caller-selected case. Validate only `https://api.groq.com/openai/v1/chat/completions` may be fetched and set `redirect:"error"` so an automatic redirect cannot leave that origin. Do not inspect other secret values or use the configured Supabase backend. No real workflow/Storage/app-upload dispatch.
- [ ] Persist a cap ledger **before** every fetch, counting failures/timeouts/crashes. Maximum **six new chat requests total for this plan**, output cap 3,000 each, one at a time, no automatic retries. Do not reset the ledger to bypass the bound. The earlier six probes remain a closed historical round. No extra ASR request is required because this repair leaves transcription unchanged.
- [ ] Use unique per-request filenames (ordinal/case/UUID), immutable source/request/schema hashes, application revision, UTC timestamp with Manila-facing dates, status, finish reason, usage, safe validation issue paths and quota headers. Save each synthetic request body and provider JSON response privately for exact replay; exclude auth headers, key values, full SDK errors and reasoning. Never overwrite earlier responses. Terminal/user-visible logs contain metadata only, not full prompts/transcripts/model content.
- [ ] Respect the verified Free account and quota headers. `x-ratelimit-remaining-tokens`/reset describe TPM; request headers describe daily request quotas. Pace serial calls using reset information and conservative headroom, with progress communication during waits. Unknown quota state is not zero usage. Stop on 413/429, credential/privacy/account mismatch or exhaustion; no rapid retry, key rotation, plan change or bypass. Actual failed-generation usage may be unknown; do not report the successful-output tally as exhaustive.
- [ ] Initial three cases, in order:
  1. **Known attributed one-time script:** source roles/completeness from the explicitly fictional curated dialogue, not inferred from ASR. Verify transport, wire schema, refs, public schema/guards and coaching acceptance. Separately audit every checkpoint against the manual and expected curated behavior; correct one-time acceptance/price, no collected payment/signature/account execution, recurring objection present. An official grade requires all trusted/evaluable conditions; never force the fixture's number onto a different model judgment.
  2. **Saved actual ASR:** use its 11 original segments, unknown roles and unverified completeness. No ordinal/text-based speaker mapping. An accepted partial analysis can extract evidenced purpose/outcomes, but must have no employee coaching, no official grade and no no-objection policy award.
  3. **Known general service dialogue:** verify General 12, appropriate outcome/visit acceptance, future-service omission and useful evidence-linked coaching. Independently audit semantics, not just successful parsing.
- [ ] Only if these succeed, use at most the remaining three requests for a known retention/unknown-applicability case, a repeat known-sales check, or a precise diagnostic of an observed failure under this same contract. State the purpose before dispatch. No exploratory prompt/schema/model shopping. Treat the discarded two approaches as prior failures; if this reference-contract strategy still cannot satisfy acceptance within the bound, return its exact cause and stop before a fourth strategy.
- [ ] A known-source semantic disagreement must be recorded, not hidden by promoting unknowns or altering the manual. Use checkpoints/evidence/outcomes/coaching review in a private synthetic report. Wire references eliminate copying/binding mismatches by construction; they do not prove the selected segment is relevant or that the summary is true.
- [ ] Record separately: transport success; strict wire/public acceptance; safety-guard acceptance; semantic correctness; repeatability observed. The direct adapter probe is not an uploaded-call/hosted/deployed test. Commit only source/tests and content-free evidence documentation; all synthetic bodies/media remain ignored.

## Task 5 — Close the local repair and return evidence for review

**Modify:** `docs/evidence/progress.md`, `docs/client-requirements-matrix.md`, `docs/evidence/client-v1-demo-checklist.md`, `docs/submission.md`, README/current-direction notes and this plan's checkboxes.

- [ ] State the authorization change precisely: current key exists server-only for fictional direct-provider testing; sample QA still overrides it empty; real customer, hosted/deployment and settings/cost actions remain unauthorized in this slice. Historical empty-key/local acceptance remains historical.
- [ ] Explain the new reference contract and raw-versus-normalized history. Source excerpts are deterministic views of model-selected references, not model-created quotes silently corrected afterward. All old invalid V1 outputs stay rejected.
- [ ] Report exact committed application/docs revisions, clean/dirty state, local test counts, build privacy results, request totals, usage/unknown usage, per-case transport/schema/guard/semantic results, persistent failures and retained synthetic replay evidence. Remove stale claims that a direct-ASR 200 proves working call analysis.
- [ ] If adapter/publication/error UI changes affect existing flows, run the isolated actual HTTP/browser and separate mocked suites once on the final revision. Do not run them against configured port 3000/backend or rerun unchanged checks merely for reassurance. No native-device/zoom/hosted/audio-accuracy claims from mocked silence or fixtures.
- [ ] Self-review → fix → review, with at most three local repair rounds for a persistent issue and the architectural-attempt/request caps above. Return the completed source/evidence to the planning/review chat under the human's standing instruction. No independent acceptance or client-demo claim before review.

**Remaining client acceptance:** Replace exposed hosted credentials before further hosted use; reconcile/apply migrations deliberately; verify private Auth/Storage/Workflow/access/recovery/deletion/retention/privacy; authorize commercial hosting; process a newly uploaded spoken fictional recording in the deployed app; deliver actual private source/GitHub and a sanitized Loom. Current direct fictional-provider authority does not authorize any of those actions or real customer testing.
