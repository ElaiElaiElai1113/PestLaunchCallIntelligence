import type { Segment } from "../domain/types";
import { resolveRefs } from "./analysis-contract";
export const DETAIL_LABELS = {
  pest_report: "Pest report",
  service_preference: "Service preference",
  price_quote: "Price quote",
  appointment: "Appointment",
  payment_terms: "Payment terms",
  cancellation: "Cancellation discussion",
  account: "Account discussion",
  service: "Service discussion",
  other: "Other source detail",
} as const;
export type SourceExtraction = {
  recap: { segmentIds: string[] };
  facts: {
    kind: keyof typeof DETAIL_LABELS;
    evidence: { segmentIds: string[] };
  }[];
};
export function materializeRecap(value: SourceExtraction, source: Segment[]) {
  resolveRefs(value.recap, source, 1800, "SOURCE_EXCERPT_LIMIT");
  const selected = value.recap.segmentIds.map((id) =>
    structuredClone(source.find((s) => s.id === id)!),
  );
  const summary = selected
    .map(
      (s) =>
        `${s.speaker === "employee" ? "Employee" : s.speaker === "customer" ? "Customer" : "Unknown speaker"} · ${Math.floor(s.startMs / 60000)}:${String(Math.floor(s.startMs / 1000) % 60).padStart(2, "0")} — ${s.text}`,
    )
    .join("\n");
  if (summary.length > 1800) throw new Error("SOURCE_EXCERPT_LIMIT");
  const facts = value.facts.map((item) => {
    const evidence = resolveRefs(
      item.evidence,
      source,
      800,
      "SOURCE_EXCERPT_LIMIT",
    );
    if (evidence.quote.length > 800) throw new Error("SOURCE_EXCERPT_LIMIT");
    return { label: DETAIL_LABELS[item.kind], text: evidence.quote, evidence };
  });
  return {
    summary,
    facts,
    sourceRecap: { version: "source_refs_v3" as const, segments: selected },
  };
}
