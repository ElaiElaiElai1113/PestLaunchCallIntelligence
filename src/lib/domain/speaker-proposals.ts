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
