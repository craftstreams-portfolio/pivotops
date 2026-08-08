import { useState } from "react";
import { rebuildStateAt } from "../../lib/engine/state.timetravel";

// ===============================
// TYPE SAFETY FIX
// ===============================
type TimeTravelState = {
  candidates: Record<string, any>;
  tasks: Record<string, any>;
} | null;

// ===============================
// HOOK
// ===============================
export function useTimeTravel() {
  const [state, setState] = useState<TimeTravelState>(null);

  const goToTime = async (timestamp: string) => {
    const snapshot = await rebuildStateAt(timestamp);
    setState(snapshot);
  };

  return {
    state,
    goToTime,
  };
}
