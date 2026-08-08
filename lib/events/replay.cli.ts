import { replayEvent } from "./event.replay";

// Run from terminal/debug scripts
export async function runReplayCLI(eventId: string) {
  console.log("🧠 CLI Replay Started:", eventId);

  const result = await replayEvent({
    eventId,
    mode: "debug",
  });

  console.log("✅ CLI Replay Complete:", result);
}