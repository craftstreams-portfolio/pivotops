import { runAIInterview } from "../ai";

/**
 * AI EVENT INTELLIGENCE LAYER
 */
export async function runEventIntelligence(event: any, result: any) {
  try {
    if (!event?.type) return null;

    // ===============================
    // CANDIDATE INTELLIGENCE
    // ===============================
    if (event.type === "CANDIDATE_STATUS_CHANGED") {
      const status = event?.payload?.status;

      if (status === "recruitment_review") {
        return { trigger: "ai_review", result };
      }

      if (status === "interview") {
        return { trigger: "interview_readiness", result };
      }
    }

    return null;
  } catch (err) {
    console.error("❌ AI intelligence failed:", err);
    return null;
  }
}