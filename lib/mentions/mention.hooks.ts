import { useState, useCallback, useEffect, useRef } from "react";
import { extractMentions, hasMentions, type ParsedMention } from "./mention.parser";
import {
  saveMentions, notifyMentionedUsers,
  getUserNotifications, markNotificationsRead,
  subscribeToNotifications, type AppNotification,
} from "./mention.service";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface Profile {
  id:         string;
  full_name:  string | null;
  email:      string | null;
  department: string | null;
}

interface UseMentionInputOptions {
  profiles:      Profile[];
  tenantId:      string;
  userId:        string;
  userName:      string;
  context:       "task" | "comment" | "chat";
  taskId?:       string | null;
  refId?:        string | null;
}

// ─────────────────────────────────────────
// useMentionInput
// Wraps a text input/textarea with mention detection,
// autocomplete suggestions, and DB save on submit.
// ─────────────────────────────────────────
export function useMentionInput(options: UseMentionInputOptions) {
  const { profiles, tenantId, userId, userName, context, taskId, refId } = options;

  const [value,        setValue]        = useState("");
  const [suggestions,  setSuggestions]  = useState<Profile[]>([]);
  const [showSuggest,  setShowSuggest]  = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Detect @token as user types
  const handleChange = useCallback((text: string) => {
    setValue(text);

    // Find last @word before cursor
    const match = text.match(/@([\w.]*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      setMentionQuery(query);

      if (query === "" || query === "all" || query === "everyone") {
        setSuggestions([]);
        setShowSuggest(query === "");
        return;
      }

      const filtered = profiles.filter((p) => {
        const name  = (p.full_name  ?? "").toLowerCase();
        const email = (p.email      ?? "").toLowerCase();
        return name.includes(query) || email.includes(query);
      }).slice(0, 6);

      setSuggestions(filtered);
      setShowSuggest(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggest(false);
      setMentionQuery("");
    }
  }, [profiles]);

  // User selects a suggestion
  const selectSuggestion = useCallback((profile: Profile) => {
    const name     = (profile.full_name ?? profile.email ?? "user").replace(/\s+/g, "");
    const replaced = value.replace(/@[\w.]*$/, `@${name} `);
    setValue(replaced);
    setSuggestions([]);
    setShowSuggest(false);
    inputRef.current?.focus();
  }, [value]);

  // Process and save mentions on submit
  const processMentions = useCallback(async (content: string): Promise<ParsedMention[]> => {
    if (!hasMentions(content)) return [];

    const parsed = extractMentions(content, profiles);
    if (!parsed.length) return [];

    // Save to DB
    await saveMentions({
      tenantId,
      createdBy: userId,
      mentions:  parsed,
      context,
      content,
      taskId:    taskId ?? null,
    });

    // Send in-app notifications
    await notifyMentionedUsers({
      tenantId,
      createdBy:     userId,
      createdByName: userName,
      mentions:      parsed,
      context,
      content,
      refId:         refId ?? null,
      profiles,
    });

    return parsed;
  }, [tenantId, userId, userName, context, taskId, refId, profiles]);

  const reset = useCallback(() => {
    setValue("");
    setSuggestions([]);
    setShowSuggest(false);
  }, []);

  return {
    value,
    setValue: handleChange,
    suggestions,
    showSuggest,
    mentionQuery,
    selectSuggestion,
    processMentions,
    inputRef,
    reset,
  };
}

// ─────────────────────────────────────────
// useNotifications
// Real-time in-app notification bell hook
// ─────────────────────────────────────────
export function useNotifications(userId: string, tenantId: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  // Initial load
  useEffect(() => {
    if (!userId || !tenantId) return;
    const load = async () => {
      const data = await getUserNotifications(userId, tenantId);
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    };
    load();
  }, [userId, tenantId]);

  // Realtime subscription — sync wrapper prevents TS error on async cleanup
  useEffect(() => {
    if (!userId || !tenantId) return;
    const unsub = subscribeToNotifications(userId, tenantId, (n) => {
      setNotifications((prev) => [n, ...prev]);
      setUnreadCount((c) => c + 1);
    });
    return () => { unsub(); };  // ← sync wrapper around async unsub
  }, [userId, tenantId]);

  const markAllRead = useCallback(async () => {
    await markNotificationsRead(userId, tenantId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [userId, tenantId]);

  return { notifications, unreadCount, markAllRead };
}