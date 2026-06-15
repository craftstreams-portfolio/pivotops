import { analyzeReplay } from "../../../../lib/replay/replay.ai";

// ===============================
// REPLAY INSIGHTS API
// ===============================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const eventId = searchParams.get("eventId");

    // ===============================
    // VALIDATION
    // ===============================
    if (!eventId) {
      return Response.json(
        {
          success: false,
          error: "Missing eventId",
        },
        {
          status: 400,
        }
      );
    }

    // ===============================
    // ANALYZE REPLAY
    // ===============================
    const insight = await analyzeReplay(eventId);

    // ===============================
    // SUCCESS RESPONSE
    // ===============================
    return Response.json({
      success: true,
      data: insight,
    });
  } catch (err: unknown) {
    console.error("❌ Replay insights API failed:", err);

    return Response.json(
      {
        success: false,
        error: "Replay analysis failed",
      },
      {
        status: 500,
      }
    );
  }
}