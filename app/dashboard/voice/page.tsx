"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/* ────────────────────────────────────────────────────────────────────────
   TYPES
──────────────────────────────────────────────────────────────────────── */
interface VoiceRoom {
  id: string;
  tenant_id: string;
  name: string;
  created_by: string;
  department: string | null;
  created_at: string;
  is_active: boolean;
  ended_at: string | null;
  duration_seconds: number | null;
}

interface VoiceRoomParticipant {
  id: string;
  tenant_id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  hand_raised: boolean;
  is_muted: boolean;
}

interface Profile {
  id: string;
  [key: string]: any;
}

interface SignalMsg {
  type: "offer" | "answer" | "ice" | "leave";
  from: string;
  to?: string;
  payload: any;
}

/* ────────────────────────────────────────────────────────────────────────
   SELF-CONTAINED AUDIO-ONLY WEBRTC MESH
   (mirrors the architecture of lib's WebRTCEngine, trimmed to audio-only
   and inlined here so this page has zero cross-file import risk)
──────────────────────────────────────────────────────────────────────── */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

class AudioMeshEngine {
  private roomId: string;
  private userId: string;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private channel: any = null;
  private audioCtx: AudioContext | null = null;
  private rafIds: Map<string, number> = new Map();

  onPeerStream?: (userId: string, stream: MediaStream) => void;
  onPeerLevel?: (userId: string, level: number) => void;
  onLocalLevel?: (level: number) => void;
  onPeerLeft?: (userId: string) => void;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  async getLocalStream(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.localStream = stream;
    this.meterStream(stream, "local", (lvl) => this.onLocalLevel?.(lvl));
    return stream;
  }

  private meterStream(stream: MediaStream, key: string, cb: (lvl: number) => void) {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioContext();
      } catch {
        return;
      }
    }
    try {
      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        cb(Math.round(avg));
        this.rafIds.set(key, requestAnimationFrame(tick));
      };
      tick();
    } catch {
      /* AudioContext unsupported in this environment — spectrum stays flat */
    }
  }

  async join(existingPeerIds: string[]) {
    this.channel = supabase
      .channel(`huddle-signal-${this.roomId}`)
      .on("broadcast", { event: "signal" }, ({ payload }: any) => this.handleSignal(payload))
      .subscribe();

    for (const peerId of existingPeerIds) {
      if (peerId !== this.userId) await this.createPeerConnection(peerId, true);
    }
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  async leave() {
    this.send({ type: "leave", from: this.userId, payload: {} });
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.rafIds.forEach((id) => cancelAnimationFrame(id));
    this.rafIds.clear();
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.audioCtx) {
      await this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private async createPeerConnection(peerId: string, initiator: boolean) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    const remote = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remote.addTrack(t));
      this.onPeerStream?.(peerId, remote);
      this.meterStream(remote, peerId, (lvl) => this.onPeerLevel?.(peerId, lvl));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({ type: "ice", from: this.userId, to: peerId, payload: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.onPeerLeft?.(peerId);
        this.peers.delete(peerId);
        const raf = this.rafIds.get(peerId);
        if (raf) cancelAnimationFrame(raf);
      }
    };

    this.peers.set(peerId, pc);

    if (initiator) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      this.send({ type: "offer", from: this.userId, to: peerId, payload: offer });
    }
  }

  private async handleSignal(msg: SignalMsg) {
    if (msg.from === this.userId) return;
    if (msg.to && msg.to !== this.userId) return;

    if (msg.type === "offer") {
      if (!this.peers.has(msg.from)) await this.createPeerConnection(msg.from, false);
      const pc = this.peers.get(msg.from)!;
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send({ type: "answer", from: this.userId, to: msg.from, payload: answer });
    } else if (msg.type === "answer") {
      const pc = this.peers.get(msg.from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
    } else if (msg.type === "ice") {
      const pc = this.peers.get(msg.from);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
        } catch {
          /* stale candidate, ignore */
        }
      }
    } else if (msg.type === "leave") {
      this.peers.get(msg.from)?.close();
      this.peers.delete(msg.from);
      this.onPeerLeft?.(msg.from);
    }
  }

  private send(msg: SignalMsg) {
    this.channel?.send({ type: "broadcast", event: "signal", payload: msg });
  }
}

