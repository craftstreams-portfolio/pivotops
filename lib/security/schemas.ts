import { z } from "zod";
const email = z.string().email("Invalid email address").max(255);
const uuid  = z.string().uuid("Invalid ID format");
const nonEmptyString = (label: string) => z.string({ message: `${label} is required` }).trim().min(1, `${label} is required`).max(500);
export const ApplySchema = z.object({
  name: nonEmptyString("Full name"), email, role: nonEmptyString("Role"),
  phone: z.string().max(30).optional().default(""),
  linkedin_url: z.string().optional().default(""),
  years_experience: z.coerce.number().min(0).max(60).optional().default(0),
  current_employer: z.string().max(200).optional().default(""),
  cover_letter: z.string().max(5000).optional().default(""),
  resume_url: z.string().url().nullable().optional(),
  resume_name: z.string().max(255).nullable().optional(),
  tenant_id: z.string().max(100).optional().default("default"),
});
export const CandidateActionSchema = z.object({
  candidateId: uuid,
  action: z.enum(["approve","reject","interview","offer","hire","withdraw"]),
  tenantId: z.string().max(100).optional().default("default"),
  note: z.string().max(1000).optional(),
  updatedBy: z.string().max(255).optional(),
});
export const OfferSchema = z.object({
  candidateId: uuid,
  salary: z.coerce.number().min(0).max(10_000_000).optional(),
  startDate: z.string().optional(),
  message: z.string().max(2000).optional(),
  tenantId: z.string().max(100).optional().default("default"),
});
const IncidentSeverity = z.enum(["critical","high","medium","low"]);
export const IncidentCreateSchema = z.object({ action: z.literal("create"), tenantId: z.string().max(100).optional().default("default"), title: nonEmptyString("Title"), description: z.string().max(5000).optional(), severity: IncidentSeverity.optional().default("medium"), category: z.string().max(100).optional(), affectedArea: z.string().max(200).optional(), reporterId: z.string().max(255).optional(), reporterName: z.string().max(255).optional() });
export const IncidentAcknowledgeSchema = z.object({ action: z.literal("acknowledge"), tenantId: z.string().max(100).optional().default("default"), incidentId: uuid, userId: z.string().min(1), userName: z.string().max(255).optional() });
export const IncidentEscalateSchema = z.object({ action: z.literal("escalate"), tenantId: z.string().max(100).optional().default("default"), incidentId: uuid, severity: IncidentSeverity.optional().default("high"), department: z.string().max(100).optional().default("operations"), escalatedBy: z.string().max(255).optional() });
export const IncidentTransitionSchema = z.object({ action: z.literal("transition"), tenantId: z.string().max(100).optional().default("default"), incidentId: uuid, nextState: z.enum(["OPEN","ACKNOWLEDGED","IN_PROGRESS","ESCALATED","RESOLVED","CLOSED"]), updatedBy: z.string().max(255).optional() });
export const IncidentAssignSchema = z.object({ action: z.literal("assign"), tenantId: z.string().max(100).optional().default("default"), incidentId: uuid, responderId: z.string().min(1), responderName: z.string().max(255).optional(), department: z.string().max(100).optional() });
export const IncidentSchema = z.discriminatedUnion("action", [IncidentCreateSchema, IncidentAcknowledgeSchema, IncidentEscalateSchema, IncidentTransitionSchema, IncidentAssignSchema]);
export const OnboardingSchema = z.object({ candidateId: uuid, tenantId: z.string().max(100).optional().default("default"), startDate: z.string().optional(), managerId: z.string().max(255).optional(), notes: z.string().max(2000).optional() });
export const ComplianceRemindSchema = z.object({ candidateId: uuid, tenantId: z.string().max(100).optional().default("default"), docTypes: z.array(z.string().max(100)).min(1).max(20).optional(), message: z.string().max(1000).optional() });
export const SpotlightApproveSchema = z.object({ spotlightId: uuid, tenantId: z.string().max(100).optional().default("default"), approved: z.boolean(), note: z.string().max(500).optional() });
export type ApplyInput = z.infer<typeof ApplySchema>;
export type CandidateActionInput = z.infer<typeof CandidateActionSchema>;
export type IncidentInput = z.infer<typeof IncidentSchema>;
export type OnboardingInput = z.infer<typeof OnboardingSchema>;
export type ComplianceRemindInput = z.infer<typeof ComplianceRemindSchema>;
export type SpotlightApproveInput = z.infer<typeof SpotlightApproveSchema>;