import { rebuildStateAt } from "./state.timetravel";

// ===============================
// REPLAY STEP-BY-STEP
// ===============================
export async function replayTimeline(
  start: string,
  end: string
) {
  const states: any[] = [];

  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  const step = 1000 * 60 * 60; // 1 hour steps

  for (
    let t = startTime;
    t <= endTime;
    t += step
  ) {
    const snapshot = await rebuildStateAt(
      new Date(t).toISOString()
    );

    states.push({
      timestamp: t,
      snapshot,
    });
  }

  return states;
}