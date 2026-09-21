import { z } from "zod";

// ===============================
// RECRUITMENT METRICS SCHEMA
// ===============================
export const RecruitmentMetricSchema = z.object({
  candidate_id: z.string().optional(),
  status: z.string(),
  timestamp: z.string().optional(),
});

// ===============================
// TASK METRICS SCHEMA
// ===============================
export const TaskMetricSchema = z.object({
  task_id: z.string().optional(),
  status: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  timestamp: z.string().optional(),
});

// ===============================
// CLOCKING METRICS SCHEMA
// ===============================
export const ClockingMetricSchema = z.object({
  user_id: z.string(),
  duration_minutes: z.number().optional(),
  timestamp: z.string().optional(),
});

// ===============================
// GENERIC SAFE PARSER
// ===============================
export function safeParseArray(schema: any, data: any[]) {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const result = schema.safeParse(item);
      return result.success ? result.data : null;
    })
    .filter(Boolean);
}