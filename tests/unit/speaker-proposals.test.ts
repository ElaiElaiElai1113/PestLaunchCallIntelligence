import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import {
  speakerSuggestions,
  applySpeakerSuggestions,
} from "@/lib/domain/speaker-proposals";
it("keeps suggestions source-bound, conservative and separate from actual source roles", () => {
  const call = sampleCall("service", "speaker-draft"),
    before = structuredClone(call);
  call.speakerProposals = {
    sourceChecksum: call.checksum!,
    sourceRevision: call.sourceRevision ?? 0,
    model: "gemini-3.5-flash-lite",
    roles: call.segments.map((s, i) => ({
      segmentId: s.id,
      speaker: "employee",
      confidence: i === 0 ? 0.4 : 0.99,
    })),
  };
  const suggestions = speakerSuggestions(call);
  expect(suggestions?.[call.segments[0].id]).toBe("unknown");
  expect(call.segments).toEqual(before.segments);
  expect(call.score).toEqual(before.score);
  expect(call.transcriptCompleteness).toBe(before.transcriptCompleteness);
  call.sourceRevision = (call.sourceRevision ?? 0) + 1;
  expect(speakerSuggestions(call)).toBeNull();
});
it("assigns AI defaults without inventing source verification and preserves reviewer corrections", () => {
  const call = sampleCall("service", "ai-defaults");
  call.segments.forEach((s) => (s.speaker = "unknown"));
  const before = structuredClone(call);
  call.speakerProposals = {
    sourceChecksum: call.checksum!,
    sourceRevision: call.sourceRevision ?? 0,
    model: "gemini-3.5-flash-lite",
    roles: call.segments.map((s, i) => ({
      segmentId: s.id,
      speaker: i === 0 ? "customer" : "employee",
      confidence: 0.99,
    })),
  };
  const next = applySpeakerSuggestions(call);
  expect(next.segments[0].speaker).toBe("customer");
  expect(next.segments[1].speaker).toBe("employee");
  expect(next.originalSegments).toEqual(
    before.originalSegments ?? before.segments,
  );
  expect(next.transcriptCompleteness).toBe(before.transcriptCompleteness);
  expect(next.sourceReviews).toEqual(before.sourceReviews);
  expect(next.sourceRevision).toBe((before.sourceRevision ?? 0) + 1);
  expect(next.speakerAttribution?.kind).toBe("ai");
  expect(applySpeakerSuggestions(next)).toEqual(next);
  const reviewed = structuredClone(call);
  reviewed.segments[0].speaker = "employee";
  expect(applySpeakerSuggestions(reviewed)).toEqual(reviewed);
  call.speakerProposals.sourceChecksum = "stale";
  expect(applySpeakerSuggestions(call)).toEqual(call);
});
