import { sampleCall } from "@/lib/samples/fixtures";
export function recoveryCall() {
  const call = sampleCall("service", "fictional-call");
  Object.assign(call, {
    mode: "live",
    sourceKind: "synthetic",
    analysis: null,
    originalAnalysis: null,
    score: null,
    status: "failed",
    errorCode: "INVALID_EVIDENCE",
    sourceRevision: 0,
    checksum: "a".repeat(64),
    sanitizedPath: "sample-workspace/fictional-call.wav",
    sourcePreparation: {
      checksum: "a".repeat(64),
      attestedBy: "fictional-owner",
      at: "2026-10-09T00:00:00Z",
      kind: "synthetic",
    },
  });
  return call;
}
