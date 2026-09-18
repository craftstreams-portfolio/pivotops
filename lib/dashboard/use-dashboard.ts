"use client";

import { useEffect, useState } from "react";
import { subscribeUI, getUIState } from "../realtime/ui-sync";

export function useDashboard() {
  const [state, setState] = useState(getUIState());

  useEffect(() => {
    setState(getUIState());

    const unsubscribe = subscribeUI(() => {
      setState(getUIState());
    });

    return unsubscribe;
  }, []);

  return state;
}