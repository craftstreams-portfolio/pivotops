import { buildIncidentGraph } from "@/lib/incidents/incident.graph.engine";
import { scoreIncident } from "@/lib/incidents/incident.scoring.engine";
import { recoverEvent } from "@/lib/recovery/recovery.engine";

// ===============================
// INCIDENT INTELLIGENCE API
// ===============================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return Response.json(
        { success: false, error: "eventId is required" },
        { status: 400 }
      );
    }

    // ===============================
    // BUILD GRAPH
    // ===============================
    const graph = await buildIncidentGraph(eventId);

    // ===============================
    // SCORE INCIDENT
    // ===============================
    const score = scoreIncident(graph);

    // ===============================
    // AUTO RECOVERY DECISION
    // ===============================
    const recovery =
      score.severityScore >= 75
        ? await recoverEvent(eventId)
        : null;

    return Response.json({
      success: true,
      eventId,
      graph,
      score,
      recovery,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return Response.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "INTELLIGENCE_API_FAILED",
      },
      { status: 500 }
    );
  }
}