import type { CallRecord, OutcomeKey } from "./types";
import { analysisCurrent } from "./source-review";
export function matchesCallFilters(
  call: CallRecord,
  params: URLSearchParams,
  review = false,
) {
  const purpose = params.get("purpose"),
    status = params.get("status"),
    grade = params.get("grade"),
    outcome = params.get("outcome"),
    query = params.get("q");
  return (
    (!review || ["needs_review", "privacy_review"].includes(call.status)) &&
    (!purpose || call.analysis?.purpose === purpose) &&
    (!status || call.status === status) &&
    (!grade || (analysisCurrent(call) && call.score?.grade === grade)) &&
    (!outcome ||
      (analysisCurrent(call) &&
        call.analysis?.outcomes[outcome as OutcomeKey]?.value === true)) &&
    (!query ||
      `${call.label} ${call.analysis?.title} ${call.analysis?.summary} ${call.rep ?? ""} ${call.segments.map((x) => x.text).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()))
  );
}
