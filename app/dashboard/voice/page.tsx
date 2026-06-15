"use client";
import { safeGetUserMedia } from "@/lib/media/safeGetUserMedia";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import {
  Mic, MicOff, PhoneOff, Plus, Users,
  Volume2, VolumeX, Radio, Crown, X,
  Loader2, Share2, ChevronDown, Smile,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface VoiceRoom {
  id:         string;
  name:       string;
  created_by: string;
  department: string | null;
  created_at: string;
  is_active:  boolean;
  tenant_id:  string | null;
}

interface RoomParticipant {
  id:        string;
  room_id:   string;
  user_id:   string;
  joined_at: string;
  left_at:   string | null;
  tenant_id: string | null;
  // enriched client-side
  name?:       string;
  role?:       "host" | "speaker" | "listener";
  isMuted?:    boolean;
  audioLevel?: number;
  hasHand?:    boolean;
  reactions?:  string[];
}

// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
const EMOJI_LIST = ["👍","👎","❤️","😂","😮","🎉","🔥","✅","👏","🚀","💯","😎"];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function getInitials(name: string) {
  const p = name.trim().split(" ");
  return p.length >= 2
    ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
    : (name[0]?.toUpperCase() ?? "?");
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ─────────────────────────────────────────
// AUDIO SPECTRUM — animated bars
// ─────────────────────────────────────────
function AudioSpectrum({
  level,
  color  = "#a855f7",
  bars   = 16,
  height = 32,
}: {
  level:   number;
  color?:  string;
  bars?:   number;
  height?: number;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(id);
  }, []);

  const barHeights = Array.from({ length: bars }, (_, i) => {
    const center = bars / 2;
    const dist   = Math.abs(i - center) / center;
    const base   = (1 - dist * 0.5) * (level / 100);
    const wave   = Math.sin(tick * 0.3 + i * 0.6) * 0.25 * base;
    return Math.max(0.05, Math.min(1, base + wave));
  });

  return (
    <div className="flex items-center justify-center gap-[2px]" style={{ height }}>
      {barHeights.map((h, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-75"
          style={{
            width:           "2.5px",
            height:          `${Math.round(h * height)}px`,
            backgroundColor: color,
            opacity:         0.4 + h * 0.6,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// PARTICIPANT BUBBLE
// ─────────────────────────────────────────
function ParticipantBubble({
  participant,
  isSpeaking,
  isLocal,
  canPromote,
  onPromote,
  onMute,
  onRemove,
  onReact,
}: {
  participant: RoomParticipant;
  isSpeaking:  boolean;
  isLocal:     boolean;
  canPromote:  boolean;
  onPromote:   () => void;
  onMute:      () => void;
  onRemove:    () => void;
  onReact:     (emoji: string) => void;
}) {
  const [showMenu,  setShowMenu]  = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const name = participant.name ?? participant.user_id;

  const ringColor = participant.role === "host"   ? "ring-amber-400"  :
                    participant.role === "speaker" ? "ring-indigo-500" :
                                                     "ring-zinc-700";

  const bgColor   = participant.role === "host"   ? "bg-amber-500/20 text-amber-300"   :
                    participant.role === "speaker" ? "bg-indigo-500/20 text-indigo-300" :
                                                     "bg-zinc-800 text-zinc-400";

  return (
    <div className="flex flex-col items-center gap-2 relative">
      {/* Floating reactions */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
        {(participant.reactions ?? []).slice(-3).map((emoji, i) => (
          <span key={i} className="text-xl animate-bounce">{emoji}</span>
        ))}
      </div>

      {/* Avatar */}
      <div
        className={`relative w-16 h-16 rounded-full flex items-center justify-center
                    text-sm font-bold cursor-pointer transition-all select-none
                    ${bgColor}
                    ${isSpeaking
                      ? `ring-2 ${ringColor} shadow-lg shadow-indigo-500/20`
                      : `ring-1 ${ringColor}`
                    }`}
        onClick={() => {
          if (canPromote) setShowMenu(!showMenu);
        }}
      >
        {getInitials(name)}

        {/* Speaking spectrum overlay */}
        {isSpeaking && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <AudioSpectrum
              level={participant.audioLevel ?? 0}
              color={participant.role === "host" ? "#f59e0b" : "#6366f1"}
              bars={10}
              height={16}
            />
          </div>
        )}

        {/* Role badge */}
        {participant.role === "host" && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full
                          bg-amber-500 flex items-center justify-center">
            <Crown size={9} className="text-white" />
          </div>
        )}

        {/* Muted */}
        {participant.isMuted && participant.role !== "listener" && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full
                          bg-red-500 flex items-center justify-center">
            <MicOff size={9} className="text-white" />
          </div>
        )}

        {/* Hand raised */}
        {participant.hasHand && (
          <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full
                          bg-emerald-500 flex items-center justify-center text-xs">
            ✋
          </div>
        )}
      </div>

      <p className="text-[10px] text-zinc-400 max-w-[64px] truncate text-center">
        {isLocal ? "You" : name.split(" ")[0]}
      </p>

      {/* Emoji react button (always visible for self) */}
      <div className="relative">
        <button
          onClick={() => setShowEmoji(!showEmoji)}
          className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700
                     flex items-center justify-center transition"
        >
          <Smile size={11} className="text-zinc-500" />
        </button>
        {showEmoji && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50
                          bg-zinc-900 border border-zinc-700 rounded-2xl p-2
                          grid grid-cols-6 gap-1 shadow-2xl w-max">
            {EMOJI_LIST.map((e) => (
              <button
                key={e}
                onClick={() => { onReact(e); setShowEmoji(false); }}
                className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center
                           justify-center text-base transition"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Host context menu */}
      {showMenu && canPromote && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50
                        bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl
                        overflow-hidden w-44">
          <button
            onClick={() => { onPromote(); setShowMenu(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-300
                       hover:bg-zinc-800 transition text-left"
          >
            <Mic size={12} className="text-indigo-400" /> Make Speaker
          </button>
          <button
            onClick={() => { onMute(); setShowMenu(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-300
                       hover:bg-zinc-800 transition text-left"
          >
            <VolumeX size={12} className="text-amber-400" /> Mute
          </button>
          <button
            onClick={() => { onRemove(); setShowMenu(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400
                       hover:bg-zinc-800 transition text-left border-t border-zinc-800"
          >
            <X size={12} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function HuddlesPage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [currentUser,      setCurrentUser]      = useState<any>(null);
  const [rooms,            setRooms]            = useState<VoiceRoom[]>([]);
  const [activeRoom,       setActiveRoom]        = useState<VoiceRoom | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<RoomParticipant[]>([]);
  const [isMuted,          setIsMuted]          = useState(false);
  const [handRaised,       setHandRaised]       = useState(false);
  const [audioLevels,      setAudioLevels]      = useState<Record<string, number>>({});
  const [loading,          setLoading]          = useState(false);
  const [showCreate,       setShowCreate]       = useState(false);
  const [newRoomName,      setNewRoomName]      = useState("");
  const [elapsed,          setElapsed]          = useState(0);
  const [showEmojiBar,     setShowEmojiBar]     = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const rafRef         = useRef<number>(0);
  const timerRef       = useRef<NodeJS.Timeout | null>(null);
  const startRef       = useRef<Date | null>(null);

  const isHost = activeRoom?.created_by === currentUser?.id;

  // ── Load user ──────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles").select("*").eq("id", session.user.id).single();
      setCurrentUser(data ?? {
        id:        session.user.id,
        full_name: session.user.email?.split("@")[0] ?? null,
        email:     session.user.email ?? null,
      });
    };
    load();
  }, []);

  // ── Load rooms ─────────────────────────
  const loadRooms = useCallback(async () => {
    if (tenantLoading) return;
    const { data, error } = await supabase
      .from("voice_rooms")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (!error) setRooms((data ?? []) as VoiceRoom[]);
  }, [tenantLoading]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // ── Realtime room updates ──────────────
  useEffect(() => {
    const ch = supabase
      .channel("huddles-rooms")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "voice_rooms" },
        () => loadRooms()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadRooms]);

  // ── Realtime participant updates ───────
  useEffect(() => {
    if (!activeRoom) return;
    const ch = supabase
      .channel(`huddles-participants-${activeRoom.id}`)
      .on("postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "voice_room_participants",
          filter: `room_id=eq.${activeRoom.id}`,
        },
        () => loadRoomParticipants(activeRoom.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeRoom]);

  // ── Timer ──────────────────────────────
  useEffect(() => {
    if (activeRoom) {
      startRef.current = new Date();
      timerRef.current = setInterval(() => {
        if (startRef.current)
          setElapsed(Math.floor((Date.now() - startRef.current.getTime()) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeRoom]);

  function formatElapsed(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  // ── Start audio capture + level detection ──
  const startAudio = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation:  true,
          noiseSuppression:  true,
          autoGainControl:   true,
          sampleRate:        48000,
        },
        video: false,
      });
      localStreamRef.current = stream;

      // AudioContext for level detection
      audioCtxRef.current = new AudioContext();
      const source   = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevels((prev) => ({
          ...prev,
          [currentUser?.id ?? ""]: Math.round(avg),
        }));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return stream;
    } catch (err) {
      setError("Microphone access denied. Please allow microphone permissions.");
      return null;
    }
  }, [currentUser]);

  // ── Stop audio ─────────────────────────
  const stopAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current  = null;
    analyserRef.current  = null;
  }, []);

  // ── Create room ────────────────────────
  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !currentUser) return;
    setError(null);

    // voice_rooms.id is TEXT — use a short readable ID
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

    const { data, error } = await supabase
      .from("voice_rooms")
      .insert({
        id:         roomId,
        name:       newRoomName.trim(),
        created_by: currentUser.id,
        is_active:  true,
        tenant_id:  tenantId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      setError(`Failed to create room: ${error.message}`);
      return;
    }

    setShowCreate(false);
    setNewRoomName("");
    if (data) await handleJoinRoom(data as VoiceRoom);
  };

  // ── Join room ──────────────────────────
  const handleJoinRoom = async (room: VoiceRoom) => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);

    const stream = await startAudio();
    if (!stream) { setLoading(false); return; }

    // Insert participant — room_id is TEXT
    const { error: insertError } = await supabase
      .from("voice_room_participants")
      .insert({
        room_id:   room.id,
        user_id:   currentUser.id,
        joined_at: new Date().toISOString(),
        tenant_id: tenantId,
      });

    if (insertError) {
      setError(`Failed to join room: ${insertError.message}`);
      stopAudio();
      setLoading(false);
      return;
    }

    setActiveRoom(room);
    await loadRoomParticipants(room.id);
    setLoading(false);
  };

  // ── Load participants + enrich ─────────
  const loadRoomParticipants = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("voice_room_participants")
      .select("*")
      .eq("room_id", roomId)
      .is("left_at", null);

    if (!data) return;

    const userIds = [...new Set(data.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap: Record<string, string> = {};
    (profiles ?? []).forEach((p) => {
      profileMap[p.id] = (p.full_name ?? p.email ?? p.id) as string;
    });

    // Preserve existing client-side state (reactions, hand, muted)
    setRoomParticipants((prev) => {
      const prevMap: Record<string, RoomParticipant> = {};
      prev.forEach((p) => { prevMap[p.user_id] = p; });

      return data.map((p) => ({
        ...p,
        name:       profileMap[p.user_id] ?? p.user_id,
        role:       (p.user_id === activeRoom?.created_by ? "host" : "speaker") as "host" | "speaker" | "listener",
        isMuted:    prevMap[p.user_id]?.isMuted    ?? false,
        audioLevel: prevMap[p.user_id]?.audioLevel ?? 0,
        hasHand:    prevMap[p.user_id]?.hasHand    ?? false,
        reactions:  prevMap[p.user_id]?.reactions  ?? [],
      }));
    });
  }, [activeRoom]);

  // ── Leave room ─────────────────────────
  const handleLeave = async () => {
    if (!activeRoom || !currentUser) return;

    await supabase
      .from("voice_room_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("room_id", activeRoom.id)
      .eq("user_id", currentUser.id);

    if (isHost) {
      await supabase
        .from("voice_rooms")
        .update({ is_active: false })
        .eq("id", activeRoom.id);
    }

    stopAudio();
    setActiveRoom(null);
    setRoomParticipants([]);
    setElapsed(0);
    setHandRaised(false);
    setAudioLevels({});
    loadRooms();
  };

  // ── Toggle mute ────────────────────────
  const handleToggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks();
    tracks?.forEach((t) => { t.enabled = isMuted; }); // flip: if was muted, enable
    setIsMuted((m) => !m);
    setRoomParticipants((prev) =>
      prev.map((p) =>
        p.user_id === currentUser?.id ? { ...p, isMuted: !isMuted } : p
      )
    );
  };

  // ── Raise hand ─────────────────────────
  const handleRaiseHand = () => {
    setHandRaised((h) => !h);
    setRoomParticipants((prev) =>
      prev.map((p) =>
        p.user_id === currentUser?.id ? { ...p, hasHand: !handRaised } : p
      )
    );
  };

  // ── React with emoji ───────────────────
  const handleReact = (userId: string, emoji: string) => {
    setRoomParticipants((prev) =>
      prev.map((p) =>
        p.user_id === userId
          ? { ...p, reactions: [...(p.reactions ?? []).slice(-4), emoji] }
          : p
      )
    );
    setTimeout(() => {
      setRoomParticipants((prev) =>
        prev.map((p) =>
          p.user_id === userId
            ? { ...p, reactions: [] }
            : p
        )
      );
    }, 3000);
  };

  // ── Promote to speaker ─────────────────
  const handlePromote = (userId: string) => {
    setRoomParticipants((prev) =>
      prev.map((p) => p.user_id === userId ? { ...p, role: "speaker" } : p)
    );
  };

  // ── Mute participant (host) ────────────
  const handleMuteParticipant = (userId: string) => {
    setRoomParticipants((prev) =>
      prev.map((p) => p.user_id === userId ? { ...p, isMuted: true } : p)
    );
  };

  // ── Remove participant (host) ──────────
  const handleRemoveParticipant = async (userId: string) => {
    await supabase
      .from("voice_room_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("room_id", activeRoom?.id ?? "")
      .eq("user_id", userId);
    setRoomParticipants((prev) => prev.filter((p) => p.user_id !== userId));
  };

  // ── Sync audio levels to participants ──
  useEffect(() => {
    setRoomParticipants((prev) =>
      prev.map((p) => ({
        ...p,
        audioLevel: audioLevels[p.user_id] ?? p.audioLevel ?? 0,
      }))
    );
  }, [audioLevels]);

  const speakers  = roomParticipants.filter((p) => p.role === "host" || p.role === "speaker");
  const listeners = roomParticipants.filter((p) => p.role === "listener");

  const activeSpeakerId = Object.entries(audioLevels)
    .filter(([, v]) => v > 10)
    .sort(([, a], [, b]) => b - a)
    [0]?.[0] ?? null;

  const myAudioLevel = audioLevels[currentUser?.id ?? ""] ?? 0;

  // ─────────────────────────────────────
  // RENDER: ROOM LIST
  // ─────────────────────────────────────
  if (!activeRoom) {
    return (
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25
                              flex items-center justify-center">
                <Radio size={18} className="text-purple-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Huddles</h1>
            </div>
            <p className="text-zinc-500 text-sm">Drop-in voice rooms · Pivot Spaces</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600
                       hover:bg-purple-500 text-white text-sm font-semibold transition"
          >
            <Plus size={15} /> Start Huddle
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10
                          border border-red-500/20 text-red-400 text-sm">
            <X size={14} className="flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Room list */}
        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12
                          text-center space-y-3">
            <Radio size={32} className="text-zinc-700 mx-auto" />
            <p className="text-zinc-500 text-sm">No active huddles</p>
            <p className="text-zinc-700 text-xs">Start one and your team can drop in</p>
            <button onClick={() => setShowCreate(true)}
              className="text-purple-400 text-sm hover:text-purple-300 transition">
              Start a huddle →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div key={room.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5
                           hover:border-zinc-700 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-white font-semibold truncate">{room.name}</p>
                    </div>
                    {room.department && (
                      <span className="text-[10px] text-purple-400 bg-purple-500/10
                                       border border-purple-500/20 px-2 py-0.5 rounded-full">
                        {room.department}
                      </span>
                    )}
                    <p className="text-xs text-zinc-600">
                      Started {formatRelative(room.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoinRoom(room)}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                               bg-purple-600 hover:bg-purple-500 text-white
                               text-sm font-semibold transition disabled:opacity-50 flex-shrink-0"
                  >
                    {loading
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Mic size={14} />
                    }
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create room modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4
                          bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800
                            rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Start a Huddle</h3>
                <button onClick={() => { setShowCreate(false); setNewRoomName(""); }}
                  className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center
                             justify-center transition">
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20
                              rounded-xl px-3 py-2">{error}</p>
              )}

              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Room name</label>
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                  placeholder="e.g. Quick sync, Design review..."
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                             text-sm text-white placeholder-zinc-600 outline-none
                             focus:border-purple-500 transition"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowCreate(false); setNewRoomName(""); setError(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm
                             text-zinc-400 hover:text-white transition">Cancel</button>
                <button
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim() || loading}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500
                             text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Start"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────
  // RENDER: ACTIVE ROOM (X Spaces style)
  // ─────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#060608] overflow-hidden">

      {/* Room header */}
      <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25
                            flex items-center justify-center flex-shrink-0">
              <Radio size={16} className="text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold truncate">{activeRoom.name}</p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
                <span>{formatElapsed(elapsed)}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Users size={10} /> {roomParticipants.length}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700
                               flex items-center justify-center transition">
              <Share2 size={14} className="text-zinc-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-8">

        {/* Speakers */}
        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold mb-5">
            Speakers · {speakers.length}
          </p>
          <div className="flex flex-wrap gap-8">
            {speakers.map((p) => (
              <ParticipantBubble
                key={p.id}
                participant={{ ...p, audioLevel: audioLevels[p.user_id] ?? 0 }}
                isSpeaking={
                  activeSpeakerId === p.user_id &&
                  (audioLevels[p.user_id] ?? 0) > 10
                }
                isLocal={p.user_id === currentUser?.id}
                canPromote={isHost && p.user_id !== currentUser?.id}
                onPromote={() => handlePromote(p.user_id)}
                onMute={() => handleMuteParticipant(p.user_id)}
                onRemove={() => handleRemoveParticipant(p.user_id)}
                onReact={(emoji) => handleReact(p.user_id, emoji)}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        {listeners.length > 0 && <div className="h-px bg-zinc-800" />}

        {/* Listeners */}
        {listeners.length > 0 && (
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold mb-4">
              Listeners · {listeners.length}
            </p>
            <div className="flex flex-wrap gap-6">
              {listeners.map((p) => (
                <ParticipantBubble
                  key={p.id}
                  participant={p}
                  isSpeaking={false}
                  isLocal={p.user_id === currentUser?.id}
                  canPromote={isHost}
                  onPromote={() => handlePromote(p.user_id)}
                  onMute={() => {}}
                  onRemove={() => handleRemoveParticipant(p.user_id)}
                  onReact={(emoji) => handleReact(p.user_id, emoji)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/90
                      backdrop-blur-sm px-5 py-4">

        {/* My audio spectrum when speaking */}
        {!isMuted && myAudioLevel > 8 && (
          <div className="flex justify-center mb-3">
            <AudioSpectrum level={myAudioLevel} color="#a855f7" bars={24} height={24} />
          </div>
        )}

        <div className="flex items-center justify-between">

          {/* Left — mic + hand + emoji */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMute}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm
                          font-semibold transition border
                ${isMuted
                  ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
                  : "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                }`}
            >
              {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
              {isMuted ? "Unmute" : "Mute"}
            </button>

            <button
              onClick={handleRaiseHand}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm
                          font-semibold transition border
                ${handRaised
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700"
                }`}
            >
              <span>✋</span>
              {handRaised ? "Lower" : "Hand"}
            </button>

            {/* Global emoji reaction */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiBar(!showEmojiBar)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm
                            font-semibold transition border
                  ${showEmojiBar
                    ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700"
                  }`}
              >
                <Smile size={15} /> React
              </button>
              {showEmojiBar && (
                <div className="absolute bottom-14 left-0 bg-zinc-900 border border-zinc-700
                                rounded-2xl p-2 grid grid-cols-6 gap-1 shadow-2xl z-50 w-max">
                  {EMOJI_LIST.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        handleReact(currentUser?.id ?? "", e);
                        setShowEmojiBar(false);
                      }}
                      className="w-9 h-9 rounded-xl hover:bg-zinc-800 flex items-center
                                 justify-center text-xl transition"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — leave / end */}
          <button
            onClick={handleLeave}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm
                        font-semibold transition
              ${isHost
                ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20"
                : "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"
              }`}
          >
            <PhoneOff size={15} />
            {isHost ? "End Huddle" : "Leave"}
          </button>
        </div>

        <p className="text-[10px] text-zinc-700 text-center mt-2">
          {isHost
            ? "You are the host · ending the huddle removes all participants"
            : "You are a listener"
          }
        </p>
      </div>
    </div>
  );
}