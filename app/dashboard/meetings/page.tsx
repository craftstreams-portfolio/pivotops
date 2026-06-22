"use client";
import { safeGetUserMedia } from "@/lib/media/safeGetUserMedia";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/lib/hooks/useTenant";
import {
  WebRTCEngine, createMeeting, getMeetings, updateMeetingStatus,
  joinMeeting, admitParticipant, kickParticipant,
  updateParticipantState, getMeetingParticipants,
  subscribeToMeetingParticipants,
  type Meeting, type MeetingParticipant,
} from "@/lib/conference/webrtc.service";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Monitor, MonitorOff, MessageSquare, Users,
  Crown, UserX, VolumeX, Volume2, Settings,
  Plus, Copy, Check, Clock, Calendar,
  ChevronRight, Loader2, Shield, X,
  Maximize2, Grid3X3, RadioTower, Smile,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
type ConferenceView = "lobby" | "device-test" | "live" | "ended";
type LayoutMode     = "grid" | "spotlight";

interface ChatMsg {
  id:      string;
  userId:  string;
  name:    string;
  content: string;
  time:    string;
}

interface ParticipantState {
  userId:      string;
  displayName: string;
  role:        "host" | "participant" | "guest";
  stream:      MediaStream | null;
  audioLevel:  number;
  isMuted:     boolean;
  isVideoOn:   boolean;
  isSharing:   boolean;
  admitted:    boolean;
  reactions:   string[];
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function getInitials(name: string) {
  const p = name.trim().split(" ");
  return p.length >= 2 ? `${p[0][0]}${p[p.length-1][0]}`.toUpperCase() : p[0][0].toUpperCase();
}

const EMOJI_LIST = ["👍","👎","❤️","😂","😮","😢","🎉","🔥","✅","👏","🚀","💯"];

// ─────────────────────────────────────────
// AUDIO SPECTRUM — animated bars
// ─────────────────────────────────────────
function AudioSpectrum({ level, color = "#6366f1", bars = 24, height = 40 }: {
  level:   number;
  color?:  string;
  bars?:   number;
  height?: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60);
    return () => clearInterval(id);
  }, []);

  const barHeights = Array.from({ length: bars }, (_, i) => {
    const center = bars / 2;
    const dist   = Math.abs(i - center) / center;
    const base   = (1 - dist * 0.5) * (level / 100);
    const wave   = Math.sin(tick * 0.3 + i * 0.6) * 0.2 * base;
    return Math.max(0.04, Math.min(1, base + wave));
  });

  return (
    <div className="flex items-center justify-center gap-[2px]" style={{ height }}>
      {barHeights.map((h, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-75"
          style={{
            width:           "3px",
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
// MIC LEVEL METER (device test)
// ─────────────────────────────────────────
function MicLevelMeter({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream) return;
    ctxRef.current = new AudioContext();
    const source   = ctxRef.current.createMediaStreamSource(stream);
    const analyser = ctxRef.current.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(Math.round(avg));
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close();
    };
  }, [stream]);

  const pct = Math.min(100, (level / 50) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><Mic size={12} /> Microphone Level</span>
        <span className={pct > 10 ? "text-emerald-400" : "text-zinc-600"}>
          {pct > 10 ? "Detecting audio ✓" : "Speak to test..."}
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${pct}%`,
            backgroundColor: pct > 60 ? "#f59e0b" : "#10b981",
          }}
        />
      </div>
      <div className="mt-1">
        <AudioSpectrum level={level} color={pct > 10 ? "#10b981" : "#3f3f46"} bars={32} height={28} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// VIDEO TILE
// ─────────────────────────────────────────
function VideoTile({
  participant, isSpotlight, isLocal, onSpotlight,
  hostControls, onMute, onKick, onReact,
}: {
  participant:  ParticipantState;
  isSpotlight:  boolean;
  isLocal:      boolean;
  onSpotlight:  () => void;
  hostControls: boolean;
  onMute:       () => void;
  onKick:       () => void;
  onReact:      (emoji: string) => void;
}) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const isSpeaking    = participant.audioLevel > 15;

  useEffect(() => {
    if (!videoRef.current) return;
    if (participant.isVideoOn && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.srcObject = null;
    }
  }, [participant.stream, participant.isVideoOn]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-zinc-900 cursor-pointer
                  transition-all duration-300 group
        ${isSpotlight ? "col-span-2 row-span-2" : ""}
        ${isSpeaking ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20" : "ring-1 ring-zinc-800"}`}
      onClick={onSpotlight}
    >
      {participant.isVideoOn && participant.stream ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal}
          className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center
                        bg-gradient-to-br from-zinc-900 to-zinc-800 min-h-[120px]">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center
                          justify-center text-2xl font-bold text-indigo-300">
            {getInitials(participant.displayName)}
          </div>
        </div>
      )}

      {/* Audio spectrum for speaker */}
      {isSpeaking && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full px-4">
          <AudioSpectrum level={participant.audioLevel} color="#6366f1" bars={20} height={32} />
        </div>
      )}

      {/* Floating reactions */}
      {participant.reactions?.slice(-3).map((emoji, i) => (
        <div key={i} className="absolute text-2xl animate-bounce pointer-events-none"
          style={{ bottom: `${60 + i * 36}px`, right: "12px" }}>
          {emoji}
        </div>
      ))}

      {/* Name bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2
                      bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-1.5">
          {participant.role === "host" && <Crown size={11} className="text-amber-400 flex-shrink-0" />}
          <p className="text-xs text-white font-medium truncate">
            {participant.displayName}{isLocal ? " (You)" : ""}
          </p>
          <div className="ml-auto flex items-center gap-1">
            {participant.isMuted && (
              <div className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
                <MicOff size={10} className="text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action toolbar on hover */}
      {!isSpotlight && (
        <div className={`absolute top-2 right-2 hidden group-hover:flex gap-1`}>
          {/* Emoji react */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowEmoji(v => !v); }}
              className="w-7 h-7 rounded-lg bg-black/60 hover:bg-zinc-700/80
                         flex items-center justify-center transition">
              <Smile size={12} className="text-white" />
            </button>
            {showEmoji && (
              <div className="absolute top-8 right-0 bg-zinc-900 border border-zinc-700
                              rounded-xl p-2 grid grid-cols-6 gap-1 shadow-2xl z-50 w-max"
                onClick={e => e.stopPropagation()}>
                {EMOJI_LIST.map(e => (
                  <button key={e}
                    onClick={() => { onReact(e); setShowEmoji(false); }}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center
                               justify-center text-base transition">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          {hostControls && !isLocal && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onMute(); }}
                className="w-7 h-7 rounded-lg bg-black/60 hover:bg-amber-500/80
                           flex items-center justify-center transition">
                <VolumeX size={12} className="text-white" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onKick(); }}
                className="w-7 h-7 rounded-lg bg-black/60 hover:bg-red-500/80
                           flex items-center justify-center transition">
                <UserX size={12} className="text-white" />
              </button>
            </>
          )}
        </div>
      )}

      {isSpeaking && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-500
                        animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// DEVICE TEST — with audio meter
// ─────────────────────────────────────────
function DeviceTest({
  onDone, localStream, isMuted, isVideoOn, onToggleMute, onToggleVideo,
}: {
  onDone:        () => void;
  localStream:   MediaStream | null;
  isMuted:       boolean;
  isVideoOn:     boolean;
  onToggleMute:  () => void;
  onToggleVideo: () => void;
}) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const [vol, setVol] = useState(80);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isVideoOn && localStream) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.srcObject = null;
    }
  }, [localStream, isVideoOn]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white mb-1">Test your devices</h3>
        <p className="text-sm text-zinc-500">Make sure everything works before joining</p>
      </div>

      {/* Camera */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-800 aspect-video">
        {isVideoOn && localStream ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 min-h-[200px]">
            <VideoOff size={32} className="text-zinc-600" />
            <p className="text-xs text-zinc-600">Camera off</p>
          </div>
        )}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          <button onClick={onToggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition
              ${isVideoOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500 hover:bg-red-400"}`}>
            {isVideoOn ? <Video size={16} className="text-white" /> : <VideoOff size={16} className="text-white" />}
          </button>
          <button onClick={onToggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition
              ${!isMuted ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-500 hover:bg-red-400"}`}>
            {!isMuted ? <Mic size={16} className="text-white" /> : <MicOff size={16} className="text-white" />}
          </button>
        </div>
      </div>

      {/* Mic level meter */}
      {!isMuted && localStream && <MicLevelMeter stream={localStream} />}
      {isMuted && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10
                        border border-amber-500/20 rounded-xl px-3 py-2">
          <MicOff size={12} /> Microphone is muted — unmute to test audio
        </div>
      )}

      {/* Volume */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><Volume2 size={12} /> Speaker Volume</span>
          <span>{vol}%</span>
        </div>
        <input type="range" min={0} max={100} value={vol}
          onChange={(e) => setVol(Number(e.target.value))}
          className="w-full accent-indigo-500" />
      </div>

      <button onClick={onDone}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500
                   text-white font-semibold text-sm transition">
        Join Conference
      </button>
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────
export default function ConferencePage() {
  const { tenantId, loading: tenantLoading } = useTenant();

  const [currentUser,    setCurrentUser]    = useState<any>(null);
  const [view,           setView]           = useState<ConferenceView>("lobby");
  const [meetings,       setMeetings]       = useState<Meeting[]>([]);
  const [activeMeeting,  setActiveMeeting]  = useState<Meeting | null>(null);
  const [participants,   setParticipants]   = useState<ParticipantState[]>([]);
  const [dbParticipants, setDbParticipants] = useState<MeetingParticipant[]>([]);
  const [myParticipant,  setMyParticipant]  = useState<MeetingParticipant | null>(null);
  const [layout,         setLayout]         = useState<LayoutMode>("grid");
  const [spotlight,      setSpotlight]      = useState<string | null>(null);
  const [chatOpen,       setChatOpen]       = useState(false);
  const [chatMsgs,       setChatMsgs]       = useState<ChatMsg[]>([]);
  const [chatInput,      setChatInput]      = useState("");
  const [localStream,    setLocalStream]    = useState<MediaStream | null>(null);
  const [isMuted,        setIsMuted]        = useState(false);
  const [isVideoOn,      setIsVideoOn]      = useState(true);
  const [isSharing,      setIsSharing]      = useState(false);
  const [shareStream,    setShareStream]    = useState<MediaStream | null>(null);
  const [audioLevels,    setAudioLevels]    = useState<Record<string, number>>({});
  const [elapsed,        setElapsed]        = useState(0);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [newMeeting,     setNewMeeting]     = useState({ title: "", description: "", scheduledStart: "", scheduledEnd: "" });
  const [copied,         setCopied]         = useState(false);
  const [waitingList,    setWaitingList]    = useState<MeetingParticipant[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [endedTitle,     setEndedTitle]     = useState("");
  const [showEmojiBar,   setShowEmojiBar]   = useState(false);

  const engineRef    = useRef<WebRTCEngine | null>(null);
  const timerRef     = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const localAnalRef = useRef<AnalyserNode | null>(null);
  const localRafRef  = useRef<number>(0);

  const isHost = myParticipant?.participant_role === "host";

  // ── Load user ──────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setCurrentUser(data ?? { id: session.user.id, full_name: session.user.email?.split("@")[0], email: session.user.email });
    };
    load();
  }, []);

  // ── Load meetings ──────────────────────
  useEffect(() => {
    if (tenantLoading) return;
    getMeetings(tenantId).then(setMeetings);
  }, [tenantId, tenantLoading]);

  // ── Timer ──────────────────────────────
  useEffect(() => {
    if (view === "live") {
      startTimeRef.current = new Date();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current)
          setElapsed(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [view]);

  function formatElapsed(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  // ── Start local audio level detection ──
  const startLocalAudioDetection = (stream: MediaStream) => {
    if (!stream.getAudioTracks().length) return;
    try {
      audioCtxRef.current = new AudioContext();
      const source   = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      localAnalRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevels(prev => ({ ...prev, [currentUser?.id ?? ""]: Math.round(avg) }));
        localRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* ignore */ }
  };

  // ── Join meeting ───────────────────────
  const handleJoinMeeting = async (meeting: Meeting) => {
    setActiveMeeting(meeting);
    setLoading(true);
    try {
      const engine = new WebRTCEngine("", "");
      const stream = await engine.getLocalStream(true, true);
      setLocalStream(stream);
      setView("device-test");
    } catch (err) {
      console.error("Device access failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Enter live call ────────────────────
  const handleEnterCall = async () => {
    if (!activeMeeting || !currentUser) return;
    setLoading(true);
    try {
      const role = activeMeeting.host_user_id === currentUser.id ? "host" : "participant";
      const p    = await joinMeeting({
        meetingId:   activeMeeting.id,
        userId:      currentUser.id,
        displayName: currentUser.full_name ?? currentUser.email ?? "User",
        role,
        tenantId,
      });
      setMyParticipant(p);
      if (role === "host") await updateMeetingStatus(activeMeeting.id, "live");

      const engine = new WebRTCEngine(activeMeeting.id, currentUser.id);
      engineRef.current = engine;

      engine.onPeerJoined = (userId, stream) => {
        setParticipants(prev => {
          const ex = prev.find(p => p.userId === userId);
          if (ex) return prev.map(p => p.userId === userId ? { ...p, stream } : p);
          return [...prev, { userId, displayName: userId, role: "participant", stream,
            audioLevel: 0, isMuted: false, isVideoOn: true, isSharing: false,
            admitted: true, reactions: [] }];
        });
      };
      engine.onPeerLeft     = (userId) => setParticipants(prev => prev.filter(p => p.userId !== userId));
      engine.onAudioLevel   = (userId, level) => {
        setAudioLevels(prev => ({ ...prev, [userId]: level }));
        if (level > 15) setSpotlight(userId);
      };
      engine.onMuteChanged  = (userId, muted) =>
        setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, isMuted: muted } : p));

      const existing = await getMeetingParticipants(activeMeeting.id);
      setDbParticipants(existing);
      const admitted = existing.filter(ep => ep.admitted && ep.participant_user_id !== currentUser.id);
      await engine.joinRoom(admitted.map(ep => ep.participant_user_id));
      if (localStream) (engine as any)["localStream"] = localStream;

      subscribeToMeetingParticipants(activeMeeting.id, (updated) => {
        setDbParticipants(updated);
        setWaitingList(updated.filter(up => !up.admitted && up.participant_user_id !== currentUser.id));
      });

      setParticipants([{
        userId:      currentUser.id,
        displayName: currentUser.full_name ?? "You",
        role, stream: localStream, audioLevel: 0,
        isMuted: false, isVideoOn: true, isSharing: false,
        admitted: true, reactions: [],
      }]);

      // Start local audio level detection
      if (localStream) startLocalAudioDetection(localStream);

      setView("live");
    } catch (err) {
      console.error("Join failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Leave / End call ───────────────────
  const handleLeave = async () => {
    const title = activeMeeting?.title ?? "";
    await engineRef.current?.leaveRoom();
    localStream?.getTracks().forEach(t => t.stop());
    shareStream?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(localRafRef.current);
    audioCtxRef.current?.close();

    // If host — mark meeting as ended
    if (isHost && activeMeeting) {
      await updateMeetingStatus(activeMeeting.id, "ended" as any);
      setMeetings(prev => prev.map(m =>
        m.id === activeMeeting.id ? { ...m, meeting_status: "ended" } : m
      ));
    }

    setLocalStream(null);
    setShareStream(null);
    setParticipants([]);
    setMyParticipant(null);
    setElapsed(0);
    setEndedTitle(title);
    setView("ended");
  };

  // ── Toggle mute ────────────────────────
  const handleToggleMute = () => {
    const newMuted = !isMuted;
    engineRef.current?.setMuted(newMuted);
    localStream?.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
    if (myParticipant) updateParticipantState(myParticipant.id, { is_muted: newMuted });
  };

  // ── Toggle video ───────────────────────
  const handleToggleVideo = () => {
    const newState = !isVideoOn;
    localStream?.getVideoTracks().forEach(t => { t.enabled = newState; });
    engineRef.current?.setVideoEnabled(newState);
    setIsVideoOn(newState);
    if (myParticipant) updateParticipantState(myParticipant.id, { is_video_on: newState });
    setParticipants(prev => prev.map(p =>
      p.userId === currentUser?.id
        ? { ...p, isVideoOn: newState, stream: newState ? localStream : p.stream }
        : p
    ));
  };

  // ── Screen share ───────────────────────
  const handleScreenShare = async () => {
    if (isSharing) {
      engineRef.current?.stopScreenShare();
      shareStream?.getTracks().forEach(t => t.stop());
      setShareStream(null); setIsSharing(false);
      if (myParticipant) updateParticipantState(myParticipant.id, { is_screen_sharing: false });
    } else {
      try {
        const stream = await engineRef.current?.startScreenShare();
        if (stream) {
          setShareStream(stream); setIsSharing(true);
          if (myParticipant) updateParticipantState(myParticipant.id, { is_screen_sharing: true });
        }
      } catch { /* user cancelled */ }
    }
  };

  // ── React with emoji ───────────────────
  const handleReact = (userId: string, emoji: string) => {
    setParticipants(prev => prev.map(p =>
      p.userId === userId
        ? { ...p, reactions: [...(p.reactions ?? []).slice(-5), emoji] }
        : p
    ));
    // Clear after 3s
    setTimeout(() => {
      setParticipants(prev => prev.map(p =>
        p.userId === userId
          ? { ...p, reactions: (p.reactions ?? []).filter(e => e !== emoji) }
          : p
      ));
    }, 3000);
  };

  const handleAdmit    = async (p: MeetingParticipant) => { await admitParticipant(p.id); setWaitingList(prev => prev.filter(w => w.id !== p.id)); };
  const handleMuteAll  = async () => { for (const p of dbParticipants) if (p.participant_user_id !== currentUser?.id) await updateParticipantState(p.id, { is_muted: true }); };
  const handleKick     = async (p: MeetingParticipant) => kickParticipant(p.id);
  const handleSendChat = () => {
    if (!chatInput.trim() || !currentUser) return;
    setChatMsgs(prev => [...prev, { id: crypto.randomUUID(), userId: currentUser.id, name: currentUser.full_name ?? "You", content: chatInput.trim(), time: new Date().toISOString() }]);
    setChatInput("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const handleCopyCode = () => {
    if (activeMeeting?.room_code) { navigator.clipboard.writeText(activeMeeting.room_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  const handleCreateMeeting = async () => {
    if (!newMeeting.title || !currentUser) return;
    const meeting = await createMeeting({
      title: newMeeting.title, description: newMeeting.description,
      hostUserId: currentUser.id,
      scheduledStart: newMeeting.scheduledStart || new Date().toISOString(),
      scheduledEnd:   newMeeting.scheduledEnd   || new Date(Date.now() + 3600000).toISOString(),
      tenantId,
    });
    setMeetings(prev => [...prev, meeting]);
    setShowNewMeeting(false);
    setNewMeeting({ title: "", description: "", scheduledStart: "", scheduledEnd: "" });
  };

  const enrichedParticipants = participants.map(p => ({ ...p, audioLevel: audioLevels[p.userId] ?? 0 }));
  const speakingUserId = Object.entries(audioLevels).sort(([,a],[,b]) => b-a)[0]?.[0] ?? null;
  const spotlightParticipant = spotlight
    ? enrichedParticipants.find(p => p.userId === spotlight)
    : speakingUserId ? enrichedParticipants.find(p => p.userId === speakingUserId)
    : enrichedParticipants[0];

  // ─────────────────────────────────────
  // ENDED VIEW
  // ─────────────────────────────────────
  if (view === "ended") {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700
                          flex items-center justify-center mx-auto">
            <PhoneOff size={28} className="text-zinc-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Meeting Ended</h2>
            <p className="text-zinc-500 text-sm">"{endedTitle}" has ended.</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setView("lobby"); setActiveMeeting(null); setEndedTitle(""); }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                         text-white text-sm font-semibold transition">
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // LOBBY
  // ─────────────────────────────────────
  if (view === "lobby") {
    return (
      <div className="p-4 md:p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25
                              flex items-center justify-center">
                <RadioTower size={18} className="text-indigo-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Conference</h1>
            </div>
            <p className="text-zinc-500 text-sm">Enterprise-grade video conferencing</p>
          </div>
          <button onClick={() => setShowNewMeeting(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600
                       hover:bg-indigo-500 text-white text-sm font-semibold transition">
            <Plus size={15} /> New Conference
          </button>
        </div>

        {meetings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center space-y-3">
            <RadioTower size={32} className="text-zinc-700 mx-auto" />
            <p className="text-zinc-500 text-sm">No conferences scheduled</p>
            <button onClick={() => setShowNewMeeting(true)}
              className="text-indigo-400 text-sm hover:text-indigo-300 transition">
              Create your first conference →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map(m => {
              const isLive   = m.meeting_status === "live";
              const isEnded  = m.meeting_status === "ended";
              const isHost2  = m.host_user_id === currentUser?.id;
              return (
                <div key={m.id}
                  className={`rounded-2xl border p-5 transition hover:border-zinc-700
                    ${isLive ? "border-indigo-500/30 bg-indigo-500/5" :
                      isEnded ? "border-zinc-800/50 bg-zinc-900/50 opacity-60" :
                      "border-zinc-800 bg-zinc-900"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold truncate">{m.title}</p>
                        {isLive && (
                          <span className="flex items-center gap-1 text-[10px] text-red-400
                                           bg-red-500/15 border border-red-500/25 px-2 py-0.5
                                           rounded-full font-semibold flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            LIVE
                          </span>
                        )}
                        {isEnded && (
                          <span className="text-[10px] text-zinc-600 bg-zinc-800 px-2 py-0.5
                                           rounded-full flex-shrink-0">Ended</span>
                        )}
                        {isHost2 && !isEnded && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400
                                           bg-amber-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                            <Crown size={9} /> Host
                          </span>
                        )}
                      </div>
                      {m.description && <p className="text-sm text-zinc-500 truncate">{m.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-zinc-600">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {formatDateTime(m.scheduled_start)}
                        </span>
                        {m.room_code && (
                          <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                            {m.room_code}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isEnded && (
                      <button onClick={() => handleJoinMeeting(m)} disabled={loading}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm
                                    font-semibold transition flex-shrink-0 disabled:opacity-50
                          ${isLive
                            ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white"
                          }`}>
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                        {isLive ? "Join Live" : "Start"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showNewMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4
                          bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Schedule Conference</h3>
                <button onClick={() => setShowNewMeeting(false)}
                  className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>
              <div className="space-y-3">
                {([
                  { label: "Title *",     key: "title",          type: "text",           placeholder: "All-hands meeting" },
                  { label: "Description", key: "description",    type: "text",           placeholder: "Optional agenda"   },
                  { label: "Start Time",  key: "scheduledStart", type: "datetime-local", placeholder: ""                  },
                  { label: "End Time",    key: "scheduledEnd",   type: "datetime-local", placeholder: ""                  },
                ] as { label: string; key: string; type: string; placeholder: string }[]).map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
                    <input type={type} value={(newMeeting as any)[key]}
                      onChange={e => setNewMeeting(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                                 text-sm text-white placeholder-zinc-600 outline-none
                                 focus:border-indigo-500 transition" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowNewMeeting(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm
                             text-zinc-400 hover:text-white transition">Cancel</button>
                <button onClick={handleCreateMeeting} disabled={!newMeeting.title.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                             text-white text-sm font-semibold transition disabled:opacity-50">
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────
  // DEVICE TEST
  // ─────────────────────────────────────
  if (view === "device-test") {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25
                            flex items-center justify-center">
              <Settings size={16} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Joining</p>
              <p className="text-white font-semibold">{activeMeeting?.title}</p>
            </div>
          </div>
          <DeviceTest onDone={handleEnterCall} localStream={localStream}
            isMuted={isMuted} isVideoOn={isVideoOn}
            onToggleMute={handleToggleMute} onToggleVideo={handleToggleVideo} />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // LIVE CALL
  // ─────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#060608] overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3
                      bg-zinc-900/80 border-b border-zinc-800 flex-shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-semibold text-sm truncate max-w-[200px]">
              {activeMeeting?.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
            <Clock size={11} /> {formatElapsed(elapsed)}
          </div>
          {activeMeeting?.room_code && (
            <button onClick={handleCopyCode}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white
                         bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded-lg transition">
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              {activeMeeting.room_code}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isHost && waitingList.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                            bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs">
              <Shield size={11} /> {waitingList.length} waiting
              <button onClick={() => waitingList.forEach(handleAdmit)}
                className="ml-1 underline hover:no-underline">Admit all</button>
            </div>
          )}
          <button onClick={() => setLayout(l => l === "grid" ? "spotlight" : "grid")}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700
                       flex items-center justify-center transition">
            {layout === "grid" ? <Grid3X3 size={14} className="text-zinc-400" /> : <Maximize2 size={14} className="text-zinc-400" />}
          </button>
          <button onClick={() => setChatOpen(!chatOpen)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition
              ${chatOpen ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"}`}>
            <MessageSquare size={14} />
          </button>
          <button className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700
                             flex items-center justify-center transition text-zinc-400">
            <Users size={14} />
          </button>
          {isHost && (
            <button onClick={handleMuteAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition">
              <VolumeX size={12} /> Mute All
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-3 overflow-hidden">
          {layout === "spotlight" && spotlightParticipant ? (
            <div className="flex gap-3 h-full">
              <div className="flex-1 rounded-2xl overflow-hidden">
                <VideoTile
                  participant={{ ...spotlightParticipant, audioLevel: audioLevels[spotlightParticipant.userId] ?? 0 }}
                  isSpotlight={true} isLocal={spotlightParticipant.userId === currentUser?.id}
                  onSpotlight={() => {}} hostControls={isHost}
                  onMute={() => { const d = dbParticipants.find(p => p.participant_user_id === spotlightParticipant.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                  onKick={() => { const d = dbParticipants.find(p => p.participant_user_id === spotlightParticipant.userId); if (d) handleKick(d); }}
                  onReact={(e) => handleReact(spotlightParticipant.userId, e)}
                />
              </div>
              <div className="w-44 space-y-2 overflow-y-auto">
                {enrichedParticipants.filter(p => p.userId !== spotlightParticipant.userId).map(p => (
                  <div key={p.userId} className="h-28">
                    <VideoTile participant={p} isSpotlight={false} isLocal={p.userId === currentUser?.id}
                      onSpotlight={() => setSpotlight(p.userId)} hostControls={isHost}
                      onMute={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                      onKick={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) handleKick(d); }}
                      onReact={(e) => handleReact(p.userId, e)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`grid gap-3 h-full
              ${enrichedParticipants.length === 1 ? "grid-cols-1" :
                enrichedParticipants.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
              {enrichedParticipants.map(p => (
                <VideoTile key={p.userId} participant={p} isSpotlight={false}
                  isLocal={p.userId === currentUser?.id}
                  onSpotlight={() => { setSpotlight(p.userId); setLayout("spotlight"); }}
                  hostControls={isHost}
                  onMute={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) updateParticipantState(d.id, { is_muted: true }); }}
                  onKick={() => { const d = dbParticipants.find(dp => dp.participant_user_id === p.userId); if (d) handleKick(d); }}
                  onReact={(e) => handleReact(p.userId, e)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="w-72 flex-shrink-0 border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">In-call Chat</p>
              <button onClick={() => setChatOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
                <X size={12} className="text-zinc-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMsgs.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">No messages yet</p>}
              {chatMsgs.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.userId === currentUser?.id ? "items-end" : "items-start"}`}>
                  <p className="text-[10px] text-zinc-500 mb-0.5">{msg.name}</p>
                  <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] break-words
                    ${msg.userId === currentUser?.id ? "bg-indigo-600 text-white" : "bg-zinc-800 text-white"}`}>
                    {msg.content}
                  </div>
                  <p className="text-[9px] text-zinc-700 mt-0.5">{formatTime(msg.time)}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-zinc-800">
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendChat()}
                  placeholder="Send a message..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2
                             text-sm text-white placeholder-zinc-600 outline-none
                             focus:border-indigo-500 transition" />
                <button onClick={handleSendChat}
                  className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500
                             flex items-center justify-center transition">
                  <ChevronRight size={15} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Waiting room panel */}
      {isHost && waitingList.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 top-16 z-40
                        bg-zinc-900 border border-amber-500/30 rounded-2xl p-4
                        shadow-2xl min-w-[300px]">
          <p className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
            <Shield size={12} /> Waiting Room ({waitingList.length})
          </p>
          <div className="space-y-2">
            {waitingList.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-white">{p.display_name ?? p.participant_user_id}</p>
                <div className="flex gap-1.5">
                  <button onClick={() => handleAdmit(p)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500
                               text-white text-xs font-medium transition">Admit</button>
                  <button onClick={() => handleKick(p)}
                    className="px-3 py-1 rounded-lg bg-zinc-700 hover:bg-red-500/20
                               text-zinc-400 hover:text-red-400 text-xs transition">Deny</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="flex items-center justify-center gap-3 px-6 py-4
                      bg-zinc-900/90 border-t border-zinc-800 flex-shrink-0 backdrop-blur-sm">
        <button onClick={handleToggleMute}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
            ${isMuted ? "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/20" : "bg-zinc-700 hover:bg-zinc-600"}`}>
          {isMuted ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-white" />}
        </button>
        <button onClick={handleToggleVideo}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
            ${!isVideoOn ? "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/20" : "bg-zinc-700 hover:bg-zinc-600"}`}>
          {isVideoOn ? <Video size={18} className="text-white" /> : <VideoOff size={18} className="text-white" />}
        </button>
        <button onClick={handleScreenShare}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
            ${isSharing ? "bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20" : "bg-zinc-700 hover:bg-zinc-600"}`}>
          {isSharing ? <MonitorOff size={18} className="text-white" /> : <Monitor size={18} className="text-white" />}
        </button>

        {/* Emoji reaction bar */}
        <div className="relative">
          <button onClick={() => setShowEmojiBar(!showEmojiBar)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
              ${showEmojiBar ? "bg-yellow-500/20 text-yellow-400" : "bg-zinc-700 hover:bg-zinc-600 text-white"}`}>
            <Smile size={18} />
          </button>
          {showEmojiBar && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700
                            rounded-2xl p-2 grid grid-cols-6 gap-1 shadow-2xl z-50 w-max">
              {EMOJI_LIST.map(e => (
                <button key={e}
                  onClick={() => { handleReact(currentUser?.id ?? "", e); setShowEmojiBar(false); }}
                  className="w-9 h-9 rounded-xl hover:bg-zinc-800 flex items-center
                             justify-center text-xl transition">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setChatOpen(!chatOpen)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
            ${chatOpen ? "bg-indigo-500 hover:bg-indigo-400" : "bg-zinc-700 hover:bg-zinc-600"}`}>
          <MessageSquare size={18} className="text-white" />
        </button>
        <button onClick={handleLeave}
          className="w-14 h-12 rounded-2xl bg-red-500 hover:bg-red-400
                     flex items-center justify-center transition shadow-lg shadow-red-500/20">
          <PhoneOff size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}