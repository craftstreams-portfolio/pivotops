import { supabase } from "../supabase";
import { runAIInterview } from "../ai";

// ===============================
// VALID RECRUITMENT STAGES
// ===============================
const VALID_STAGES = [
  "new",
  "screening",
  "assessment",
  "interview",
  "recruitment_review",
  "rejected",
];

// ===============================
// MAIN ENTRY POINT
// ===============================
export async function handleRecruitmentEvent(event: any) {
  try {
    const { type, payload } = event || {};

    if (!type || !payload) {
      console.warn("⚠️ Invalid recruitment event:", event);
      return null;
    }

    switch (type) {

      // ===============================
      // CANDIDATE CREATED
      // ===============================
      case "CANDIDATE_CREATED":
        return await handleCandidateCreated(payload);

      // ===============================
      // STAGE CHANGE
      // ===============================
      case "CANDIDATE_STATUS_CHANGED":
      case "CANDIDATE_MOVED_STAGE":
        return await handleStageChange(payload);

      // ===============================
      // AI EVALUATION
      // ===============================
      case "CANDIDATE_AI_EVALUATION":
        return await handleAIEvaluation(payload);

      // ===============================
      // UNKNOWN EVENT
      // ===============================
      default:
        console.warn("⚠️ Unhandled recruitment event:", type);
        return null;
    }

  } catch (err) {
    console.error("🔥 Recruitment handler crashed:", err);
    return null;
  }
}

// ===============================
// CANDIDATE CREATED
// ===============================
async function handleCandidateCreated(payload: any) {
  try {
    const candidateId =
      payload?.id ??
      payload?.candidate_id;

    if (!candidateId) {
      console.warn("⚠️ Missing candidate ID");
      return null;
    }

    const { data, error } = await supabase
      .from("candidates")
      .update({
        status: "new",
        created_at: new Date().toISOString(),
      })
      .eq("id", candidateId)
      .select()
      .single();

    if (error) {
      console.error("❌ Candidate creation sync failed:", error);
      return null;
    }

    console.log("✅ Candidate initialized:", candidateId);

    return data;

  } catch (err) {
    console.error("🔥 handleCandidateCreated failed:", err);
    return null;
  }
}

// ===============================
// STAGE CHANGE HANDLER
// ===============================
async function handleStageChange(payload: any) {
  try {
    const candidateId =
      payload?.id ??
      payload?.candidate_id;

    const newStatus =
      payload?.new_status ??
      payload?.status;

    if (!candidateId || !newStatus) {
      console.warn("⚠️ Invalid stage payload:", payload);
      return null;
    }

    // ===============================
    // VALIDATE STATUS
    // ===============================
    if (!VALID_STAGES.includes(newStatus)) {
      console.warn("⚠️ Invalid stage:", newStatus);
      return null;
    }

    // ===============================
    // FETCH LATEST CANDIDATE
    // ===============================
    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (error || !candidate) {
      console.error("❌ Candidate lookup failed:", error);
      return null;
    }

    // ===============================
    // UPDATE STAGE
    // ===============================
    const { data: updatedCandidate, error: updateError } =
      await supabase
        .from("candidates")
        .update({
          status: newStatus,
          last_stage_change: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidateId)
        .select()
        .single();

    if (updateError) {
      console.error("❌ Stage update failed:", updateError);
      return null;
    }

    console.log("✅ Candidate stage updated:", {
      candidateId,
      newStatus,
    });

    // ===============================
    // INTERVIEW SCHEDULING
    // ===============================
    if (
      newStatus === "interview" &&
      !candidate?.interview_scheduled
    ) {
      try {
        const interviewDate = new Date(
          Date.now() + 24 * 60 * 60 * 1000
        );

        const meetingLink =
          `https://meet.pivotops.app/${candidateId}`;

        const webhook =
          process.env.NEXT_PUBLIC_CALENDAR_WEBHOOK ||
          process.env.CALENDAR_WEBHOOK;

        // optional webhook trigger
        if (webhook) {
          await fetch(webhook, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              candidate_id: candidateId,
              name: candidate?.full_name,
              email: candidate?.email,
              date: interviewDate.toISOString(),
            }),
          }).catch((err) => {
            console.error("Webhook failed:", err);
          });
        }

        // save interview details
        await supabase
          .from("candidates")
          .update({
            interview_scheduled: true,
            interview_date: interviewDate.toISOString(),
            interview_link: meetingLink,
          })
          .eq("id", candidateId);

        // activity message
        await supabase
          .from("messages")
          .insert({
            candidate_id: candidateId,
            content:
              `📅 Interview scheduled for ` +
              `${interviewDate.toDateString()} | ` +
              `${meetingLink}`,
            user_name: "System",
            type: "system",
          });

        console.log("✅ Interview scheduled");

      } catch (err) {
        console.error(
          "❌ Interview scheduling failed:",
          err
        );
      }
    }

    // ===============================
    // BOTTLENECK DETECTION
    // ===============================
    if (candidate?.last_stage_change) {
      const days =
        (Date.now() -
          new Date(
            candidate.last_stage_change
          ).getTime()) /
        (1000 * 60 * 60 * 24);

      if (days > 5) {
        await supabase
          .from("messages")
          .insert({
            candidate_id: candidateId,
            content:
              "⚠️ Candidate stuck in stage — escalation triggered",
            user_name: "System",
            type: "system",
          });

        console.warn("⚠️ Bottleneck detected");
      }
    }

    // ===============================
    // AI AUTO TRIGGER
    // ===============================
    if (newStatus === "recruitment_review") {
      await handleAIEvaluation({
        id: candidateId,
        candidate: updatedCandidate,
      });
    }

    return updatedCandidate;

  } catch (err) {
    console.error("🔥 handleStageChange failed:", err);
    return null;
  }
}

// ===============================
// AI EVALUATION
// ===============================
async function handleAIEvaluation(payload: any) {
  try {
    const candidateId =
      payload?.id ??
      payload?.candidate_id;

    let candidate = payload?.candidate;

    if (!candidateId) {
      console.warn("⚠️ Missing AI candidate ID");
      return null;
    }

    // fetch candidate if missing
    if (!candidate) {
      const { data } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", candidateId)
        .single();

      candidate = data;
    }

    if (!candidate) {
      console.warn("⚠️ Candidate not found for AI");
      return null;
    }

    // ===============================
    // RUN AI
    // ===============================
    const result = await runAIInterview(candidate)
      .catch((err: any) => {
        console.error("AI runtime failed:", err);
        return null;
      });

    if (!result) {
      console.warn("⚠️ AI returned empty result");
      return null;
    }

    // ===============================
    // SAVE AI RESULT
    // ===============================
    const { data: updatedCandidate, error } =
      await supabase
        .from("candidates")
        .update({
          ...result,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidateId)
        .select()
        .single();

    if (error) {
      console.error("❌ AI result save failed:", error);
      return null;
    }

    // ===============================
    // SYSTEM MESSAGE
    // ===============================
    await supabase
      .from("messages")
      .insert({
        candidate_id: candidateId,
        content:
          `🤖 AI Review Complete: ` +
          `${result.score} (${result.decision})`,
        user_name: "Xavier AI",
        type: "ai",
      });

    console.log("✅ AI evaluation complete");

    return updatedCandidate;

  } catch (err) {
    console.error("🔥 AI evaluation failed:", err);
    return null;
  }
}