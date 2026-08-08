"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function useUnreadCounts(userId: string | null) {
  const [counts, setCounts]   = useState<Record<string, number>>({});
  const fetchingRef           = useRef(false);

  const fetch = useCallback(async () => {
    if (!userId || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res  = await window.fetch(`/api/chat/unread?userId=${userId}`);
      const data = await res.json();
      setCounts(data ?? {});
    } catch {}
    finally { fetchingRef.current = false; }
  }, [userId]);

  // Mark a channel as read and clear its badge
  const markRead = useCallback(async (channelId: string) => {
    if (!userId) return;
    setCounts(prev => { const n = { ...prev }; delete n[channelId]; return n; });
    try {
      await window.fetch("/api/chat/unread", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, channelId }),
      });
    } catch {}
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetch();

    // Refresh on new messages
    // Unique per mount - this hook now runs in more than one place at once
    // (the sidebar badge in layout.tsx and the Teams page's per-channel
    // counts), and Supabase Realtime throws if two channels share a name
    // and both try to attach postgres_changes listeners after subscribing.
    const ch = supabase.channel(`unread-watch-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "messages",
      }, () => fetch())
      .subscribe();

    // Refresh every 30s as fallback
    const iv = setInterval(fetch, 30_000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
  }, [userId, fetch]);

  return { counts, markRead };
}