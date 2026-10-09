import type { Analysis, CallRecord, Evidence, Segment } from "./types";

export function assessmentContext(call: CallRecord) {
  return {
    transcriptComplete:
      (call.transcriptCompleteness ??
        (call.mode === "sample" ? "verified" : "unverified")) === "verified" &&
      !(call.transcriptReviewReasons ?? []).some(
        (reason) =>
          reason === "Transcription quality needs review." ||
          reason === "Recording coverage needs review.",
      ),
  };
}

export function reviewedAssessmentContext(call: CallRecord) {
  const checkpoint = call.analysis?.assessments.find(
    (x) => x.id === "expectation_solve",
  );
  const latest = [...call.decisions]
    .reverse()
    .find(
      (d) =>
        d.checkpointId === "expectation_solve" &&
        d.sourceRevision === (call.sourceRevision ?? 0) &&
        d.analysisGeneration === (call.analysisGeneration ?? 0),
    );
  return {
    ...assessmentContext(call),
    roadmapOrderReviewed: !!(
      checkpoint &&
      latest?.chronologyVerified &&
      latest.status === "passed" &&
      latest.evidence &&
      JSON.stringify(latest.evidence.segmentIds) ===
        JSON.stringify(checkpoint.evidence.segmentIds) &&
      latest.evidence.quote === checkpoint.evidence.quote
    ),
  };
}

