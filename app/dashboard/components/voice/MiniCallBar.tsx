"use client";

import { useRouter, usePathname } from "next/navigation";
import { useHuddleCall } from "@/lib/huddles/HuddleCallContext";

/**
 * app/dashboard/components/voice/MiniCallBar.tsx
 *
 * Persistent call controls shown whenever a Huddle is live and the user has
 * navigated away from the Huddles page. Gives them mute and leave from
 * anywhere in the app, and a way back into the full view.
 */
export function MiniCallBar() {
  const { activeRoom, participants, levels, myMuted, toggleMute, leaveRoom } = useHuddleCall();
  const router = useRouter();
  const pathname = usePathname();

  // Hidden on the Huddles page itself - the full UI is already there.
  if (!activeRoom || pathname === "/dashboard/voice") return null;

  const speaking = Object.entries(levels).filter(([, lvl]) => lvl > 18).length;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-3 rounded-2xl
                    border border-white/10 bg-[#0c0a14]/95 backdrop-blur-xl px-4 py-3 shadow-2xl">
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>

      <button onClick={() => router.push("/dashboard/voice")} className="text-left min-w-0">
        <p className="text-xs font-medium text-white truncate max-w-[150px]">{activeRoom.name}</p>
        <p className="text-[10px] text-zinc-500">
          {participants.length} in call{speaking > 0 ? ` · ${speaking} speaking` : ""}
        </p>
      </button>

      <button
        onClick={toggleMute}
        title={myMuted ? "Unmute" : "Mute"}
        className="flex h-9 w-9 items-center justify-center rounded-full transition"
        style={{
          background: myMuted ? "rgba(220,38,38,0.16)" : "rgba(124,58,237,0.18)",
          border: myMuted ? "1px solid rgba(220,38,38,0.45)" : "1px solid rgba(124,58,237,0.45)",
        }}
      >
        <span className="text-sm">{myMuted ? "🔇" : "🎙️"}</span>
      </button>

      <button
        onClick={() => { void leaveRoom(); }}
        title="Leave huddle"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15
                   border border-red-500/40 text-red-400 text-sm transition hover:bg-red-500/25"
      >
        ✕
      </button>
    </div>
  );
}