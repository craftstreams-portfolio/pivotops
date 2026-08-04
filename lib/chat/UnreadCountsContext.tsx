"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

/**
 * lib/chat/UnreadCountsContext.tsx
 *
 * Single shared source of truth for unread message counts, replacing two
 * independent useUnreadCounts() calls (one in the dashboard sidebar, one in
 * the Teams page) that each held their own state and their own Realtime
 * subscription. Those two instances had no way to guarantee agreement -
 * markRead() in one only updated that instance's local state, so the sidebar
 * badge could show a stale count even after the Teams page correctly marked
 * a channel read and the database confirmed zero unread. This provider is
 * mounted once at the dashboard layout level; every consumer reads the same
 * counts object and the same markRead function, so they cannot disagree.
 */

interface UnreadCountsValue {
  counts: Record<string, number>;
  markRead: (channelId: string) => Promise<void>;
  refresh: () => void;
}

const UnreadCountsContext = createContext<UnreadCountsValue>({
  counts: {},
  markRead: async () => {},
  refresh: () => {},
});

export function UnreadCountsProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const fetchingRef = useRef(false);

  const fetchCounts = useCallback(async () => {
    if (!userId || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await window.fetch(`/api/chat/unread?userId=${userId}`);
      const data = await res.json();
      setCounts(data ?? {});
    } catch {}
    finally { fetchingRef.current = false; }
  }, [userId]);

  const markRead = useCallback(async (channelId: string) => {
    if (!userId) return;
    // Optimistic - clears instantly for every consumer, since there is only
    // one counts object now.
    setCounts(prev => {
      if (!(channelId in prev)) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    try {
      await window.fetch("/api/chat/unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, channelId }),
      });
    } catch {}
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchCounts();

    // ONE subscription for the whole app, not one per component that happens
    // to call the hook. Channel name is unique per user so multiple browser
    // tabs / accounts never collide.
    const ch = supabase
      .channel(`unread-watch-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => fetchCounts())
      .subscribe();

    const iv = setInterval(fetchCounts, 30_000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
  }, [userId, fetchCounts]);

  return (
    <UnreadCountsContext.Provider value={{ counts, markRead, refresh: fetchCounts }}>
      {children}
    </UnreadCountsContext.Provider>
  );
}

export function useUnreadCountsContext(): UnreadCountsValue {
  return useContext(UnreadCountsContext);
}