/* ────────────────────────────────────────────────────────────────────────
   PURPLE SPEAKING SPECTRUM
──────────────────────────────────────────────────────────────────────── */
function Spectrum({ level, active }: { level: number; active: boolean }) {
  const bars = [0, 1, 2, 3, 4];
  const norm = Math.min(1, level / 130);
  return (
    <div className="flex items-end gap-[3px] h-5">
      {bars.map((i) => {
        const wobble = active ? Math.sin(Date.now() / 120 + i) * 0.15 : 0;
        const h = active ? Math.max(0.15, Math.min(1, norm * (0.6 + 0.4 * Math.sin(i)) + wobble)) : 0.12;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full transition-[height] duration-100"
            style={{
              height: `${Math.max(3, h * 20)}px`,
              background: active
                ? "linear-gradient(180deg, #c084fc, #7c3aed)"
                : "#3f3f46",
            }}
          />
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────────────────────────── */
function displayName(p: Profile | undefined, fallback: string) {
  if (!p) return fallback;
  return p.full_name || p.name || p.display_name || p.email?.split("@")[0] || fallback;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const EMOJIS = ["👍", "🎉", "😂", "❤️", "👏", "🔥", "😮", "✅", "🙌", "💡", "👀", "🤝"];

/* ────────────────────────────────────────────────────────────────────────
   PAGE
──────────────────────────────────────────────────────────────────────── */
export default function HuddlesPage() {
  const [me, setMe] = useState<{ id: string; tenantId: string } | null>(null);
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [activeRoom, setActiveRoom] = useState<VoiceRoom | null>(null);
  const [participants, setParticipants] = useState<VoiceRoomParticipant[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [myMuted, setMyMuted] = useState(true);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<{ duration: number; count: number; reason: string } | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [handQueueOpen, setHandQueueOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const engineRef = useRef<AudioMeshEngine | null>(null);
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const myParticipantIdRef = useRef<string | null>(null);
  const participantsChanRef = useRef<any>(null);
  const roomChanRef = useRef<any>(null);
  const notifyChanRef = useRef<any>(null);

  /* ── Bootstrap: current user + tenant ── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setMe({ id: user.id, tenantId: profile?.tenant_id ?? "" });
      if (profile) setProfiles((p) => ({ ...p, [user.id]: profile }));
    })();
  }, []);

  /* ── Load active rooms list ── */
  const loadRooms = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from("voice_rooms")
      .select("*")
      .eq("tenant_id", me.tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    const roomList = (data as VoiceRoom[]) ?? [];
    setRooms(roomList);
    if (roomList.length > 0) {
      const counts: Record<string, number> = {};
      await Promise.all(roomList.map(async (r) => {
        const { count } = await supabase
          .from("voice_room_participants")
          .select("id", { count: "exact", head: true })
          .eq("room_id", r.id)
          .is("left_at", null);
        counts[r.id] = count ?? 0;
      }));
      setParticipantCounts(counts);
    }
  }, [me]);

  useEffect(() => {
    if (me && !activeRoom) loadRooms();
  }, [me, activeRoom, loadRooms]);

  /* ── Duration ticker while in a room ── */
  useEffect(() => {
    if (!activeRoom) return;
    const start = Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeRoom]);

  /* ── Fetch profiles for any participant we don't have cached ── */
  useEffect(() => {
    const missing = participants.map((p) => p.user_id).filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").in("id", missing);
      if (data) {
        const map: Record<string, Profile> = {};
        data.forEach((p: any) => (map[p.id] = p));
        setProfiles((prev) => ({ ...prev, ...map }));
      }
    })();
  }, [participants, profiles]);

  /* ── Cleanup engine on unmount ── */
  useEffect(() => {
    return () => {
      engineRef.current?.leave();
    };
  }, []);

  /* ── Join a room ── */
  async function joinRoom(room: VoiceRoom) {
    if (!me) return;
    setBusy(true);
    setError("");
    try {
      const { data: existingRows } = await supabase
        .from("voice_room_participants")
        .select("*")
        .eq("room_id", room.id);

      const existing = (existingRows as VoiceRoomParticipant[]) ?? [];
      const existingPeerIds = existing.map((p) => p.user_id);

      const { data: myRow, error: insertErr } = await supabase
        .from("voice_room_participants")
        .insert({
          room_id: room.id,
          tenant_id: me.tenantId,
          user_id: me.id,
          joined_at: new Date().toISOString(),
          hand_raised: false,
          is_muted: true,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      myParticipantIdRef.current = myRow.id;

      const engine = new AudioMeshEngine(room.id, me.id);
      engineRef.current = engine;

      engine.onLocalLevel = (lvl) => setLevels((l) => ({ ...l, [me.id]: lvl }));
      engine.onPeerLevel = (uid, lvl) => setLevels((l) => ({ ...l, [uid]: lvl }));
      engine.onPeerStream = (uid, stream) => {
        let el = audioElsRef.current.get(uid);
        if (!el) {
          el = document.createElement("audio");
          el.autoplay = true;
          document.body.appendChild(el);
          audioElsRef.current.set(uid, el);
        }
        el.srcObject = stream;
      };
      engine.onPeerLeft = (uid) => {
        const el = audioElsRef.current.get(uid);
        el?.remove();
        audioElsRef.current.delete(uid);
      };

      await engine.getLocalStream();
      engine.setMuted(true);
      await engine.join(existingPeerIds);

      setParticipants([...existing, myRow as VoiceRoomParticipant]);
      setActiveRoom(room);
      setMyMuted(true);
      setMyHandRaised(false);
      subscribeRoomChannels(room.id);
    } catch (e: any) {
      setError(e.message ?? "Couldn't join the huddle. Check mic permissions and try again.");
    } finally {
      setBusy(false);
    }
  }

  /* ── Create + join a new room ── */
  async function createRoom() {
    if (!me || !newRoomName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { data: room, error: roomErr } = await supabase
        .from("voice_rooms")
        .insert({
          id,
          tenant_id: me.tenantId,
          name: newRoomName.trim(),
          created_by: me.id,
          is_active: true,
        })
        .select()
        .single();
      if (roomErr) throw roomErr;
      setShowNewRoom(false);
      setNewRoomName("");
      await joinRoom(room as VoiceRoom);
    } catch (e: any) {
      setError(e.message ?? "Couldn't create the huddle.");
      setBusy(false);
    }
  }

  /* ── Realtime: participants + room status ── */
  function subscribeRoomChannels(roomId: string) {
    participantsChanRef.current = supabase
      .channel(`huddle-participants-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voice_room_participants", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any).id;
            if (deletedId === myParticipantIdRef.current) {
              // I was removed by the host
              finishCall({ duration: elapsed, count: participants.length, reason: "removed" });
              return;
            }
            setParticipants((prev) => prev.filter((p) => p.id !== deletedId));
          } else if (payload.eventType === "INSERT") {
            setParticipants((prev) =>
              prev.some((p) => p.id === (payload.new as any).id) ? prev : [...prev, payload.new as VoiceRoomParticipant]
            );
          } else if (payload.eventType === "UPDATE") {
            setParticipants((prev) =>
              prev.map((p) => (p.id === (payload.new as any).id ? (payload.new as VoiceRoomParticipant) : p))
            );
          }
        }
      )
      .subscribe();

    roomChanRef.current = supabase
      .channel(`huddle-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "voice_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as VoiceRoom;
          if (!updated.is_active) {
            finishCall({
              duration: updated.duration_seconds ?? elapsed,
              count: participants.length,
              reason: "ended",
            });
          }
        }
      )
      .subscribe();

    notifyChanRef.current = supabase
      .channel(`huddle-notify-${roomId}`)
      .on("broadcast", { event: "reaction" }, ({ payload }: any) => {
        setReactions((r) => ({ ...r, [payload.userId]: payload.emoji }));
        setTimeout(() => setReactions((r) => {
          const copy = { ...r };
          delete copy[payload.userId];
          return copy;
        }), 1800);
      })
      .on("broadcast", { event: "invite-to-speak" }, ({ payload }: any) => {
        if (payload.userId === me?.id) {
          setMyHandRaised(false);
          window.alert("The host invited you to speak — unmute when ready.");
        }
      })
      .subscribe();
  }

  function teardownChannels() {
    [participantsChanRef, roomChanRef, notifyChanRef].forEach((ref) => {
      if (ref.current) {
        supabase.removeChannel(ref.current);
        ref.current = null;
      }
    });
  }

  /* ── Leave (non-host) ── */
  async function leaveRoom() {
    if (myParticipantIdRef.current) {
      await supabase.from("voice_room_participants").delete().eq("id", myParticipantIdRef.current);
    }
    await finishCall(null, "left");
  }

  /* ── End huddle (host only) ── */
  async function endHuddle() {
    if (!activeRoom || !me) return;
    const duration = elapsed;
    const count = participants.length;

    await supabase
      .from("voice_rooms")
      .update({ is_active: false, ended_at: new Date().toISOString(), duration_seconds: duration })
      .eq("id", activeRoom.id);

    await supabase.from("voice_room_participants").delete().eq("room_id", activeRoom.id);

    await supabase.from("audit_logs").insert({
      tenant_id: me.tenantId,
      user_id: me.id,
      action: "huddle_ended",
      metadata: { room_id: activeRoom.id, room_name: activeRoom.name, duration_seconds: duration, participant_count: count },
    });

    await finishCall({ duration, count, reason: "ended" });
  }

  /* ── Shared cleanup ── */
  async function finishCall(
    explicitSummary: { duration: number; count: number; reason: string } | null,
    reasonOverride?: string
  ) {
    await engineRef.current?.leave();
    engineRef.current = null;
    audioElsRef.current.forEach((el) => el.remove());
    audioElsRef.current.clear();
    teardownChannels();

    const finalSummary =
      explicitSummary ??
      (reasonOverride === "left" ? null : { duration: elapsed, count: participants.length, reason: reasonOverride ?? "ended" });

    setActiveRoom(null);
    setParticipants([]);
    setLevels({});
    setReactions({});
    myParticipantIdRef.current = null;
    if (finalSummary) setSummary(finalSummary);
    loadRooms();
  }

  /* ── Self mute toggle ── */
  function toggleMute() {
    const next = !myMuted;
    setMyMuted(next);
    engineRef.current?.setMuted(next);
    if (myParticipantIdRef.current) {
      supabase.from("voice_room_participants").update({ is_muted: next }).eq("id", myParticipantIdRef.current);
    }
  }

  /* ── Hand raise toggle ── */
  function toggleHand() {
    const next = !myHandRaised;
    setMyHandRaised(next);
    if (myParticipantIdRef.current) {
      supabase.from("voice_room_participants").update({ hand_raised: next }).eq("id", myParticipantIdRef.current);
    }
  }

  /* ── Send a reaction ── */
  function sendReaction(emoji: string) {
    if (!me) return;
    notifyChanRef.current?.send({ type: "broadcast", event: "reaction", payload: { userId: me.id, emoji } });
    setReactions((r) => ({ ...r, [me.id]: emoji }));
    setTimeout(() => setReactions((r) => {
      const copy = { ...r };
      delete copy[me.id];
      return copy;
    }), 1800);
  }

  /* ── Host: invite a raised hand to speak ── */
  function inviteToSpeak(userId: string) {
    notifyChanRef.current?.send({ type: "broadcast", event: "invite-to-speak", payload: { userId } });
    supabase.from("voice_room_participants").update({ hand_raised: false }).eq("room_id", activeRoom!.id).eq("user_id", userId);
  }

  /* ── Host: remove a participant ── */
  async function removeParticipant(participantId: string) {
    await supabase.from("voice_room_participants").delete().eq("id", participantId);
  }

  const isHost = !!(activeRoom && me && activeRoom.created_by === me.id);
  const raisedHands = participants.filter((p) => p.hand_raised);

  /* ────────────────────────────────────────────────────────────────────
     RENDER: SUMMARY MODAL (always on top if present)
  ──────────────────────────────────────────────────────────────────── */
  if (summary) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-400 text-xl">✓</span>
          </div>
          <h2 className="text-white font-semibold text-lg mb-1">
            {summary.reason === "removed" ? "You were removed from the huddle" : "Huddle ended"}
          </h2>
          <p className="text-zinc-400 text-sm mb-6">
            Duration {formatDuration(summary.duration)} · {summary.count} participant{summary.count === 1 ? "" : "s"}
          </p>
          <button
            onClick={() => setSummary(null)}
            className="w-full bg-white hover:bg-zinc-200 text-zinc-900 font-semibold py-2.5 rounded-xl transition text-sm"
          >
            Back to Huddles
          </button>
        </div>
      </div>
    );
  }

  /* ────────────────────────────────────────────────────────────────────
     RENDER: ROOM LIST
  ──────────────────────────────────────────────────────────────────── */
  if (!activeRoom) {
    return (
      <div className="min-h-screen bg-[#0a0812] px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-white text-2xl font-bold tracking-tight">Huddles</h1>
              <p className="text-zinc-500 text-sm mt-1">Quick voice rooms for your team.</p>
            </div>
            <button
              onClick={() => setShowNewRoom(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2.5 rounded-xl transition text-sm"
            >
              New Huddle
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">
              {error}
            </div>
          )}

          {showNewRoom && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 mb-6">
              <p className="text-sm text-zinc-300 mb-3">Name this huddle</p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  placeholder="e.g. Quick sync"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
                />
                <button
                  disabled={busy || !newRoomName.trim()}
                  onClick={createRoom}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl transition text-sm"
                >
                  {busy ? "Starting…" : "Start"}
                </button>
              </div>
            </div>
          )}

          {rooms.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 p-10 text-center text-zinc-500 text-sm">
              No active huddles right now. Start one to get your team talking.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  disabled={busy}
                  onClick={() => joinRoom(room)}
                  className="text-left rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-600 p-5 transition disabled:opacity-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                      <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider">Live</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/25">
                      <span className="text-xs font-bold text-purple-300">{participantCounts[room.id] ?? 0}</span>
                      <div className="flex items-end gap-[2px] h-3">
                        {[0,1,2].map((i) => (
                          <span key={i} className="w-[2px] rounded-full bg-purple-400"
                            style={{ height: (8 + Math.sin(Date.now()/400 + i) * 4) + "px", opacity: 0.7 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-white font-semibold text-base">{room.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{participantCounts[room.id] ?? 0} in call · Tap to join</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ────────────────────────────────────────────────────────────────────
     RENDER: ACTIVE ROOM
  ──────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0a0812] px-6 py-8 flex flex-col">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white font-semibold text-lg">{activeRoom.name}</h1>
            <p className="text-zinc-500 text-sm font-mono mt-0.5">{formatDuration(elapsed)}</p>
          </div>
          <div className="flex items-center gap-3">
            {isHost && raisedHands.length > 0 && (
              <button
                onClick={() => setHandQueueOpen((v) => !v)}
                className="relative rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 transition"
              >
                ✋ {raisedHands.length}
              </button>
            )}
            {isHost ? (
              <button
                onClick={endHuddle}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-xl transition text-sm"
              >
                End Huddle
              </button>
            ) : (
              <button
                onClick={leaveRoom}
                className="border border-zinc-700 hover:border-zinc-500 text-zinc-200 font-medium px-4 py-2 rounded-xl transition text-sm"
              >
                Leave
              </button>
            )}
          </div>
        </div>

        {/* Hand-raise queue (host only) */}
        {isHost && handQueueOpen && raisedHands.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 mb-6 space-y-2">
            {raisedHands.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-200">✋ {displayName(profiles[p.user_id], "Member")}</span>
                <button
                  onClick={() => inviteToSpeak(p.user_id)}
                  className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
                >
                  Invite to speak
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Participant grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 flex-1">
          {participants.map((p) => {
            const profile = profiles[p.user_id];
            const name = displayName(profile, p.user_id === me?.id ? "You" : "Member");
            const level = levels[p.user_id] ?? 0;
            const speaking = level > 18 && !(p.user_id === me?.id ? myMuted : p.is_muted);
            const reaction = reactions[p.user_id];
            return (
              <div key={p.id} className="relative flex flex-col items-center text-center group">
                {reaction && (
                  <span className="absolute -top-2 text-2xl animate-bounce z-10">{reaction}</span>
                )}
                {p.hand_raised && (
                  <span className="absolute top-0 right-6 text-base z-10">✋</span>
                )}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-sm relative"
                  style={{
                    background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                    boxShadow: speaking ? "0 0 0 3px rgba(124,58,237,0.65)" : "0 0 0 1px rgba(124,58,237,0.35)",
                  }}
                >
                  {initials(name)}
                </div>
                <p className="text-white text-sm font-medium mt-2 truncate max-w-full">{name}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Spectrum level={level} active={speaking} />
                  {(p.user_id === me?.id ? myMuted : p.is_muted) && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800/70 px-1.5 py-0.5 rounded-md">Muted</span>
                  )}
                </div>

                {isHost && p.user_id !== me?.id && (
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-red-400 text-xs"
                    title="Remove from huddle"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Control bar */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={toggleMute}
            className={`px-5 py-3 rounded-xl text-sm font-medium transition ${
              myMuted ? "bg-zinc-800 text-zinc-300 border border-zinc-700" : "bg-purple-600 text-white"
            }`}
          >
            {myMuted ? "🔇 Unmute" : "🎙️ Mute"}
          </button>
          <button
            onClick={toggleHand}
            className={`px-5 py-3 rounded-xl text-sm font-medium transition border ${
              myHandRaised ? "bg-white text-zinc-900 border-white" : "border-zinc-700 text-zinc-300"
            }`}
          >
            ✋ {myHandRaised ? "Lower hand" : "Raise hand"}
          </button>
          <div className="relative">
            <details className="group">
              <summary className="list-none cursor-pointer px-5 py-3 rounded-xl text-sm font-medium border border-zinc-700 text-zinc-300">
                😊 React
              </summary>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-xl p-2 grid grid-cols-6 gap-1 w-56 z-20">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => sendReaction(e)}
                    className="text-lg hover:scale-125 transition p-1"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
