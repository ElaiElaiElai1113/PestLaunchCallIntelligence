import type { CallRecord } from "./types";
import type { z } from "zod";
import { sourceReviewSchema } from "./schemas";
import { computeScore } from "../scoring/engine";
export const STALE_SOURCE_REASON =
  "Transcript source changed; re-analysis required.";
export const analysisCurrent = (call: CallRecord) =>
  !!call.analysis &&
  (call.analysisSourceRevision ?? 0) === (call.sourceRevision ?? 0);
export function activeProcessing(call: CallRecord) {
  return (
    call.processingAttempt?.state === "pending" ||
    call.processingAttempt?.state === "running" ||
    ["queued", "transcribing", "analyzing"].includes(call.status)
  );
}
export function sourceReviewBlock(
  call: CallRecord,
  realAllowed: boolean,
): string | null {
  if (activeProcessing(call)) return "PROCESSING_ACTIVE";
  if (
    call.status === "privacy_review" ||
    [
      "UPLOAD_PENDING",
      "PRIVACY_APPROVAL_REQUIRED",
      "PRIVACY_REVIEW_REQUIRED",
    ].includes(call.errorCode ?? "")
  )
    return "PRIVACY_APPROVAL_REQUIRED";
  if (!call.segments.length) return "TRANSCRIPT_REQUIRED";
  if (call.mode === "sample") return null;
  const preparation = call.sourcePreparation;
  if (
    !preparation ||
    !call.checksum ||
    preparation.checksum !== call.checksum ||
    !preparation.attestedBy ||
    !preparation.at ||
    !call.sanitizedPath?.startsWith(`${call.workspaceId}/${call.id}.`)
  )
    return "SOURCE_PREPARATION_REQUIRED";
  if (call.sourceKind !== "synthetic" && !realAllowed)
    return "PRIVACY_APPROVAL_REQUIRED";
  if (
    preparation.kind !==
    (call.sourceKind === "synthetic" ? "synthetic" : "privately_redacted")
  )
    return "SOURCE_PREPARATION_REQUIRED";
  return null;
}
const sourceReasons = new Set([
  "Transcription completeness needs review.",
  "Transcription quality needs review.",
  "Speaker attribution needs review.",
  "Recording coverage needs review.",
]);
export function applySourceReview(
  call: CallRecord,
  input: z.infer<typeof sourceReviewSchema>,
  actor: { id: string; userId: string; at: string },
): CallRecord {
  if (call.version !== input.version) throw new Error("STALE_SOURCE_REVIEW");
  if (!call.segments.length) throw new Error("TRANSCRIPT_REQUIRED");
  const ids = new Set(call.segments.map((x) => x.id)),
    roles = new Map<string, (typeof input.roles)[number]["speaker"]>();
  if (ids.size !== call.segments.length)
    throw new Error("INVALID_SOURCE_ROLES");
  for (const role of input.roles) {
    if (roles.has(role.segmentId) || !ids.has(role.segmentId))
      throw new Error("INVALID_SOURCE_ROLES");
    roles.set(role.segmentId, role.speaker);
  }
  const next = structuredClone(call);
  if (!next.originalSegments) {
    next.originalSegments = structuredClone(call.segments);
    next.originalSegmentsProvenance =
      call.mode === "sample" ? "fictional_fixture" : "legacy_snapshot";
  }
  const changes = next.segments.flatMap((segment) => {
    const speaker = roles.get(segment.id);
    if (!speaker || speaker === segment.speaker) return [];
    const change = {
      segmentId: segment.id,
      previous: segment.speaker,
      next: speaker,
    };
    segment.speaker = speaker;
    return [change];
  });
  next.sourceRevision = (call.sourceRevision ?? 0) + 1;
  next.version++;
  next.transcriptCompleteness = input.completenessVerified
    ? "verified"
    : "unverified";
  const unresolved = (call.transcriptReviewReasons ?? []).filter(
    (reason) =>
      !sourceReasons.has(reason) ||
      ((reason === "Transcription completeness needs review." ||
        reason === "Recording coverage needs review.") &&
        !input.completenessVerified) ||
      (reason === "Transcription quality needs review." &&
        !input.qualityVerified) ||
      (reason === "Speaker attribution needs review." &&
        next.segments.some((x) => x.speaker === "unknown")),
  );
  if (!input.completenessVerified)
    unresolved.push("Transcription completeness needs review.");
  if (!input.qualityVerified)
    unresolved.push("Transcription quality needs review.");
  if (next.segments.some((x) => x.speaker === "unknown"))
    unresolved.push("Speaker attribution needs review.");
  next.transcriptReviewReasons = [...new Set(unresolved)];
  next.sourceReviews ??= [];
  next.sourceReviews.push({
    ...actor,
    sourceRevision: next.sourceRevision,
    previousVersion: call.version,
    sourceChecksum: call.checksum,
    reason: input.reason,
    changes,
    completenessVerified: input.completenessVerified,
    qualityVerified: input.qualityVerified,
  });
  if (next.analysis) {
    next.analysis.reviewReasons = [
      ...new Set([
        ...next.analysis.reviewReasons.filter(
          (reason) => !sourceReasons.has(reason),
        ),
        ...next.transcriptReviewReasons,
        STALE_SOURCE_REASON,
      ]),
    ];
    next.score = computeScore(next.analysis);
  }
  next.status = "needs_review";
  return next;
}
