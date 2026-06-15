import { supabase } from "../supabase";

import { processEvent } from "../engine/workforce.engine";

import {
  enqueueEvent,
  moveToDeadQueue,
  type QueuedEvent,
} from "../events/event.queue";

// ===============================
// MAX RECOVERY RETRIES
// ===============================
const MAX_RECOVERY_RETRIES = 5;

// ===============================
// FAILED EVENT TYPE
// ===============================
type FailedEvent = {
  id?: string;

  type?: string;

  payload?: any;

  status?: string;

  retry_count?: number;
};

// ===============================
// RECOVER FAILED EVENTS
// ===============================
export async function recoverFailedEvents() {
  try {
    // ===============================
    // FETCH FAILED EVENTS
    // ===============================
    const {
      data: failedEvents,
      error,
    } = await supabase
      .from("event_logs")
      .select("*")
      .eq("status", "failed")
      .limit(20);

    if (error) {
      console.error(
        "❌ Failed fetching failed events:",
        {
          message:
            error.message,

          code: error.code,

          details:
            error.details,
        }
      );

      return;
    }

    if (!failedEvents?.length) {
      return;
    }

    // ===============================
    // RECOVER EVENTS
    // ===============================
    for (const rawEvent of failedEvents as FailedEvent[]) {
      try {
        // ===============================
        // VALIDATION
        // ===============================
        if (
          !rawEvent?.id ||
          !rawEvent?.type
        ) {
          continue;
        }

        const retryCount =
          rawEvent.retry_count ??
          0;

        // ===============================
        // DEAD LETTER SAFETY
        // ===============================
        if (
          retryCount >=
          MAX_RECOVERY_RETRIES
        ) {
          await moveToDeadQueue({
            id: String(
              rawEvent.id
            ),

            type:
              rawEvent.type,

            payload:
              rawEvent.payload,

            attempts:
              retryCount,

            status:
              "failed",
          });

          console.warn(
            "☠️ Recovery moved event to dead queue:",
            rawEvent.id
          );

          continue;
        }

        // ===============================
        // MARK PROCESSING
        // ===============================
        await supabase
          .from("event_logs")
          .update({
            status:
              "processing",
          })
          .eq(
            "id",
            String(
              rawEvent.id
            )
          );

        // ===============================
        // REQUEUE EVENT
        // ===============================
        const queuedEvent: QueuedEvent =
          {
            id: String(
              rawEvent.id
            ),

            type:
              rawEvent.type,

            payload:
              rawEvent.payload,

            attempts:
              retryCount + 1,

            status:
              "queued",
          };

        await enqueueEvent(
          queuedEvent
        );

        // ===============================
        // OPTIONAL DIRECT PROCESS
        // ===============================
        await processEvent({
          id: queuedEvent.id,

          type:
            queuedEvent.type,

          payload:
            queuedEvent.payload,

          status:
            queuedEvent.status,
        });

        console.log(
          "♻️ Failed event recovered:",
          {
            id: rawEvent.id,

            type:
              rawEvent.type,
          }
        );
      } catch (err: unknown) {
        console.error(
          "❌ Recovery failed for event:",
          rawEvent?.id,
          err
        );

        // ===============================
        // MARK FAILED AGAIN
        // ===============================
        if (rawEvent?.id) {
          await supabase
            .from("event_logs")
            .update({
              status:
                "failed",

              retry_count:
                (
                  rawEvent.retry_count ??
                  0
                ) + 1,
            })
            .eq(
              "id",
              String(
                rawEvent.id
              )
            );
        }
      }
    }
  } catch (err: unknown) {
    console.error(
      "🔥 Recovery system crashed:",
      err
    );
  }
}