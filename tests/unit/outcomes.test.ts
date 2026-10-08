import { expect, it } from "vitest";
import { sampleCall } from "@/lib/samples/fixtures";
import { outcomeLabel } from "@/lib/domain/outcomes";
function call() {
  const c = sampleCall("service", "fictional-call");
  c.analysis!.followups = [];
  return c;
}
it("re-service intent alone is discussed, not agreed", () =>
  expect(outcomeLabel(call())).toBe("Re-service discussed"));
it.each(["promised", "unknown", "reported_completed"] as const)(
  "%s follow-up is not an agreement",
  (state) => {
    const c = call();
    c.analysis!.followups = [
      {
        text: "Fictional visit",
        state,
        dueText: null,
        evidence: { segmentIds: [c.segments[0].id], quote: c.segments[0].text },
      },
    ];
    expect(outcomeLabel(c)).toBe("Re-service discussed");
  },
);
it.each([
  { segmentIds: [], quote: "" },
  { segmentIds: ["fabricated"], quote: "Yes" },
  { segmentIds: ["s1"], quote: "Fabricated agreement" },
])("accepted follow-up requires real cited text: $quote", (evidence) => {
  const c = call();
  c.analysis!.followups = [
    { text: "Fictional visit", state: "accepted", dueText: null, evidence },
  ];
  expect(outcomeLabel(c)).toBe("Re-service discussed");
});
it("supported accepted follow-up is agreed", () => {
  const c = call();
  const segment = c.segments.find((x) => x.speaker === "customer")!;
  c.analysis!.followups = [
    {
      text: "Fictional visit",
      state: "accepted",
      dueText: null,
      evidence: { segmentIds: [segment.id], quote: segment.text },
    },
  ];
  expect(outcomeLabel(c)).toBe("Follow-up agreed");
});
it.each([
  ["one-time", "Treatment accepted"],
  ["inspection", "Inspection booked"],
  ["retention", "Cancellation requested"],
])("preserves independent %s outcome", (key, label) =>
  expect(outcomeLabel(sampleCall(key, "fictional-call"))).toBe(label),
);
