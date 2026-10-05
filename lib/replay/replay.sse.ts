import { streamReplay } from "./replay.stream";

// ===============================
// SSE REPLAY STREAM HANDLER
// ===============================
export async function replayStreamHandler(req: any, res: any) {
  const eventId = req.query.eventId;

  if (!eventId) {
    return res.status(400).send("Missing eventId");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    for await (const step of streamReplay(eventId)) {
      res.write(
        `data: ${JSON.stringify({
          type: "REPLAY_STEP",
          payload: step,
        })}\n\n`
      );
    }

    res.write(
      `data: ${JSON.stringify({
        type: "REPLAY_DONE",
        eventId,
      })}\n\n`
    );

    res.end();
  } catch (err: unknown) {
    res.write(
      `data: ${JSON.stringify({
        type: "REPLAY_ERROR",
        error: "Stream failed",
      })}\n\n`
    );

    res.end();
  }
}