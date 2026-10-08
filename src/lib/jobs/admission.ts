export function processingDecision(
  keyPresent: boolean,
  realApproved: boolean,
  synthetic: boolean,
): "awaiting_ai" | "privacy_hold" | "run" {
  if (!keyPresent) return "awaiting_ai";
  if (!synthetic && !realApproved) return "privacy_hold";
  return "run";
}
