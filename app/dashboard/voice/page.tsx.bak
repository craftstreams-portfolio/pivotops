"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FloatingReactions from "@/app/dashboard/components/voice/FloatingReactions";
import { supabase } from "@/lib/supabase";
import { TimeItPanel } from "@/app/dashboard/components/voice/TimeItPanel";

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
  const [showTimeIt, setShowTimeIt] = useState(false);

  // Watches MY OWN participant row for a remote mute (Time It auto-mute, or
  // any future host-mute feature). is_muted on other rows is display-only -
  // it just swaps an icon (see the participant grid render) - nothing was
  // listening for it changing on YOUR OWN row and actually cutting your
  // mic, which is why Time It's DB write silenced everyone's screen but not
  // the speaker's real audio. This makes a remote mute actually mute.
  useEffect(() => {
    if (!me || !myParticipantIdRef.current) return;
    const ch = supabase
      .channel(`self-mute-watch-${myParticipantIdRef.current}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "voice_room_participants",
        filter: `id=eq.${myParticipantIdRef.current}`,
      }, (payload: any) => {
        const remoteMuted = payload.new?.is_muted === true;
        // Only react when the row's value actually differs from what we
        // already believe locally - avoids re-triggering setMuted for our
        // own toggleMute() writes, which already handle the local engine
        // call themselves. Handles both directions: Time It auto-muting on
        // expiry, and a host extension unmuting afterward (spec section 11
        // - an extension after auto-mute must restore speaking permission,
        // which needs the same real local-audio reaction as the mute did).
        if (remoteMuted && !myMutedRef.current) {
          setMyMuted(true);
          myMutedRef.current = true;
          engineRef.current?.setMuted(true);
        } else if (!remoteMuted && myMutedRef.current) {
          setMyMuted(false);
          myMutedRef.current = false;
          engineRef.current?.setMuted(false);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, activeRoom?.id]);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<{ duration: number; count: number; reason: string } | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [handQueueOpen, setHandQueueOpen] = useState(false);
  const [reactionBurst, setReactionBurst] = useState<{ id: string; emoji: string } | null>(null);
  const [roomSpeakers, setRoomSpeakers] = useState<Record<string, string>>({});
  const [newRoomName, setNewRoomName] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const engineRef = useRef<AudioMeshEngine | null>(null);
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const myParticipantIdRef = useRef<string | null>(null);
  const participantsChanRef = useRef<any>(null);
  const speakingChanRef = useRef<any>(null);
  const lastBroadcastRef = useRef<number>(0);
  const myMutedRef = useRef(true);
  const speakingReadyRef = useRef(false);
  const speakerSeenRef = useRef<Record<string, { name: string; at: number }>>({});
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

  // One sweep expires stale speakers, rather than a timer per message.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const live = speakerSeenRef.current;
      let changed = false;
      const next: Record<string, string> = {};
      for (const [roomId, entry] of Object.entries(live)) {
        if (now - entry.at < 2500) next[roomId] = entry.name;
        else { delete live[roomId]; changed = true; }
      }
      setRoomSpeakers((prev) => {
        const prevKeys = Object.keys(prev);
        if (!changed && prevKeys.length === Object.keys(next).length &&
            prevKeys.every((k) => prev[k] === next[k])) return prev;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  /* ── Safety net: reconcile on a timer and when the tab regains focus.
     Realtime can silently drop events on flaky networks or after sleep; without
     this a stale roster persists for the whole call. */
  useEffect(() => {
    if (!activeRoom) return;
    const id = activeRoom.id;
    const timer = window.setInterval(() => refreshParticipants(id), 15000);
    const onFocus = () => refreshParticipants(id);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.id]);

  /* ── Authoritative participant refresh ──
     Patching local state from individual realtime events is fragile: one dropped
     or out-of-order event and the roster stays wrong until you rejoin. We re-read
     the room from the database on any change and dedupe by user_id, so the list
     self-heals regardless of what the socket missed. */
  const refreshingRef = useRef(false);
  const refreshParticipants = useCallback(async (roomId: string) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const { data, error } = await supabase
        .from("voice_room_participants")
        .select("*")
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true });
      if (error) { console.error("[huddle] refresh failed:", error.message); return; }

      const seen = new Set<string>();
      const rows = ((data as VoiceRoomParticipant[]) ?? []).filter((p) => {
        if (seen.has(p.user_id)) return false;
        seen.add(p.user_id);
        return true;
      });
      console.log("[huddle] roster:", rows.length, rows.map((r) => r.user_id));
      setParticipants(rows);
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  /* ── Live "who's speaking" across the tenant ──
     Speaking level only exists inside the audio mesh, so people in the lobby
     can't compute it. In-call clients broadcast it instead — no DB writes. */
  useEffect(() => {
    if (!me) return;
    const chan = supabase
      .channel(`huddle-speaking-${me.tenantId}`)
      .on("broadcast", { event: "speaking" }, ({ payload }: any) => {
        if (!payload?.roomId || !payload?.name) return;
        // Record when we last heard from this room. A per-message delete timer
        // expired the entry even while newer broadcasts kept arriving, so the
        // label flickered off almost as fast as it appeared.
        speakerSeenRef.current[payload.roomId] = { name: payload.name, at: Date.now() };
        setRoomSpeakers((s) =>
          s[payload.roomId] === payload.name ? s : { ...s, [payload.roomId]: payload.name }
        );
      })
      .subscribe((status: string) => {
        // Sending before the socket has joined makes supabase-js fall back to
        // REST, which subscribers don't reliably receive. Gate on SUBSCRIBED.
        speakingReadyRef.current = status === "SUBSCRIBED";
        console.log("[huddle] speaking channel:", status);
      });
    speakingChanRef.current = chan;
    return () => {
      speakingReadyRef.current = false;
      supabase.removeChannel(chan);
      speakingChanRef.current = null;
    };
  }, [me?.tenantId]);

  // Broadcast my own speaking on a timer. A render-driven effect missed most
  // level updates (and the throttle swallowed the rest), so the lobby never
  // heard anything. A ref keeps the newest level without re-running the effect.
  const levelsRef = useRef<Record<string, number>>({});
  useEffect(() => { levelsRef.current = levels; }, [levels]);

  useEffect(() => {
    if (!me || !activeRoom) return;
    const timer = window.setInterval(() => {
      if (myMutedRef.current) return;
      const level = levelsRef.current[me.id] ?? 0;
      if (level <= 8) return;
      const chan = speakingChanRef.current;
      if (!chan || !speakingReadyRef.current) return;
      chan.send({
        type: "broadcast",
        event: "speaking",
        payload: {
          roomId: activeRoom.id,
          name:   displayName(profiles[me.id], "Someone"),
        },
      });
      console.log("[huddle] broadcast speaking", { room: activeRoom.id, level });
    }, 900);
    return () => window.clearInterval(timer);
  }, [me, activeRoom, profiles]);

  /* ── Announce a new huddle in #general ── */
  async function announceHuddle(room: VoiceRoom) {
    if (!me) return;
    const { data: general } = await supabase
      .from("channels")
      .select("id")
      .eq("tenant_id", me.tenantId)
      .eq("name", "general")
      .maybeSingle();
    if (!general?.id) return;

    const myName = displayName(profiles[me.id], "A teammate");
    const text = `🎙️ ${myName} started a huddle: "${room.name}" — join in.`;

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        channel_id: general.id,
        tenant_id:  me.tenantId,
        user_id:    me.id,
        user_name:  myName,
        content:    text,
        type:       "text",
        priority:   "normal",
        reactions:  {},
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Route it like any other message so people in a meeting get it queued
    // rather than interrupted.
    fetch("/api/teams/route-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId:  msg?.id ?? null,
        channelId:  general.id,
        senderId:   me.id,
        tenantId:   me.tenantId,
        content:    text,
        senderName: myName,
      }),
    }).catch(() => {});
  }

  /* ── Join a room ── */
  async function joinRoom(room: VoiceRoom) {
    if (!me) return;
    setBusy(true);
    setError("");
    try {
      // Clear any row this user already holds in the room. Without this a
      // refresh or reconnect leaves a second live row, so the person renders
      // twice for everyone — the bug this replaces.
      await supabase
        .from("voice_room_participants")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", me.id);

      const { data: existingRows } = await supabase
        .from("voice_room_participants")
        .select("*")
        .eq("room_id", room.id);

      // Defensive: one entry per person even if legacy duplicates survive.
      const seen = new Set<string>();
      const existing = ((existingRows as VoiceRoomParticipant[]) ?? []).filter((p) => {
        if (p.user_id === me.id || seen.has(p.user_id)) return false;
        seen.add(p.user_id);
        return true;
      });
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
      // The participant row is written before the mic is requested, so a failure
      // here (mic busy, permission denied) would otherwise leave a ghost in the
      // roster — someone everyone can see who was never actually in the call.
      if (myParticipantIdRef.current) {
        await supabase
          .from("voice_room_participants")
          .delete()
          .eq("id", myParticipantIdRef.current)
          .then(() => {}, () => {});
        myParticipantIdRef.current = null;
      }
      try { engineRef.current?.leave?.(); } catch {}
      engineRef.current = null;
      setParticipants([]);
      setActiveRoom(null);
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

      // Tell the team in #general. Fire-and-forget — a failed announcement must
      // never stop the huddle starting.
      announceHuddle(room as VoiceRoom).catch(() => {});

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
          if (payload.eventType === "DELETE" && (payload.old as any).id === myParticipantIdRef.current) {
            finishCall({ duration: elapsed, count: participants.length, reason: "removed" });
            return;
          }
          if (payload.eventType === "UPDATE") {
            // Patch in place so hand-raise and mute stay instant.
            setParticipants((prev) =>
              prev.map((p) => (p.id === (payload.new as any).id ? (payload.new as VoiceRoomParticipant) : p))
            );
            return;
          }
          // Joins and leaves re-read the roster rather than guessing at it.
          refreshParticipants(roomId);
        }
      )
      .subscribe((status: string) => {
        console.log("[huddle] participants channel:", status);
        // On (re)connect, reconcile immediately — we may have missed events while down.
        if (status === "SUBSCRIBED") refreshParticipants(roomId);
      });

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
        setReactionBurst({ id: `${Date.now()}-${Math.random()}`, emoji: payload.emoji });
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
    myMutedRef.current = next;
    engineRef.current?.setMuted(next);
    if (myParticipantIdRef.current) {
      supabase.from("voice_room_participants").update({ is_muted: next }).eq("id", myParticipantIdRef.current);
    }
  }

  /* ── Hand raise toggle ── */
  async function toggleHand() {
    const next = !myHandRaised;
    setMyHandRaised(next);

    // Update my own tile immediately. The grid renders from `participants`, so
    // without this my hand only appeared once the realtime echo came back —
    // which read as the feature not working at all.
    if (me) {
      setParticipants((prev) =>
        prev.map((p) => (p.user_id === me.id ? { ...p, hand_raised: next } : p))
      );
    }

    if (myParticipantIdRef.current) {
      const { error } = await supabase
        .from("voice_room_participants")
        .update({ hand_raised: next })
        .eq("id", myParticipantIdRef.current);

      // Roll back rather than leave a hand nobody else can see.
      if (error) {
        console.error("[huddle] hand raise failed:", error.message);
        setMyHandRaised(!next);
        if (me) {
          setParticipants((prev) =>
            prev.map((p) => (p.user_id === me.id ? { ...p, hand_raised: !next } : p))
          );
        }
      }
    }
  }

  /* ── Send a reaction ── */
  function sendReaction(emoji: string) {
    if (!me) return;
    notifyChanRef.current?.send({ type: "broadcast", event: "reaction", payload: { userId: me.id, emoji } });
    setReactions((r) => ({ ...r, [me.id]: emoji }));
    setReactionBurst({ id: `${Date.now()}-${Math.random()}`, emoji });
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
      <div className="relative min-h-screen bg-[#08060f] px-6 py-10 overflow-hidden">
        <style>{`@keyframes pv-bar { from { transform: scaleY(0.45); } to { transform: scaleY(1.25); } } @keyframes pv-pop { 0% { transform: scale(0) rotate(-15deg); opacity: 0; } 60% { transform: scale(1.25) rotate(6deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }`}</style>
        {/* Ambient depth — a room you're waiting outside of */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full opacity-[0.13] blur-[110px]"
               style={{ background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)" }} />
          <div className="absolute top-1/3 -right-32 w-[420px] h-[420px] rounded-full opacity-[0.10] blur-[120px]"
               style={{ background: "radial-gradient(circle, #00BFA6 0%, transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.35]"
               style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div className="flex items-end justify-between mb-9">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-purple-400/70 mb-2">
                Live rooms
              </p>
              <h1 className="text-white text-[27px] font-bold tracking-tight leading-none">Huddles</h1>
              <p className="text-zinc-500 text-sm mt-2">Drop in. No links, no scheduling.</p>
            </div>
            <button
              onClick={() => setShowNewRoom(true)}
              className="group relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-semibold text-white
                         transition-all duration-200 hover:-translate-y-[1px]"
              style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", boxShadow: "0 6px 20px rgba(124,58,237,0.35)" }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                New Huddle
              </span>
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ background: "linear-gradient(135deg,#8B5CF6,#6D28D9)" }} />
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
            <div className="relative rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm
                            p-14 text-center overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px"
                   style={{ background: "linear-gradient(90deg,transparent,rgba(124,58,237,0.5),transparent)" }} />
              <div className="relative mx-auto mb-5 w-14 h-14 rounded-2xl flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.18),rgba(124,58,237,0.05))",
                            border: "1px solid rgba(124,58,237,0.25)" }}>
                <span className="text-xl">🎙️</span>
                <span className="absolute inset-0 rounded-2xl animate-ping opacity-20"
                      style={{ background: "rgba(124,58,237,0.4)", animationDuration: "3s" }} />
              </div>
              <p className="text-zinc-300 text-sm font-medium">The room is quiet</p>
              <p className="text-zinc-600 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
                Start a huddle and your team gets a nudge in #general. No invites to send.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  disabled={busy}
                  onClick={() => joinRoom(room)}
                  className="group relative text-left rounded-2xl p-[1px] transition-all duration-200
                             hover:-translate-y-[2px] disabled:opacity-50 disabled:translate-y-0"
                  style={{
                    background: roomSpeakers[room.id]
                      ? "linear-gradient(135deg,rgba(124,58,237,0.55),rgba(124,58,237,0.12))"
                      : "linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))",
                  }}
                >
                  <div className="relative rounded-[15px] bg-[#0d0a17]/95 backdrop-blur-sm p-5 overflow-hidden h-full">
                    {/* speaking wash */}
                    {roomSpeakers[room.id] && (
                      <div className="pointer-events-none absolute -top-16 -right-10 w-40 h-40 rounded-full opacity-25 blur-3xl"
                           style={{ background: "radial-gradient(circle,#7C3AED,transparent 70%)" }} />
                    )}

                    <div className="relative flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2">
                        <span className="relative flex w-2 h-2">
                          <span className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-70" />
                          <span className="relative w-2 h-2 rounded-full bg-purple-400" />
                        </span>
                        <span className="text-[10px] text-purple-300 font-bold uppercase tracking-[0.16em]">Live</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                           style={{ background: "rgba(124,58,237,0.14)", border: "1px solid rgba(124,58,237,0.28)" }}>
                        <span className="text-[11px] font-bold text-purple-200 tabular-nums">
                          {participantCounts[room.id] ?? 0}
                        </span>
                        <span className="text-[9px] text-purple-300/70 uppercase tracking-wider">in</span>
                      </div>
                    </div>

                    <h3 className="relative text-white font-semibold text-[17px] tracking-tight truncate">
                      {room.name}
                    </h3>

                    <div className="relative mt-2 h-5 flex items-center">
                      {roomSpeakers[room.id] ? (
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="flex items-end gap-[2px] h-3.5 flex-shrink-0">
                            {[0,1,2,3].map((i) => (
                              <span key={i} className="w-[2.5px] rounded-full bg-purple-400"
                                style={{
                                  height: `${5 + (i % 2 ? 8 : 4)}px`,
                                  animation: `pv-bar 900ms ease-in-out ${i * 110}ms infinite alternate`,
                                }} />
                            ))}
                          </span>
                          <span className="text-xs text-purple-200 font-medium truncate">
                            {roomSpeakers[room.id]} is speaking
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {(participantCounts[room.id] ?? 0) === 0 ? "Empty room" : "Quiet right now"}
                        </span>
                      )}
                    </div>

                    {/* join affordance */}
                    <div className="relative mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                        {busy ? "Connecting…" : "Tap to join"}
                      </span>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200
                                       group-hover:translate-x-0.5"
                            style={{ background: "rgba(124,58,237,0.16)", border: "1px solid rgba(124,58,237,0.3)" }}>
                        <span className="text-purple-300 text-xs leading-none">→</span>
                      </span>
                    </div>
                  </div>
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
    <div className="relative h-[calc(100vh-6rem)] bg-[#08060f] px-6 py-8 flex flex-col overflow-hidden">
      <style>{`@keyframes pv-bar { from { transform: scaleY(0.45); } to { transform: scaleY(1.25); } } @keyframes pv-pop { 0% { transform: scale(0) rotate(-15deg); opacity: 0; } 60% { transform: scale(1.25) rotate(6deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }`}</style>

      {/* Ambient depth */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 left-1/3 w-[480px] h-[480px] rounded-full opacity-[0.12] blur-[110px]"
             style={{ background: "radial-gradient(circle,#7C3AED 0%,transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.3]"
             style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
      </div>

      <FloatingReactions trigger={reactionBurst} />

      <div className="relative max-w-3xl w-full mx-auto flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-7 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-70" />
                <span className="relative w-2 h-2 rounded-full bg-purple-400" />
              </span>
              <span className="text-[10px] text-purple-300 font-bold uppercase tracking-[0.18em]">Live</span>
              <span className="text-zinc-700">·</span>
              <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{formatDuration(elapsed)}</span>
            </div>
            <h1 className="text-white font-bold text-xl tracking-tight truncate">{activeRoom.name}</h1>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            {isHost && raisedHands.length > 0 && (
              <button
                onClick={() => setHandQueueOpen((v) => !v)}
                className="relative rounded-xl px-3 py-2 text-sm font-medium transition-all hover:-translate-y-[1px]"
                style={{ background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.35)", color: "#FCD34D" }}
              >
                ✋ {raisedHands.length}
              </button>
            )}
            {isHost ? (
              <button
                onClick={endHuddle}
                className="text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all hover:-translate-y-[1px]"
                style={{ background: "linear-gradient(135deg,#DC2626,#B91C1C)", boxShadow: "0 4px 16px rgba(220,38,38,0.3)" }}
              >
                End Huddle
              </button>
            ) : (
              <button
                onClick={leaveRoom}
                className="border border-white/[0.12] hover:border-white/25 hover:bg-white/[0.04]
                           text-zinc-200 font-medium px-4 py-2 rounded-xl transition text-sm"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 flex-1 min-h-0 overflow-y-auto content-start pt-3 pb-4 px-1">
          {participants.map((p) => {
            const profile = profiles[p.user_id];
            const name = displayName(profile, p.user_id === me?.id ? "You" : "Member");
            const level = levels[p.user_id] ?? 0;
            const speaking = level > 18 && !(p.user_id === me?.id ? myMuted : p.is_muted);
            const reaction = reactions[p.user_id];
            return (
              <div
                key={p.id}
                className="relative flex flex-col items-center text-center group rounded-2xl p-4
                           transition-all duration-200"
                style={{
                  background: speaking ? "rgba(124,58,237,0.10)" : "rgba(255,255,255,0.02)",
                  border: speaking ? "1px solid rgba(124,58,237,0.45)" : "1px solid rgba(255,255,255,0.05)",
                  boxShadow: speaking ? "0 0 28px rgba(124,58,237,0.18)" : "none",
                }}
              >
                {reaction && (
                  <span className="absolute -top-3 right-3 text-2xl z-10"
                        style={{ animation: "pv-pop 420ms cubic-bezier(.34,1.56,.64,1)" }}>
                    {reaction}
                  </span>
                )}
                {/* Avatar + hand badge share a wrapper so the badge anchors to the
                    avatar, not the grid cell — otherwise it drifts and clips. */}
                <div className="relative">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{
                      background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                      boxShadow: p.hand_raised
                        ? "0 0 0 2px #F59E0B"
                        : speaking
                          ? "0 0 0 3px rgba(124,58,237,0.65)"
                          : "0 0 0 1px rgba(124,58,237,0.35)",
                    }}
                  >
                    {initials(name)}
                  </div>
                  {p.hand_raised && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 z-20 w-6 h-6 rounded-full
                                 flex items-center justify-center text-[12px] leading-none select-none"
                      style={{
                        background: "#F59E0B",
                        border: "2px solid #0a0812",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.55)",
                      }}
                      title="Hand raised"
                    >
                      ✋
                    </span>
                  )}
                </div>
                <p className="text-white text-[13px] font-semibold mt-3 truncate max-w-full tracking-tight">
                  {name}
                </p>
                <div className="mt-2 flex items-center gap-2 h-4">
                  {(p.user_id === me?.id ? myMuted : p.is_muted) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                      <span className="text-[11px] leading-none">🔇</span> Muted
                    </span>
                  ) : (
                    <Spectrum level={level} active={speaking} />
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

        {/* Control bar — pinned so a full participant grid can't push it off-screen */}
        <div className="mt-6 flex-shrink-0 sticky bottom-0 flex items-center justify-center gap-3
                        py-5 bg-[#08060f]/90 backdrop-blur-xl border-t border-white/[0.06] gap-8">
          <button
            onClick={toggleMute}
            title={myMuted ? "Unmute" : "Mute"}
            className="group flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-[2px]"
          >
            <span className="w-13 h-13 rounded-full flex items-center justify-center text-lg transition-all"
                  style={{
                    width: 52, height: 52,
                    background: myMuted ? "rgba(220,38,38,0.16)" : "rgba(124,58,237,0.18)",
                    border: myMuted ? "1px solid rgba(220,38,38,0.45)" : "1px solid rgba(124,58,237,0.45)",
                  }}>
              {myMuted ? "🔇" : "🎙️"}
            </span>
            <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
              {myMuted ? "Unmute" : "Mute"}
            </span>
          </button>

          <button
            onClick={toggleHand}
            title={myHandRaised ? "Lower hand" : "Raise hand"}
            className="group flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-[2px]"
          >
            <span className="rounded-full flex items-center justify-center text-lg transition-all"
                  style={{
                    width: 52, height: 52,
                    background: myHandRaised ? "rgba(245,158,11,0.9)" : "rgba(255,255,255,0.05)",
                    border: myHandRaised ? "1px solid #F59E0B" : "1px solid rgba(255,255,255,0.12)",
                  }}>
              ✋
            </span>
            <span className="text-[10px] transition-colors"
                  style={{ color: myHandRaised ? "#FCD34D" : undefined }}>
              <span className={myHandRaised ? "" : "text-zinc-500 group-hover:text-zinc-300"}>
                {myHandRaised ? "Lower" : "Raise"}
              </span>
            </span>
          </button>
          <button
            onClick={() => setShowTimeIt((v) => !v)}
            title="Time It"
            className="group flex flex-col items-center gap-1.5 transition-transform hover:-translate-y-[2px]"
          >
            <span className="rounded-full flex items-center justify-center text-lg transition-all"
                  style={{
                    width: 52, height: 52,
                    background: showTimeIt ? "rgba(0,191,166,0.18)" : "rgba(255,255,255,0.05)",
                    border: showTimeIt ? "1px solid rgba(0,191,166,0.5)" : "1px solid rgba(255,255,255,0.12)",
                  }}>
              ⏱️
            </span>
            <span className="text-[10px] transition-colors"
                  style={{ color: showTimeIt ? "#00BFA6" : undefined }}>
              <span className={showTimeIt ? "" : "text-zinc-500 group-hover:text-zinc-300"}>Time It</span>
            </span>
          </button>

          <div className="relative">
            <details className="group">
              <summary className="list-none cursor-pointer flex flex-col items-center gap-1.5
                                  transition-transform hover:-translate-y-[2px]">
                <span className="rounded-full flex items-center justify-center text-lg"
                      style={{ width: 52, height: 52, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  😊
                </span>
                <span className="text-[10px] text-zinc-500">React</span>
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

      {showTimeIt && activeRoom && (
        <TimeItPanel
          roomId={activeRoom.id}
          isHost={isHost}
          participants={participants.map((p) => ({ user_id: p.user_id, full_name: displayName(profiles[p.user_id], "Participant"), email: profiles[p.user_id]?.email }))}
          onClose={() => setShowTimeIt(false)}
        />
      )}
    </div>
  );
}
