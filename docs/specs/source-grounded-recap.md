# Source-grounded recap and details proposal

Status: proposed for review, **not active**. The current extraction contract is unchanged. This addresses repeated actor attribution and uncited compound amounts without another provider, a redesign or a fabricated correction of existing output.

## Provider-only contract

Introduce `call_analysis_source_refs_v3`. Retain the existing primary purpose, secondary intents, bounded title, independent outcomes, followups, completeness and review reasons. Replace the generated `summary` string with required `recap: { segmentIds }`, selecting one to six actual source IDs. Replace each generated fact label/text with `{ kind, evidence: { segmentIds } }` (maximum six facts). `kind` is one of `pest_report`, `service_preference`, `price_quote`, `appointment`, `payment_terms`, `other`. Every detail selects one to six source IDs. All IDs use the exact finite source enum; objects remain closed/fully required. Scoring stays a separate purpose-specific stage with employee-selectable evidence and complete conversational context.

Example producer shape, with explicitly fictional IDs:

```json
{
  "recap": { "segmentIds": ["seg-2", "seg-5", "seg-6", "seg-8", "seg-9"] },
  "facts": [
    { "kind": "price_quote", "evidence": { "segmentIds": ["seg-5"] } },
    { "kind": "payment_terms", "evidence": { "segmentIds": ["seg-9"] } }
  ]
}
```

This selects source passages; it is not an actual provider result. A payment detail selecting only segment 9 displays only its actual payment timing/no-collection wording. It cannot add an uncited `$200`. The separate price detail shows the actual spoken amount in segment 5.

## Deterministic normalization and provenance

Resolve IDs directly against the unchanged source. Reject unknown, duplicate or out-of-source-order selections; never sort, rematch, repair or invent references. Each recap line contains the source's employee/customer/unknown label, call-relative timestamp and **full exact segment text**. Unknown stays unknown. No inferred name, direction, calendar date, tone, CRM action, paraphrase, number conversion or generated actor sentence is added.

Public `summary` becomes these labelled source excerpts; detail labels come from the six controlled kinds, while `text` and evidence quote contain the exact selected source text. Existing public limits remain: summary 1,800 characters, fact text 800, evidence quote 2,000. Exceeding a selected-source limit fails closed with retained source and a review-required error; no truncation. Selection quality/coverage, classifications, outcomes, followup states and coaching still require semantic review. Exact quotations establish source fidelity, not the truth of every interpreted event or ASR correctness.

Preserve every exact provider response string in protected v3 provenance, alongside normalized original/effective data. Add v3 to the supported provenance union; keep v1/v2 readers/history unchanged. Do not transform historical summaries or represent a static correction as a new model response. The new contract/request hash invalidates old extraction caches. Source/version/attempt/run/CAS/publication fences and protected storage remain unchanged; durable workflow parameters/returns stay identifiers and safe metadata.

## Existing interface

Keep Summary, Scorecard, Coaching and Transcript. Render the recap in the existing Summary area as compact labelled excerpts with timestamp/evidence actions that use existing authorized prepared-media/transcript navigation. Render important-detail cards with the controlled noun label and quoted source words. Do not present these as model-written prose. Keep independent commitment fields and the existing warning that spoken commitments do not prove account execution. Curated text-only examples remain clearly fictional and have no recording.

## Activation and acceptance

Before activation: review actual generated strict schemas, representative Sales/General/Retention request budgets, source fidelity/unknown-role/over-limit tests and the minimal renderer. Test immutable raw/history and cache invalidation boundaries. No actual provider request is authorized by this proposal; the current phase has five of six consumed, so its remaining slot cannot validate a fresh v3 E/S pair. Hosted/model acceptance is a separate reviewed step after current handoffs and scope gates.

Source-summary/detail selection prevents generated wording from assigning a customer's actual words to an employee or adding an amount absent from the selected passage. It does not certify full-call coverage, speaker identification, recording quality, business interpretation or useful coaching. Grades remain deterministic and withheld when unresolved.
