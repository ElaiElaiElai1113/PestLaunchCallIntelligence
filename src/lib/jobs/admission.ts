export function processingDecision(
  keyPresent: boolean,
  ...legacyPrivacyArguments: boolean[]
): "awaiting_ai" | "run" {
  void legacyPrivacyArguments;
  if (!keyPresent) return "awaiting_ai";
  return "run";
}
