import { handleRecruitmentEvent } from "@/lib/engine/recruitment.handlers";
import { handleTaskEvent } from "@/lib/engine/task.handlers";

// ---------- SAFE WRAPPER ----------
async function safeRun(fn: () => Promise<any>, label: string) {
  try {
    return await fn();
  } catch (err) {
    console.error(`❌ ${label} failed:`, err);
    return null;
  }
}

// ---------- AUTOMATION LAYER (FIXED MISSING FUNCTION) ----------
async function runAutomation({
  type,
  event,
  result,
}: {
  type: "recruitment" | "task";
  event: any;
  result: any;
}) {
  try {
    console.log("⚙️ Automation triggered:", {
      type,
      eventType: event?.type,
    });

    // FUTURE EXTENSIONS:
    // - AI scoring
    // - interview scheduling
    // - notifications
    // - analytics sync

    return {
      ok: true,
      type,
      processed: true,
    };
  } catch (err) {
    console.error("❌ runAutomation failed:", err);
    return null;
  }
}

// ---------- MAIN EVENT PROCESSOR ----------
export async function processEvent(event: any) {
  if (!event || !event.type) {
    console.warn("⚠️ Invalid event received:", event);
    return;
  }

  let result: any = null;

  try {
    switch (event.type) {

      // =========================
      // RECRUITMENT EVENTS
      // =========================
      case "CANDIDATE_MOVED_STAGE":
      case "CANDIDATE_CREATED":

        result = await safeRun(
          () => handleRecruitmentEvent(event),
          "Recruitment handler"
        );

        await safeRun(
          () => runAutomation({ type: "recruitment", event, result }),
          "Recruitment automation"
        );

        break;

      // =========================
      // TASK EVENTS
      // =========================
      case "TASK_CREATED":
      case "TASK_UPDATED":

        result = await safeRun(
          () => handleTaskEvent(event),
          "Task handler"
        );

        await safeRun(
          () => runAutomation({ type: "task", event, result }),
          "Task automation"
        );

        break;

      // =========================
      // SAFETY NET
      // =========================
      default:
        console.warn("⚠️ Unknown event:", event.type);
        return;
    }

    return result;

  } catch (err) {
    console.error("🔥 processEvent failed:", err);
    return null;
  }
}