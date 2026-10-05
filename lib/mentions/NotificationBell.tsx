"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, AtSign, Users, Megaphone, X } from "lucide-react";
import { useNotifications } from "./mention.hooks";
import { markOneRead } from "./mention.service";
import type { AppNotification } from "./mention.service";

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "mention_all")        return <Megaphone size={13} className="text-amber-400" />;
  if (type === "mention_department") return <Users     size={13} className="text-emerald-400" />;
  return <AtSign size={13} className="text-indigo-400" />;
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead:       (id: string) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/60 transition cursor-pointer
        ${!notification.read ? "bg-indigo-500/5 border-l-2 border-indigo-500" : ""}`}
      onClick={() => !notification.read && onRead(notification.id)}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
        ${notification.type === "mention_all"
          ? "bg-amber-500/15"
          : notification.type === "mention_department"
            ? "bg-emerald-500/15"
            : "bg-indigo-500/15"
        }`}>
        <NotificationIcon type={notification.type} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-white font-medium leading-tight">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
            {notification.body}
          </p>
        )}
        <p className="text-[10px] text-zinc-600 mt-1">{formatRelative(notification.created_at)}</p>
      </div>

      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// NOTIFICATION BELL
// ─────────────────────────────────────────
export function NotificationBell({
  userId,
  tenantId,
}: {
  userId:   string;
  tenantId: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, markAllRead } = useNotifications(userId, tenantId);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleRead = async (id: string) => {
    await markOneRead(id);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700
                   flex items-center justify-center transition"
      >
        <Bell size={16} className="text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500
                           flex items-center justify-center text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-zinc-900 border border-zinc-800
                        rounded-2xl shadow-2xl overflow-hidden z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <p className="text-sm font-semibold text-white">Notifications</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-indigo-400
                             hover:text-indigo-300 transition"
                >
                  <Check size={10} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition"
              >
                <X size={12} className="text-zinc-500" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-800/50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
                <Bell size={24} className="mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={handleRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}