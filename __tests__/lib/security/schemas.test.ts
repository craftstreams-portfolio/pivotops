import { describe, it, expect } from "vitest";
import { ApplySchema, CandidateActionSchema, IncidentSchema, OnboardingSchema, ComplianceRemindSchema, SpotlightApproveSchema } from "../../../lib/security/schemas";
const validUUID = "123e4567-e89b-12d3-a456-426614174000";
describe("ApplySchema", () => {
  const valid = { name: "Jane Smith", email: "jane@example.com", role: "Registered Nurse" };
  it("accepts minimal valid payload", () => { expect(ApplySchema.safeParse(valid).success).toBe(true); });
  it("rejects missing name", () => { expect(ApplySchema.safeParse({ ...valid, name: "" }).success).toBe(false); });
  it("rejects invalid email", () => { expect(ApplySchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false); });
  it("rejects missing role", () => { expect(ApplySchema.safeParse({ ...valid, role: "" }).success).toBe(false); });
  it("coerces years_experience", () => { const r = ApplySchema.safeParse({ ...valid, years_experience: "5" }); expect(r.success).toBe(true); if (r.success) expect(r.data.years_experience).toBe(5); });
  it("defaults tenant_id", () => { const r = ApplySchema.safeParse(valid); if (r.success) expect(r.data.tenant_id).toBe("default"); });
});
describe("CandidateActionSchema", () => {
  it("accepts valid action", () => { expect(CandidateActionSchema.safeParse({ candidateId: validUUID, action: "approve" }).success).toBe(true); });
  it("rejects unknown action", () => { expect(CandidateActionSchema.safeParse({ candidateId: validUUID, action: "delete_everything" }).success).toBe(false); });
  it("rejects invalid UUID", () => { expect(CandidateActionSchema.safeParse({ candidateId: "bad", action: "approve" }).success).toBe(false); });
});
describe("IncidentSchema", () => {
  it("accepts valid create", () => { expect(IncidentSchema.safeParse({ action: "create", title: "Server down", severity: "critical" }).success).toBe(true); });
  it("rejects empty title", () => { expect(IncidentSchema.safeParse({ action: "create", title: "" }).success).toBe(false); });
  it("rejects unknown action", () => { expect(IncidentSchema.safeParse({ action: "nuke" }).success).toBe(false); });
  it("defaults severity to medium", () => { const r = IncidentSchema.safeParse({ action: "create", title: "Test" }); if (r.success && r.data.action === "create") expect(r.data.severity).toBe("medium"); });
});
describe("OnboardingSchema", () => {
  it("accepts valid UUID", () => { expect(OnboardingSchema.safeParse({ candidateId: validUUID }).success).toBe(true); });
  it("rejects invalid UUID", () => { expect(OnboardingSchema.safeParse({ candidateId: "bad-id" }).success).toBe(false); });
});
describe("ComplianceRemindSchema", () => {
  it("accepts valid payload", () => { expect(ComplianceRemindSchema.safeParse({ candidateId: validUUID, docTypes: ["nursing_license"] }).success).toBe(true); });
  it("rejects empty docTypes", () => { expect(ComplianceRemindSchema.safeParse({ candidateId: validUUID, docTypes: [] }).success).toBe(false); });
});
describe("SpotlightApproveSchema", () => {
  it("accepts approved=true", () => { expect(SpotlightApproveSchema.safeParse({ spotlightId: validUUID, approved: true }).success).toBe(true); });
  it("rejects missing approved", () => { expect(SpotlightApproveSchema.safeParse({ spotlightId: validUUID }).success).toBe(false); });
});