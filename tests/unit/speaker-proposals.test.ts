import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { speakerSuggestions } from "@/lib/domain/speaker-proposals";
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
