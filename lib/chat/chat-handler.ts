import { supabase } from "../supabase";

// ===============================
// SAFE MESSAGE INSERT
// Prevents duplicate crashes
// ===============================
async function insertMessage(data: any) {
  try {
    const { error } = await supabase
      .from("messages")
      .insert(data);

    if (error) {
      console.error("❌ Message insert failed:", error);
      return null;
    }

    return true;

  } catch (err) {
    console.error("🔥 insertMessage crashed:", err);
    return null;
  }
}

// ===============================
// CHAT EVENT HANDLER
// Central activity feed processor
// ===============================
export async function handleChatEvent(event: any) {
  try {
    // ===============================
    // HARD VALIDATION
    // ===============================
    if (!event?.type || !event?.payload) {
      console.warn("⚠️ Invalid chat event:", event);
      return null;
    }

    const { type, payload } = event;

    // ===============================
    // NORMALIZED VALUES
    // ===============================
    const tenant_id =
      payload?.tenant_id ?? "default";

    const actorName =
      payload?.actor?.name ||
      payload?.actor_email ||
      "System";

    const candidateId =
      payload?.candidate_id ??
      payload?.id;

    // ===============================
    // CANDIDATE STATUS CHANGED
    // ===============================
    if (type === "CANDIDATE_STATUS_CHANGED") {

      if (!candidateId) {
        console.warn("⚠️ Missing candidate ID");
        return null;
      }

      await insertMessage({
        candidate_id: candidateId,
        tenant_id,
        content:
          `📌 Candidate moved to ` +
          `${payload?.status ?? "unknown stage"}`,
        user_name: actorName,
        type: "system",
        created_at: new Date().toISOString(),
      });

      console.log("✅ Chat activity logged");

      return true;
    }

    // ===============================
    // CANDIDATE CREATED
    // ===============================
    if (type === "CANDIDATE_CREATED") {

      await insertMessage({
        candidate_id: candidateId,
        tenant_id,
        content:
          `🆕 New candidate added: ` +
          `${payload?.name || "Unknown Candidate"}`,
        user_name: actorName,
        type: "system",
        created_at: new Date().toISOString(),
      });

      console.log("✅ Candidate creation logged");

      return true;
    }

    // ===============================
    // TASK UPDATED
    // ===============================
    if (type === "TASK_UPDATED") {

      await insertMessage({
        task_id: payload?.task_id,
        tenant_id,
        content:
          `📝 Task updated: ` +
          `${payload?.status ?? "updated"}`,
        user_name: actorName,
        type: "system",
        created_at: new Date().toISOString(),
      });

      console.log("✅ Task update logged");

      return true;
    }

    // ===============================
    // TASK CREATED
    // ===============================
    if (type === "TASK_CREATED") {

      await insertMessage({
        task_id: payload?.task_id,
        tenant_id,
        content:
          `🆕 New task created`,
        user_name: actorName,
        type: "system",
        created_at: new Date().toISOString(),
      });

      console.log("✅ Task creation logged");

      return true;
    }

    // ===============================
    // INTERVIEW SCHEDULED
    // ===============================
    if (type === "INTERVIEW_SCHEDULED") {

      await insertMessage({
        candidate_id: candidateId,
        tenant_id,
        content:
          `📅 Interview scheduled for ` +
          `${payload?.date ?? "TBD"}`,
        user_name: actorName,
        type: "system",
        created_at: new Date().toISOString(),
      });

      console.log("✅ Interview event logged");

      return true;
    }

    // ===============================
    // UNKNOWN EVENT
    // ===============================
    console.warn("⚠️ Unhandled chat event:", type);

    return null;

  } catch (err) {
    console.error("🔥 Chat handler failed:", err);
    return null;
  }
}