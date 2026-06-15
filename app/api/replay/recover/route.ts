import { recoverEvent } from "@/lib/recovery/recovery.engine";

// ===============================
// AUTONOMOUS EVENT RECOVERY API
// ===============================
export async function GET(
  req: Request
) {
  try {
    // ===============================
    // PARSE URL
    // ===============================
    const { searchParams } =
      new URL(req.url);

    const eventId =
      searchParams.get(
        "eventId"
      );

    // ===============================
    // VALIDATION
    // ===============================
    if (!eventId) {
      return Response.json(
        {
          success: false,
          error:
            "Missing eventId",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "🛠 Recovery request received:",
      eventId
    );

    // ===============================
    // RUN RECOVERY ENGINE
    // ===============================
    const result =
      await recoverEvent(
        eventId
      );

    // ===============================
    // SUCCESS RESPONSE
    // ===============================
    return Response.json({
      success: true,
      recovery: result,
    });
  } catch (
    err: unknown
  ) {
    console.error(
      "❌ Recovery route failed:",
      err
    );

    // ===============================
    // SAFE ERROR RESPONSE
    // ===============================
    return Response.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "RECOVERY_ROUTE_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}