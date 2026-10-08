import { z } from "zod";
export const evidenceSchema = z.strictObject({
  segmentIds: z.array(z.string()).max(2000),
  quote: z.string().max(2000),
});
const outcome = z.strictObject({
  value: z.boolean().nullable(),
  evidence: evidenceSchema,
});
export const analysisSchema = z.strictObject({
  purpose: z.enum(["sales", "general", "retention", "unknown"]),
  secondaryIntents: z.array(z.string().max(80)).max(12),
  title: z.string().max(120),
  summary: z.string().max(1800),
  outcomes: z.strictObject({
    quoteProvided: outcome,
    inspectionBooked: outcome,
    treatmentAccepted: outcome,
    agreementSigned: outcome,
    paymentCollected: outcome,
    cancellationRequested: outcome,
    cancellationAccepted: outcome,
    retentionSaved: outcome,
  }),
  facts: z
    .array(
      z.strictObject({
        label: z.string().max(80),
        text: z.string().max(800),
        evidence: evidenceSchema,
      }),
    )
    .max(12),
  followups: z
    .array(
      z.strictObject({
        text: z.string().max(800),
        state: z.enum([
          "promised",
          "accepted",
          "reported_completed",
          "unknown",
        ]),
        dueText: z.string().max(200).nullable(),
        evidence: evidenceSchema,
      }),
    )
    .max(12),
  assessments: z
    .array(
      z.strictObject({
        id: z.string().max(80),
        status: z.enum(["passed", "missed", "unknown", "not_applicable"]),
        reason: z.string().max(800),
        evidence: evidenceSchema,
      }),
    )
    .max(17),
  coaching: z
    .array(
      z.strictObject({
        kind: z.enum(["strength", "improvement"]),
        title: z.string().max(120),
        detail: z.string().max(800),
        suggestedResponse: z.string().max(800).nullable(),
        checkpointId: z.string().max(80),
        evidence: evidenceSchema,
      }),
    )
    .max(3),
  complete: z.boolean(),
  noObjections: z.boolean(),
  reviewReasons: z.array(z.string().max(400)).max(12),
});
export const reviewSchema = z.strictObject({
  version: z.number().int().positive(),
  checkpointId: z.string().max(80),
  status: z.enum(["passed", "missed", "unknown", "not_applicable"]),
  reason: z.string().trim().min(10).max(800),
});
export const uploadSchema = z.strictObject({
  label: z.string().trim().min(1).max(160),
  bytes: z.number().int().positive().max(25_000_000),
  durationMs: z.number().positive().max(3_600_000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  extension: z.enum(["mp3", "wav", "m4a"]),
  recordedAt: z.iso.datetime().nullable(),
  rep: z.string().max(100).nullable(),
  direction: z.enum(["inbound", "outbound"]).nullable(),
  sanitized: z.literal(true),
  sourceKind: z.enum(["synthetic", "real"]),
});
