import { handleRecruitmentEvent } from "./recruitment.handlers";
import { handleTaskEvent } from "./task.handlers";

import { handleSettingsEvent } from "../settings/settings.handler";
import { handleClockingEvent } from "../clocking/clocking.handler";
import { handleShowcaseEvent } from "../showcase/showcase.handler";
import { handleSpotlightEvent } from "../spotlight/spotlight.handler";
import { handleRoleUpdate } from "../admin/role.handler";

import { updateEventStatus } from "../events/event-store";

// ===============================
// 🧠 OBSERVABILITY LAYER
// ===============================
import { logTrace } from "../events/event.logger";
import { createEventContext } from "../events/event.correlation";

// ===============================
// 🧠 INTELLIGENCE LAYER
// ===============================
import { predictOperationalRisk } from "../../app/dashboard/lib/predictive-engine/workforcePredictor";
import { runWorkforceOrchestration } from "../../app/dashboard/lib/ai/orchestrator/workforceOrchestrator";
import { executeAction } from "../../app/dashboard/lib/ai/orchestrator/remediation/workforceRemediator";

// ===============================
// ENGINE TIMEOUT
// ===============================
const ENGINE_TIMEOUT_MS = 30000;

// ===============================
// SAFE EVENT TYPE
// ===============================
type EngineEvent = {
  id?: string;
  event_id?: string;
  type: string;
  payload?: unknown;
  status?: string;
  _replay?: boolean;
  [key: string]: unknown;
};

// ===============================
// ID NORMALIZER
// ===============================
function getEventId(event: EngineEvent): string | null {
  return event?.id
    ? String(event.id)
    : event?.event_id
    ? String(event.event_id)
    : null;
}

// ===============================
// TIMEOUT WRAPPER
// ===============================
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Engine timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

// ===============================
// 🧠 INTELLIGENCE HOOK
// ===============================
async function runIntelligenceLayer(event: EngineEvent) {
  try {
    const risk = predictOperationalRisk();
    const action = runWorkforceOrchestration();
    await executeAction(action);
    return { risk, action };
  } catch (err) {
    console.warn("⚠️ Intelligence layer error:", err);
    return null;
  }
}

// ===============================
// CORE EVENT PROCESSOR
// ===============================
export async function processEvent(event: EngineEvent) {
  if (!event?.type) {
    console.warn("⚠️ Invalid event blocked:", event);
    return null;
  }

  const eventId = getEventId(event);
  const context = createEventContext(eventId ?? "unknown");

  await logTrace(context, "ENGINE_RECEIVED", event.type);

  try {
    let result: unknown = null;

    // 🧠 RUN INTELLIGENCE PARALLEL (NON-BLOCKING)
    runIntelligenceLayer(event);

    // ===============================
    // ROUTER
    // ===============================
    switch (event.type as string) {
      case "CANDIDATE_STATUS_CHANGED":
      case "CANDIDATE_MOVED_STAGE":
      case "CANDIDATE_CREATED":
      case "CANDIDATE_UPDATED":
        await logTrace(context, "RECRUITMENT_START");
        result = await withTimeout(handleRecruitmentEvent(event), ENGINE_TIMEOUT_MS);
        await logTrace(context, "RECRUITMENT_DONE");
        break;

      case "TASK_CREATED":
      case "TASK_UPDATED":
        await logTrace(context, "TASK_START");
        result = await withTimeout(handleTaskEvent(event), ENGINE_TIMEOUT_MS);
        await logTrace(context, "TASK_DONE");
        break;

      case "SETTINGS_UPDATED":
        await logTrace(context, "SETTINGS_START");
        result = await withTimeout(handleSettingsEvent(event), ENGINE_TIMEOUT_MS);
        await logTrace(context, "SETTINGS_DONE");
        break;

      case "USER_CLOCKED_IN":
      case "USER_CLOCKED_OUT":
        await logTrace(context, "CLOCKING_START");
        result = await withTimeout(handleClockingEvent(event), ENGINE_TIMEOUT_MS);
        await logTrace(context, "CLOCKING_DONE");
        break;

      case "SHOWCASE_CREATED":
        await logTrace(context, "SHOWCASE_START");
        result = await withTimeout(handleShowcaseEvent(event), ENGINE_TIMEOUT_MS);
        await logTrace(context, "SHOWCASE_DONE");
        break;

      case "USER_SPOTLIGHTED":
        await logTrace(context, "SPOTLIGHT_START");
        result = await withTimeout(handleSpotlightEvent(event), ENGINE_TIMEOUT_MS);
        await logTrace(context, "SPOTLIGHT_DONE");
        break;

      case "USER_ROLE_UPDATED":
        await logTrace(context, "ROLE_START");
        result = await withTimeout(handleRoleUpdate(event), ENGINE_TIMEOUT_MS);
        await logTrace(context, "ROLE_DONE");
        break;

      default:
        await logTrace(context, "UNKNOWN_EVENT", event.type);
        console.warn("⚠️ Unknown event type:", event.type);
        if (eventId) await updateEventStatus(eventId, "ignored");
        return null;
    }

    await logTrace(context, "ENGINE_SUCCESS");
    if (eventId) await updateEventStatus(eventId, "processed");

    return result;
  } catch (err: unknown) {
    console.error("🔥 Engine failed:", err);
    await logTrace(context, "ENGINE_FAILED", String(err));
    if (eventId) await updateEventStatus(eventId, "failed");
    return null;
  }
}

// ===============================
// ENGINE STARTER
// ===============================
export async function startWorkforceEngine(event: EngineEvent) {
  return processEvent(event);
}