import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import {
  buildScoringRequest,
  buildAnalysisRequest,
} from "@/lib/groq/analysis-request";

it("keeps the complete ordered dialogue while hiding context-only selectable IDs", () => {
  const call = sampleCall("one-time", "fictional-context");
  const snapshot = structuredClone(call.segments);
  const request = buildScoringRequest(
    call.segments,
    { transcriptComplete: true },
    "sales",
  ).request;
  const segments = JSON.parse(String(request.messages[1].content)).segments;
  expect(segments.map((s: { text: string }) => s.text)).toEqual(
    snapshot.map((s) => s.text),
  );
  expect(
    segments.map((s: { speaker: string; startMs: number; endMs: number }) => ({
      speaker: s.speaker,
      startMs: s.startMs,
      endMs: s.endMs,
    })),
  ).toEqual(
    snapshot.map(({ speaker, startMs, endMs }) => ({
      speaker,
      startMs,
      endMs,
    })),
  );
  segments.forEach((s: { id?: string; contextOnly?: boolean }, i: number) => {
    if (snapshot[i].speaker === "employee") expect(s.id).toBe(snapshot[i].id);
    else {
      expect(s.id).toBeUndefined();
      expect(s.contextOnly).toBe(true);
    }
  });
  expect(call.segments).toEqual(snapshot);
  expect(
    JSON.parse(
      String(
        buildAnalysisRequest(call.segments, { transcriptComplete: true })
          .request.messages[1].content,
      ),
    ).segments,
  ).toEqual(snapshot);
});
it("preserves unknown-only uncertainty and hides unknown IDs when attribution is partial", () => {
  const call = sampleCall("one-time", "fictional-unknown-context");
  const unknown = call.segments.map((s) => ({
    ...s,
    speaker: "unknown" as const,
  }));
  expect(
    JSON.parse(
      String(
        buildScoringRequest(unknown, { transcriptComplete: false }, "sales")
          .request.messages[1].content,
      ),
    ).segments,
  ).toEqual(unknown);
  const partial = unknown.map((s, i) =>
    i === 0 ? { ...s, speaker: "employee" as const } : s,
  );
  const shown = JSON.parse(
    String(
      buildScoringRequest(partial, { transcriptComplete: false }, "sales")
        .request.messages[1].content,
    ),
  ).segments;
  expect(shown[0].id).toBe(partial[0].id);
  expect(
    shown
      .slice(1)
      .every(
        (s: { id?: string; contextOnly: boolean }) =>
          s.id === undefined && s.contextOnly,
      ),
  ).toBe(true);
});
