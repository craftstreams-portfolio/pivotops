import { z } from "zod";

// ===============================
// ACTOR SCHEMA
// ===============================
export const ActorSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional().nullable(),
  name: z.string().optional(),
});

// ===============================
// CANDIDATE EVENT PAYLOAD
// ===============================
export const CandidateEventPayloadSchema = z.object({
  candidate_id: z.string().min(1),
  status: z.string().min(1),
  tenant_id: z.string().optional(),
  actor: ActorSchema.optional(),
  timestamp: z.string().optional(),
});

// ===============================
// FULL EVENT SCHEMA
// ===============================
export const CandidateEventSchema = z.object({
  type: z.literal("CANDIDATE_STATUS_CHANGED"),
  payload: CandidateEventPayloadSchema,
});

export type CandidateEvent = z.infer<typeof CandidateEventSchema>;