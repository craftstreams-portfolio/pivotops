"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * app/dashboard/components/voice/TimeItPanel.tsx
 *
 * Speaker Mode only (Agenda Mode is a later phase). Polls the server every
 * 1.5s for authoritative timer state - never counts down locally against a
 * client clock, per spec section 40 (anti-manipulation) and section 23
 * (server-authoritative state). The /tick endpoint both reads and advances
 * warnings/expiry, so polling from any open client keeps the timer moving.
 *
 * Kept deliberately compact per spec section 18 ("do not allow Time It to
 * dominate the Huddle interface") - a small floating card, not a takeover.
 */

interface TimerState {
  status: "idle" | "running" | "paused" | "expired";
  current_speaker_id: string | null;
  duration_seconds: number;
  remaining_seconds: number;
  auto_mute: boolean;
  extension_seconds: number;
}

interface Participant {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

async function authedFetch(path: string, body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export function TimeItPanel({
  roomId, isHost, participants, onClose,
}: {
  roomId: string;
  isHost: boolean;
  participants: Participant[];
  onClose: () => void;
}) {
  const [state, setState] = useState<TimerState | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [duration, setDuration] = useState(300);
  const [autoMute, setAutoMute] = useState(true);
  const [busy, setBusy] = useState(false);
  const warned60Ref = useRef(false);
  const warned30Ref = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Simple, professional short chime - generated in-browser rather than
  // bundling an audio asset. Single tone for 60s, double for 30s (spec §9).
  function playChime(times: number) {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      for (let i = 0; i < times; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 720;
        osc.type = "sine";
        const start = ctx.currentTime + i * 0.22;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
        gain.gain.linearRampToValueAtTime(0, start + 0.16);
        osc.start(start); osc.stop(start + 0.18);
      }
    } catch {}
  }

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await authedFetch(`/api/huddles/time-it/tick`, { roomId });
        const data = await res.json();
        if (cancelled || !data.state) { if (!cancelled) setState(null); return; }
        setState(data.state);

        if (data.state.remaining_seconds <= 60 && data.state.remaining_seconds > 30 && !warned60Ref.current) {
          warned60Ref.current = true;
          playChime(1);
        }
        if (data.state.remaining_seconds <= 30 && data.state.remaining_seconds > 0 && !warned30Ref.current) {
          warned30Ref.current = true;
          playChime(2);
        }
        if (data.state.status !== "running") { warned60Ref.current = false; warned30Ref.current = false; }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(iv); };
  }, [roomId]);

  const speakerName = (id: string | null) => {
    if (!id) return "";
    const p = participants.find((x) => x.user_id === id);
    return p?.full_name ?? p?.email ?? "Speaker";
  };

  async function handleStart() {
    if (!selectedSpeaker) return;
    setBusy(true);
    warned60Ref.current = false; warned30Ref.current = false;
    const p = participants.find((x) => x.user_id === selectedSpeaker);
    await authedFetch("/api/huddles/time-it/start", {
      roomId, speakerId: selectedSpeaker, speakerName: p?.full_name ?? p?.email ?? "",
      durationSeconds: duration, autoMute,
    });
    setBusy(false);
  }
  async function handlePause()  { setBusy(true); await authedFetch("/api/huddles/time-it/pause",  { roomId }); setBusy(false); }
  async function handleResume() { setBusy(true); await authedFetch("/api/huddles/time-it/resume", { roomId }); setBusy(false); }
  async function handleSkip()   { setBusy(true); await authedFetch("/api/huddles/time-it/skip",   { roomId }); setBusy(false); }
  async function handleEnd()    { setBusy(true); await authedFetch("/api/huddles/time-it/end",    { roomId }); setBusy(false); }
  async function handleExtend(extra: number) {
    setBusy(true);
    await authedFetch("/api/huddles/time-it/extend", { roomId, extraSeconds: extra });
    setBusy(false);
  }

  const isCritical = state && state.remaining_seconds <= 30 && state.status === "running";
  const isWarning  = state && state.remaining_seconds <= 60 && state.remaining_seconds > 30 && state.status === "running";

  return (
    <div className="fixed top-20 right-4 z-30 w-72 rounded-2xl border border-white/10 bg-[#0c0a14]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-xs font-semibold text-white tracking-wide">TIME IT</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm">✕</button>
      </div>

      <div className="p-4 space-y-4">
        {!state || state.status === "idle" ? (
          isHost ? (
            <div className="space-y-3">
              <select value={selectedSpeaker} onChange={(e) => setSelectedSpeaker(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white">
                <option value="">Select speaker…</option>
                {participants.map((p) => (
                  <option key={p.user_id} value={p.user_id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
              <div className="flex gap-1.5">
                {[60, 120, 180, 300, 600].map((s) => (
                  <button key={s} onClick={() => setDuration(s)}
                    className={`flex-1 text-[10px] py-1.5 rounded-lg border transition ${
                      duration === s ? "bg-[#00BFA6]/20 border-[#00BFA6]/50 text-[#00BFA6]" : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}>
                    {s < 60 ? `${s}s` : `${s / 60}m`}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                <input type="checkbox" checked={autoMute} onChange={(e) => setAutoMute(e.target.checked)} />
                Auto-mute when time expires
              </label>
              <button onClick={handleStart} disabled={!selectedSpeaker || busy}
                className="w-full py-2 rounded-lg bg-[#00BFA6] text-[#04211E] text-xs font-semibold disabled:opacity-40">
                Start timer
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-4">Waiting for the host to start Time It.</p>
          )
        ) : (
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                {state.status === "paused" ? "Paused" : "Now speaking"}
              </p>
              <p className="text-sm text-white font-medium mb-2">{speakerName(state.current_speaker_id)}</p>
              <p className="font-mono font-bold tabular-nums transition-colors"
                 style={{
                   fontSize: 40,
                   color: state.status === "expired" ? "#EF4444" : isCritical ? "#F59E0B" : isWarning ? "#FCD34D" : "#FFFFFF",
                 }}>
                {state.status === "expired" ? "TIME UP" : fmt(state.remaining_seconds)}
              </p>
              {state.extension_seconds > 0 && (
                <p className="text-[10px] text-[#00BFA6] mt-1">+{fmt(state.extension_seconds)} granted</p>
              )}
            </div>

            {isHost && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {state.status === "running" ? (
                    <button onClick={handlePause} disabled={busy} className="flex-1 py-1.5 rounded-lg border border-white/10 text-[11px] text-zinc-300 hover:border-white/20">Pause</button>
                  ) : state.status === "paused" ? (
                    <button onClick={handleResume} disabled={busy} className="flex-1 py-1.5 rounded-lg border border-white/10 text-[11px] text-zinc-300 hover:border-white/20">Resume</button>
                  ) : null}
                  <button onClick={handleSkip} disabled={busy} className="flex-1 py-1.5 rounded-lg border border-white/10 text-[11px] text-zinc-300 hover:border-white/20">Skip</button>
                  <button onClick={handleEnd} disabled={busy} className="flex-1 py-1.5 rounded-lg border border-red-500/30 text-[11px] text-red-400 hover:border-red-500/50">End</button>
                </div>
                {(state.status === "expired" || isCritical) && (
                  <div className="flex gap-1.5">
                    <button onClick={() => handleExtend(30)}  disabled={busy} className="flex-1 py-1.5 rounded-lg bg-[#00BFA6]/15 border border-[#00BFA6]/40 text-[11px] text-[#00BFA6]">+30s</button>
                    <button onClick={() => handleExtend(60)}  disabled={busy} className="flex-1 py-1.5 rounded-lg bg-[#00BFA6]/15 border border-[#00BFA6]/40 text-[11px] text-[#00BFA6]">+1m</button>
                    <button onClick={() => handleExtend(120)} disabled={busy} className="flex-1 py-1.5 rounded-lg bg-[#00BFA6]/15 border border-[#00BFA6]/40 text-[11px] text-[#00BFA6]">+2m</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}