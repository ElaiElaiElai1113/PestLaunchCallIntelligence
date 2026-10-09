import type { CallRecord } from "./types";
// Suggestions are draft aids, never source verification or score eligibility.
export function speakerSuggestions(call: CallRecord) {
  const proposal = call.speakerProposals;
  if (
    !proposal ||
    proposal.sourceChecksum !== call.checksum ||
    proposal.sourceRevision !== (call.sourceRevision ?? 0) ||
    proposal.roles.length !== call.segments.length ||
    proposal.roles.some(
      (role, i) =>
        role.segmentId !== call.segments[i].id ||
        !["unknown", "employee", "customer"].includes(role.speaker) ||
        !Number.isFinite(role.confidence) ||
        role.confidence < 0 ||
        role.confidence > 1,
    )
  )
    return null;
  return Object.fromEntries(
    proposal.roles.map((role) => [
      role.segmentId,
      role.confidence >= 0.85 ? role.speaker : "unknown",
    ]),
  );
}
// Operator-requested AI defaults. Preserve ASR and never overwrite a review.
export function applySpeakerSuggestions(call: CallRecord): CallRecord {
  if (
    call.sourceReviews?.length ||
    call.segments.some((s) => s.speaker !== "unknown")
  )
    return call;
  const suggestions = speakerSuggestions(call);
  if (!suggestions || !Object.values(suggestions).some((s) => s !== "unknown"))
    return call;
  const next = structuredClone(call);
  next.originalSegments ??= structuredClone(call.segments);
  next.originalSegmentsProvenance ??= "legacy_snapshot";
  next.segments.forEach((s) => (s.speaker = suggestions[s.id]));
  next.sourceRevision = (call.sourceRevision ?? 0) + 1;
  next.pendingExtraction = null;
  next.speakerAttribution = {
    kind: "ai",
    model: call.speakerProposals!.model,
    sourceChecksum: call.checksum!,
    sourceRevision: next.sourceRevision,
  };
  next.transcriptReviewReasons = [
    ...new Set([
      ...(call.transcriptReviewReasons ?? []),
      "AI speaker labels need review.",
    ]),
  ];
  return next;
}
