import { analyzeEventCognition } from "@/lib/ai/event-cognition";

// ===============================
// GET REPLAY COGNITION REPORT
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

    // ===============================
    // RUN AI COGNITION
    // ===============================
    const report =
      await analyzeEventCognition(
        eventId
      );

    // ===============================
    // SUCCESS RESPONSE
    // ===============================
    return Response.json({
      success: true,
      report,
    });
  } catch (
    err: unknown
  ) {
    console.error(
      "❌ Cognition route failed:",
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
            : "COGNITION_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}