export function guardAssessment(
  original: Analysis,
  segments: Segment[],
  context: { transcriptComplete: boolean; roadmapOrderReviewed?: boolean },
): Analysis {
  const effective = structuredClone(original);
  const lookup = new Map(segments.map((x) => [x.id, x]));
  const normalize = (value: string) =>
    value.replace(/\s+/g, " ").trim().toLowerCase();
  const employeeEvidence = (evidence: Evidence) => {
    if (
      !evidence.segmentIds.length ||
      !evidence.quote.trim() ||
      evidence.segmentIds.some((id) => !lookup.has(id))
    )
      return false;
    const employeeText = evidence.segmentIds
      .map((id) => lookup.get(id)!)
      .filter((segment) => segment.speaker === "employee")
      .map((segment) => segment.text)
      .join(" ");
    return normalize(employeeText).includes(normalize(evidence.quote));
  };
  const employeeSource = (evidence: Evidence) =>
    evidence.segmentIds
      .map((id) => lookup.get(id))
      .filter((segment) => segment?.speaker === "employee")
      .map((segment) => segment!.text)
      .join(" ");
  let attributionUnresolved = false;
  let coachingPolicyUnresolved = false;
  const issue = (
    id: string,
    kind: "outcome" | "coaching" | "chronology" | "followup",
    target: string,
    message: string,
  ) => {
    effective.reviewIssues ??= [];
    if (!effective.reviewIssues.some((x) => x.id === id))
      effective.reviewIssues.push({ id, kind, target, message });
  };
  effective.followups.forEach((action, index) => {
    // Payment terms establish an obligation, not the customer's commitment.
    // Conservative trigger only: other promises (visits, refunds) stay distinct.
    const paymentDue =
      /\b(?:payment\b.{0,30}\bdue|due\b.{0,30}\bpayment)\b/i.test(
        `${action.text} ${action.evidence.quote}`,
      );
    const customerPromise = action.evidence.segmentIds.some((id) => {
      const source = lookup.get(id);
      return (
        source?.speaker === "customer" &&
        /\b(?:i (?:will|agree to)|i['’]ll|we will|we['’]ll)\s+pay\b/i.test(
          source.text,
        )
      );
    });
    if (
      paymentDue &&
      ["promised", "accepted"].includes(action.state) &&
      !customerPromise
    ) {
      action.state = "unknown";
      const message = "Payment commitment needs review.";
      effective.reviewReasons.push(message);
      issue(`followup:${index}`, "followup", String(index), message);
    }
  });
  const cancellation = effective.outcomes.cancellationAccepted;
  const cancellationSource = cancellation
    ? employeeSource(cancellation.evidence)
    : "";
  // Submitting a request for later confirmation is not accepting cancellation.
  // This targets that specific ambiguity; it does not certify account closure.
  if (
    cancellation?.value === true &&
    /\b(?:submit|send|forward|refer)\b.{0,60}\bcancellation request\b/i.test(
      cancellationSource,
    ) &&
    !/\b(?:cancellation(?: request)? (?:is|has been) (?:accepted|approved)|(?:i|we) (?:have )?accepted (?:your|the) cancellation)\b/i.test(
      cancellationSource,
    )
  ) {
    cancellation.value = null;
    const message =
      "Cancellation acceptance needs confirmation beyond request submission.";
    effective.reviewReasons.push(message);
    issue(
      "outcome:cancellationAccepted",
      "outcome",
      "cancellationAccepted",
      message,
    );
  }
  const treatment = effective.outcomes.treatmentAccepted;
  const treatmentSource = (treatment?.evidence.segmentIds ?? [])
    .map((id) => lookup.get(id)?.text ?? "")
    .join(" ");
  const explicitCustomerAcceptance = (
    treatment?.evidence.segmentIds ?? []
  ).some((id) => {
    const segment = lookup.get(id);
    return (
      segment?.speaker === "customer" &&
      /\b(?:i|we)\s+(?:accept|agree to|authorize|want)\b.{0,50}\btreat(?:ment)?\b/i.test(
        segment.text,
      )
    );
  });
  if (
    treatment?.value === true &&
    /\bif\b.{0,100}\b(?:can|could|may)\b.{0,70}\btreat(?:ment)?\b/i.test(
      treatmentSource,
    ) &&
    !explicitCustomerAcceptance
  ) {
    treatment.value = null;
    const message =
      "Conditional treatment availability does not establish treatment acceptance.";
    effective.reviewReasons.push(message);
    issue("outcome:treatmentAccepted", "outcome", "treatmentAccepted", message);
  }
  const inspection = effective.outcomes.inspectionBooked;
  if (
    inspection?.value === true &&
    inspection.evidence.segmentIds.length > 0 &&
    !inspection.evidence.segmentIds.some((id) =>
      /\binspect(?:ion|ions|ing)?\b/i.test(lookup.get(id)?.text ?? ""),
    )
  ) {
    inspection.value = null;
    const message = "Inspection booking needs explicit source evidence.";
    effective.reviewReasons.push(message);
    issue("outcome:inspectionBooked", "outcome", "inspectionBooked", message);
  }
  for (const [key, outcome] of Object.entries(effective.outcomes)) {
    if (outcome.value === null) continue;
    const { segmentIds, quote } = outcome.evidence;
    const supported =
      segmentIds.length > 0 &&
      quote.trim().length > 0 &&
      segmentIds.every((id) => lookup.has(id)) &&
      normalize(
        segmentIds.map((id) => lookup.get(id)!.text).join(" "),
      ).includes(normalize(quote));
    if (!supported) {
      outcome.value = null;
      effective.reviewReasons.push("Outcome evidence needs review.");
      issue("outcome:" + key, "outcome", key, "Outcome evidence needs review.");
    }
  }
  for (const item of effective.assessments) {
    if (
      effective.purpose === "retention" &&
      item.id === "research" &&
      item.status === "passed"
    ) {
      const source = employeeSource(item.evidence);
      const accountContext =
        /\b(?:account|service history|notes|records)\b/i.test(source);
      const audibleReview =
        /\b(?:i (?:have )?(?:checked|reviewed|read)|i(?:['’]m| am) (?:checking|reviewing|looking)|i (?:can )?see|(?:your|the) (?:account|service history|notes|records) (?:shows?|says?|indicates?))\b/i.test(
          source,
        );
      if (!accountContext || !audibleReview) {
        item.status = "unknown";
        item.reason =
          "Account research needs audible source evidence; questions and promises do not verify it.";
        effective.reviewReasons.push("Account research needs review.");
      }
    }
    const unsupportedPass =
      item.status === "passed" && !employeeEvidence(item.evidence);
    const unsupportedMiss =
      item.status === "missed" &&
      (!context.transcriptComplete ||
        segments.some((x) => x.speaker === "unknown") ||
        !segments.some((x) => x.speaker === "employee"));
    if (unsupportedPass || unsupportedMiss) {
      item.status = "unknown";
      item.reason = "Employee attribution or complete evidence needs review.";
      attributionUnresolved = true;
    }
  }
  effective.complete = original.complete && context.transcriptComplete;
  if (effective.purpose === "sales" || effective.purpose === "general") {
    const roadmap = effective.assessments.find(
      (x) => x.id === "expectation_solve",
    );
    if (roadmap?.status === "passed" && !context.roadmapOrderReviewed) {
      const positions = (ids: string[]) =>
        ids
          .map((id) => segments.findIndex((s) => s.id === id))
          .filter((i) => i >= 0);
      const anchors = effective.assessments
        .filter(
          (x) =>
            ["solution", "pricing"].includes(x.id) && x.status === "passed",
        )
        .flatMap((x) => positions(x.evidence.segmentIds));
      const selected = positions(roadmap.evidence.segmentIds);
      if (
        !anchors.length ||
        !selected.length ||
        Math.max(...selected) >= Math.min(...anchors)
      ) {
        roadmap.status = "unknown";
        roadmap.reason = "Pre-solution roadmap order needs review.";
        effective.reviewReasons.push("Roadmap chronology needs review.");
        issue(
          "chronology:expectation_solve",
          "chronology",
          "expectation_solve",
          "Roadmap chronology needs review.",
        );
      }
    }
  }
  const attributableComplete =
    effective.complete &&
    segments.length > 0 &&
    segments.every((x) => x.speaker !== "unknown") &&
    segments.some((x) => x.speaker === "employee") &&
    segments.some((x) => x.speaker === "customer");
  effective.noObjections = original.noObjections && attributableComplete;
  effective.coaching = effective.coaching.filter((item) => {
    const supported = employeeEvidence(item.evidence);
    if (!supported) attributionUnresolved = true;
    // Conservative review trigger, not a general semantic validator: do not
    // publish a guarantee/discount/refund claim the cited employee never made.
    const text = normalize(`${item.detail} ${item.suggestedResponse ?? ""}`);
    const policies =
      text.match(
        /\b(?:guarantee(?:d|s)?|discount(?:s|ed)?|refund(?:s|ed)?|warranty|warranties|free|waiver|waived)\b/g,
      ) ?? [];
    const source = normalize(item.evidence.quote);
    const numbers = policies.length ? (text.match(/\d+(?:\.\d+)?/g) ?? []) : [];
    const policySupported =
      policies.every((word) => source.includes(word)) &&
      numbers.every((number) =>
        new RegExp(`\\b${number.replace(".", "\\.")}\\b`).test(source),
      );
    const assurances =
      text.match(
        /\b(?:no (?:extra|additional|hidden) (?:charges?|fees?|costs?|taxes?)|all[- ]inclusive|(?:that(?:['’]s| is)(?: the)?|this is(?: the)?|the) total|(?:fees?|taxes?) (?:are )?included)\b/g,
      ) ?? [];
    const assuranceSupported = assurances.every((phrase) =>
      source.includes(phrase),
    );
    if (!policySupported || !assuranceSupported)
      coachingPolicyUnresolved = true;
    if (!policySupported || !assuranceSupported)
      issue(
        "coaching:" + item.checkpointId,
        "coaching",
        item.checkpointId,
        "Coaching policy details need review.",
      );
    return supported && policySupported && assuranceSupported;
  });
  if (!effective.complete)
    effective.reviewReasons.push("Transcription completeness needs review.");
  if (attributionUnresolved)
    effective.reviewReasons.push("Speaker attribution needs review.");
  if (coachingPolicyUnresolved)
    effective.reviewReasons.push("Coaching policy details need review.");
  if (original.noObjections && !effective.noObjections)
    effective.reviewReasons.push(
      "No-objection policy needs complete attributable evidence.",
    );
  effective.reviewReasons = [...new Set(effective.reviewReasons)];
  return effective;
}
