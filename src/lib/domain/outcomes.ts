import type { CallRecord, Evidence } from "./types";
import { analysisCurrent } from "./source-review";
const normalize = (value: string) =>
  value.replace(/\s+/g, " ").trim().toLowerCase();
function supported(evidence: Evidence, call: CallRecord) {
  if (!evidence.segmentIds.length || !evidence.quote.trim()) return false;
  const lookup = new Map(call.segments.map((x) => [x.id, x]));
  if (evidence.segmentIds.some((id) => !lookup.has(id))) return false;
  const text = evidence.segmentIds.map((id) => lookup.get(id)!.text).join(" ");
  return normalize(text).includes(normalize(evidence.quote));
}
export function outcomeLabel(call: CallRecord) {
  if (call.analysis && !analysisCurrent(call))
    return "Analysis needs to run again";
  const values = call.analysis?.outcomes;
  if (values?.treatmentAccepted.value === true) return "Treatment accepted";
  if (values?.inspectionBooked.value === true) return "Inspection booked";
  if (values?.cancellationRequested.value === true)
    return "Cancellation requested";
  if (
    call.analysis?.followups.some(
      (item) => item.state === "accepted" && supported(item.evidence, call),
    )
  )
    return "Follow-up agreed";
  if (call.analysis?.secondaryIntents.includes("re-service"))
    return "Re-service discussed";
  return call.analysis ? "No confirmed commitment" : "Awaiting analysis";
}
