"use client";

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
  Maximize2, Grid3X3, Wifi, WifiOff,
  RadioTower,
} from "lucide-react";

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
type ConferenceView = "lobby" | "waiting" | "device-test" | "live";
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
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name: string) {
  const p = name.trim().split(" ");
  return p.length >= 2
    ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase()
    : p[0][0].toUpperCase();
}

// ─────────────────────────────────────────
// AUDIO WAVE VISUALIZER (AI interview style)
// ─────────────────────────────────────────
function AudioWave({ level, color = "#6366f1", bars = 20 }: {
  level: number;
  color?: string;
  bars?:  number;
}) {
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const center  = bars / 2;
    const dist    = Math.abs(i - center) / center;
    const base    = (1 - dist * 0.6) * (level / 100);
    const jitter  = Math.sin(Date.now() / 200 + i) * 0.15 * base;
    return Math.max(0.05, Math.min(1, base + jitter));
  });

  return (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {barHeights.map((h, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-75"
          style={{
            width:           "3px",
            height:          `${Math.round(h * 32)}px`,
            backgroundColor: color,
            opacity:         0.5 + h * 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// WAITING ROOM ANIMATION
// ─────────────────────────────────────────
function WaitingAnimation() {
  return (
    <div className="relative w-64 h-48 mx-auto">
      {/* Desk */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-zinc-700 rounded-lg" />
      {/* Monitor stand */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3 h-8 bg-zinc-600 rounded" />
      {/* Curved monitor */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-52 h-32
                      bg-zinc-800 rounded-3xl border-4 border-zinc-600 overflow-hidden
                      shadow-2xl shadow-indigo-500/20">
        {/* Screen content */}
        <div className="w-full h-full bg-gradient-to-br from-indigo-950 to-zinc-900
                        flex items-center justify-center">
          <div className="space-y-2 w-3/4">
            <div className="h-1.5 bg-indigo-500/40 rounded animate-pulse" />
            <div className="h-1.5 bg-indigo-500/30 rounded animate-pulse delay-75 w-4/5" />
            <div className="h-1.5 bg-indigo-500/20 rounded animate-pulse delay-150 w-3/5" />
          </div>
          {/* Webcam dot */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2
                          w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
      {/* Person silhouette */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        {/* Head */}
        <div className="w-10 h-10 rounded-full bg-zinc-600 mx-auto mb-1 relative">
          {/* Face */}
          <div className="absolute inset-2 rounded-full bg-zinc-500" />
        </div>
        {/* Body */}
        <div className="w-14 h-10 bg-zinc-700 rounded-t-xl mx-auto" />
      </div>
      {/* Tapping fingers animation */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1 translate-x-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-2 h-3 bg-zinc-500 rounded-full"
            style={{ animation: `tap 0.8s ease-in-out ${i * 0.1}s infinite alternate` }}
          />
        ))}
      </div>
      <style>{`
        @keyframes tap {
          from { transform: translateY(0px); }
          to   { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────
// VIDEO TILE
// ─────────────────────────────────────────
function VideoTile({
  participant,
  isSpotlight,
  isLocal,
  onSpotlight,
  hostControls,
  onMute,
  onKick,
}: {
  participant:  ParticipantState;
  isSpotlight:  boolean;
  isLocal:      boolean;
  onSpotlight:  () => void;
  hostControls: boolean;
  onMute:       () => void;
  onKick:       () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = participant.audioLevel > 15;

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-zinc-900 cursor-pointer
                  transition-all duration-300 group
        ${isSpotlight ? "col-span-2 row-span-2" : ""}
        ${isSpeaking ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20" : "ring-1 ring-zinc-800"}
      `}
      onClick={onSpotlight}
    >
      {/* Video */}
      {participant.isVideoOn && participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br
                        from-zinc-900 to-zinc-800 min-h-[120px]">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center
                          justify-center text-2xl font-bold text-indigo-300">
            {getInitials(participant.displayName)}
          </div>
        </div>
      )}

      {/* Audio wave overlay when speaking */}
      {isSpeaking && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <AudioWave level={participant.audioLevel} color="#6366f1" bars={16} />
        </div>
      )}

      {/* Name bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2
                      bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-1.5">
          {participant.role === "host" && (
            <Crown size={11} className="text-amber-400 flex-shrink-0" />
          )}
          <p className="text-xs text-white font-medium truncate">
            {participant.displayName}{isLocal ? " (You)" : ""}
          </p>
          <div className="ml-auto flex items-center gap-1">
            {participant.isMuted && (
              <div className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
                <MicOff size={10} className="text-white" />
              </div>
            )}
            {participant.isSharing && (
              <div className="w-5 h-5 rounded-full bg-emerald-500/80 flex items-center justify-center">
                <Monitor size={10} className="text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Host controls overlay */}
      {hostControls && !isLocal && (
        <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onMute(); }}
            className="w-7 h-7 rounded-lg bg-black/60 hover:bg-amber-500/80
                       flex items-center justify-center transition"
            title="Mute">
            <VolumeX size={12} className="text-white" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onKick(); }}
            className="w-7 h-7 rounded-lg bg-black/60 hover:bg-red-500/80
                       flex items-center justify-center transition"
            title="Remove">
            <UserX size={12} className="text-white" />
          </button>
        </div>
      )}

      {/* Speaking indicator ring pulse */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-500 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// DEVICE TEST PANEL
// ─────────────────────────────────────────
function DeviceTest({
  onDone,
  localStream,
  isMuted,
  isVideoOn,
  onToggleMute,
  onToggleVideo,
}: {
  onDone:        () => void;
  localStream:   MediaStream | null;
  isMuted:       boolean;
  isVideoOn:     boolean;
  onToggleMute:  () => void;
  onToggleVideo: () => void;
}) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const [vol, setVol] = useState(80);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-white mb-1">Test your devices</h3>
        <p className="text-sm text-zinc-500">Make sure everything works before joining</p>
      </div>

      {/* Camera preview */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-800 aspect-video">
        {isVideoOn && localStream ? (
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <VideoOff size={32} className="text-zinc-600" />
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

      {/* Volume control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5"><Volume2 size={12} /> Speaker Volume</span>
          <span>{vol}%</span>
        </div>
        <input
          type="range" min={0} max={100} value={vol}
          onChange={(e) => setVol(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
      </div>

      <button
        onClick={onDone}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500
                   text-white font-semibold text-sm transition"
      >
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
  const [newMeeting,     setNewMeeting]     = useState({
    title: "", description: "", scheduledStart: "", scheduledEnd: "",
  });
  const [copied,         setCopied]         = useState(false);
  const [waitingList,    setWaitingList]    = useState<MeetingParticipant[]>([]);
  const [loading,        setLoading]        = useState(false);

  const engineRef    = useRef<WebRTCEngine | null>(null);
  const timerRef     = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);

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

  // ── Call timer ─────────────────────────
  useEffect(() => {
    if (view === "live") {
      startTimeRef.current = new Date();
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
        }
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

  // ── Start lobby device test ────────────
  const handleJoinMeeting = async (meeting: Meeting) => {
    setActiveMeeting(meeting);
    setLoading(true);
    try {
      const stream = await new WebRTCEngine("", "").getLocalStream(true, true);
      setLocalStream(stream);

      const isOrganizer = meeting.host_user_id === currentUser?.id;
      setView(isOrganizer ? "device-test" : "waiting");
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

      if (role === "host") {
        await updateMeetingStatus(activeMeeting.id, "live");
      }

      // Init WebRTC engine
      const engine = new WebRTCEngine(activeMeeting.id, currentUser.id);
      engineRef.current = engine;

      engine.onPeerJoined = (userId, stream) => {
        setParticipants((prev) => {
          const existing = prev.find((p) => p.userId === userId);
          if (existing) return prev.map((p) => p.userId === userId ? { ...p, stream } : p);
          return [...prev, {
            userId,
            displayName: userId,
            role:        "participant",
            stream,
            audioLevel:  0,
            isMuted:     false,
            isVideoOn:   true,
            isSharing:   false,
            admitted:    true,
          }];
        });
      };

      engine.onPeerLeft = (userId) => {
        setParticipants((prev) => prev.filter((p) => p.userId !== userId));
      };

      engine.onAudioLevel = (userId, level) => {
        setAudioLevels((prev) => ({ ...prev, [userId]: level }));
        if (level > 15) setSpotlight(userId);
      };

      engine.onMuteChanged = (userId, muted) => {
        setParticipants((prev) =>
          prev.map((p) => p.userId === userId ? { ...p, isMuted: muted } : p)
        );
      };

      // Get existing participants
      const existing = await getMeetingParticipants(activeMeeting.id);
      setDbParticipants(existing);

      const admitted = existing.filter((ep) => ep.admitted && ep.participant_user_id !== currentUser.id);
      await engine.joinRoom(admitted.map((ep) => ep.participant_user_id));

      if (localStream) engine["localStream"] = localStream;

      // Subscribe to participant changes
      subscribeToMeetingParticipants(activeMeeting.id, (updated) => {
        setDbParticipants(updated);
        const waiting = updated.filter((up) => !up.admitted && up.participant_user_id !== currentUser.id);
        setWaitingList(waiting);
      });

      // Add self to participants state
      setParticipants([{
        userId:      currentUser.id,
        displayName: currentUser.full_name ?? "You",
        role,
        stream:      localStream,
        audioLevel:  0,
        isMuted:     false,
        isVideoOn:   true,
        isSharing:   false,
        admitted:    true,
      }]);

      setView("live");
    } catch (err) {
      console.error("Join failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Leave call ─────────────────────────
  const handleLeave = async () => {
    await engineRef.current?.leaveRoom();
    localStream?.getTracks().forEach((t) => t.stop());
    shareStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setShareStream(null);
    setParticipants([]);
    setActiveMeeting(null);
    setMyParticipant(null);
    setView("lobby");
    setElapsed(0);
  };

  // ── Toggle mute ────────────────────────
  const handleToggleMute = () => {
    engineRef.current?.setMuted(!isMuted);
    setIsMuted((m) => !m);
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    if (myParticipant) updateParticipantState(myParticipant.id, { is_muted: !isMuted });
  };

  // ── Toggle video ───────────────────────
  const handleToggleVideo = () => {
    engineRef.current?.setVideoEnabled(!isVideoOn);
    setIsVideoOn((v) => !v);
    localStream?.getVideoTracks().forEach((t) => { t.enabled = !isVideoOn; });
    if (myParticipant) updateParticipantState(myParticipant.id, { is_video_on: !isVideoOn });
  };

  // ── Screen share ───────────────────────
  const handleScreenShare = async () => {
    if (isSharing) {
      engineRef.current?.stopScreenShare();
      shareStream?.getTracks().forEach((t) => t.stop());
      setShareStream(null);
      setIsSharing(false);
      if (myParticipant) updateParticipantState(myParticipant.id, { is_screen_sharing: false });
    } else {
      try {
        const stream = await engineRef.current?.startScreenShare();
        if (stream) {
          setShareStream(stream);
          setIsSharing(true);
          if (myParticipant) updateParticipantState(myParticipant.id, { is_screen_sharing: true });
        }
      } catch (err) {
        console.error("Screen share failed:", err);
      }
    }
  };

  // ── Admit participant ──────────────────
  const handleAdmit = async (p: MeetingParticipant) => {
    await admitParticipant(p.id);
    setWaitingList((prev) => prev.filter((w) => w.id !== p.id));
  };

  // ── Mute all ───────────────────────────
  const handleMuteAll = async () => {
    for (const p of dbParticipants) {
      if (p.participant_user_id !== currentUser?.id) {
        await updateParticipantState(p.id, { is_muted: true });
      }
    }
  };

  // ── Kick participant ───────────────────
  const handleKick = async (p: MeetingParticipant) => {
    await kickParticipant(p.id);
  };

  // ── Send chat ──────────────────────────
  const handleSendChat = () => {
    if (!chatInput.trim() || !currentUser) return;
    const msg: ChatMsg = {
      id:      crypto.randomUUID(),
      userId:  currentUser.id,
      name:    currentUser.full_name ?? "You",
      content: chatInput.trim(),
      time:    new Date().toISOString(),
    };
    setChatMsgs((prev) => [...prev, msg]);
    setChatInput("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  // ── Copy room code ─────────────────────
  const handleCopyCode = () => {
    if (activeMeeting?.room_code) {
      navigator.clipboard.writeText(activeMeeting.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Create meeting ─────────────────────
  const handleCreateMeeting = async () => {
    if (!newMeeting.title || !currentUser) return;
    const meeting = await createMeeting({
      title:          newMeeting.title,
      description:    newMeeting.description,
      hostUserId:     currentUser.id,
      scheduledStart: newMeeting.scheduledStart || new Date().toISOString(),
      scheduledEnd:   newMeeting.scheduledEnd   || new Date(Date.now() + 3600000).toISOString(),
      tenantId,
    });
    setMeetings((prev) => [...prev, meeting]);
    setShowNewMeeting(false);
    setNewMeeting({ title: "", description: "", scheduledStart: "", scheduledEnd: "" });
  };

  // ── Build participant list with audio levels ──
  const enrichedParticipants = participants.map((p) => ({
    ...p,
    audioLevel: audioLevels[p.userId] ?? 0,
  }));

  const speakingUserId = Object.entries(audioLevels)
    .sort(([, a], [, b]) => b - a)
    [0]?.[0] ?? null;

  const spotlightParticipant = spotlight
    ? enrichedParticipants.find((p) => p.userId === spotlight)
    : speakingUserId
      ? enrichedParticipants.find((p) => p.userId === speakingUserId)
      : enrichedParticipants[0];

  // ─────────────────────────────────────
  // RENDER: LOBBY
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
                      </div>
          <button
            onClick={() => setShowNewMeeting(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600
                       hover:bg-indigo-500 text-white text-sm font-semibold transition"
          >
            <Plus size={15} /> New Conference
          </button>
        </div>

        {/* Meetings list */}
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
            {meetings.map((m) => {
              const isLive = m.meeting_status === "live";
              const isHost2 = m.host_user_id === currentUser?.id;
              return (
                <div key={m.id}
                  className={`rounded-2xl border p-5 transition hover:border-zinc-700
                    ${isLive
                      ? "border-indigo-500/30 bg-indigo-500/5"
                      : "border-zinc-800 bg-zinc-900"
                    }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold truncate">{m.title}</p>
                        {isLive && (
                          <span className="flex items-center gap-1 text-[10px] text-red-400
                                           bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-full
                                           font-semibold flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            LIVE
                          </span>
                        )}
                        {isHost2 && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400
                                           bg-amber-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                            <Crown size={9} /> Host
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-sm text-zinc-500 truncate">{m.description}</p>
                      )}
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
                    <button
                      onClick={() => handleJoinMeeting(m)}
                      disabled={loading}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm
                                  font-semibold transition flex-shrink-0 disabled:opacity-50
                        ${isLive
                          ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                        }`}>
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                      {isLive ? "Join Live" : "Start"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New meeting modal */}
        {showNewMeeting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4
                          bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800
                            rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Schedule Conference</h3>
                <button onClick={() => setShowNewMeeting(false)}
                  className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Title *",       key: "title",       type: "text",           placeholder: "All-hands meeting" },
                  { label: "Description",   key: "description", type: "text",           placeholder: "Optional agenda" },
                  { label: "Start Time",    key: "scheduledStart", type: "datetime-local", placeholder: "" },
                  { label: "End Time",      key: "scheduledEnd",   type: "datetime-local", placeholder: "" },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
                    <input
                      type={type}
                      value={(newMeeting as any)[key]}
                      onChange={(e) => setNewMeeting((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5
                                 text-sm text-white placeholder-zinc-600 outline-none
                                 focus:border-indigo-500 transition"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowNewMeeting(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm
                             text-zinc-400 hover:text-white transition">Cancel</button>
                <button onClick={handleCreateMeeting}
                  disabled={!newMeeting.title.trim()}
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
  // RENDER: WAITING ROOM
  // ─────────────────────────────────────
  if (view === "waiting") {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-8">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/25
                            flex items-center justify-center mx-auto">
              <RadioTower size={22} className="text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">{activeMeeting?.title}</h2>
            <p className="text-zinc-500 text-sm">You're in the waiting room</p>
          </div>

          <WaitingAnimation />

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              Waiting for the host to admit you...
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border
                ${!isMuted
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                  : "bg-red-500/15 text-red-400 border-red-500/25"
                }`}>
                {!isMuted ? <Mic size={11} /> : <MicOff size={11} />}
                {!isMuted ? "Mic on" : "Muted"}
              </div>
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border
                ${isVideoOn
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                  : "bg-red-500/15 text-red-400 border-red-500/25"
                }`}>
                {isVideoOn ? <Video size={11} /> : <VideoOff size={11} />}
                {isVideoOn ? "Camera on" : "Camera off"}
              </div>
            </div>
          </div>

          <button
            onClick={() => { localStream?.getTracks().forEach((t) => t.stop()); setView("lobby"); }}
            className="text-sm text-zinc-500 hover:text-white transition">
            Leave waiting room
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // RENDER: DEVICE TEST
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
          <DeviceTest
            onDone={handleEnterCall}
            localStream={localStream}
            isMuted={isMuted}
            isVideoOn={isVideoOn}
            onToggleMute={handleToggleMute}
            onToggleVideo={handleToggleVideo}
          />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // RENDER: LIVE CALL
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
            <Clock size={11} />
            {formatElapsed(elapsed)}
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
          {/* Waiting room badge */}
          {isHost && waitingList.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                            bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs">
              <Shield size={11} />
              {waitingList.length} waiting
              <button onClick={() => waitingList.forEach(handleAdmit)}
                className="ml-1 underline hover:no-underline">Admit all</button>
            </div>
          )}

          {/* Layout toggle */}
          <button onClick={() => setLayout((l) => l === "grid" ? "spotlight" : "grid")}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700
                       flex items-center justify-center transition">
            {layout === "grid"
              ? <Grid3X3 size={14} className="text-zinc-400" />
              : <Maximize2 size={14} className="text-zinc-400" />
            }
          </button>

          {/* Chat */}
          <button onClick={() => setChatOpen(!chatOpen)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition
              ${chatOpen ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"}`}>
            <MessageSquare size={14} />
          </button>

          {/* Participants */}
          <button className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700
                             flex items-center justify-center transition text-zinc-400">
            <Users size={14} />
          </button>

          {/* Mute all (host only) */}
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
              {/* Main spotlight */}
              <div className="flex-1 rounded-2xl overflow-hidden">
                <VideoTile
                  participant={{ ...spotlightParticipant, audioLevel: audioLevels[spotlightParticipant.userId] ?? 0 }}
                  isSpotlight={true}
                  isLocal={spotlightParticipant.userId === currentUser?.id}
                  onSpotlight={() => {}}
                  hostControls={isHost}
                  onMute={() => {
                    const dbP = dbParticipants.find((p) => p.participant_user_id === spotlightParticipant.userId);
                    if (dbP) updateParticipantState(dbP.id, { is_muted: true });
                  }}
                  onKick={() => {
                    const dbP = dbParticipants.find((p) => p.participant_user_id === spotlightParticipant.userId);
                    if (dbP) handleKick(dbP);
                  }}
                />
              </div>
              {/* Sidebar strip */}
              <div className="w-44 space-y-2 overflow-y-auto">
                {enrichedParticipants
                  .filter((p) => p.userId !== spotlightParticipant.userId)
                  .map((p) => (
                    <div key={p.userId} className="h-28">
                      <VideoTile
                        participant={p}
                        isSpotlight={false}
                        isLocal={p.userId === currentUser?.id}
                        onSpotlight={() => setSpotlight(p.userId)}
                        hostControls={isHost}
                        onMute={() => {
                          const dbP = dbParticipants.find((dp) => dp.participant_user_id === p.userId);
                          if (dbP) updateParticipantState(dbP.id, { is_muted: true });
                        }}
                        onKick={() => {
                          const dbP = dbParticipants.find((dp) => dp.participant_user_id === p.userId);
                          if (dbP) handleKick(dbP);
                        }}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            // Grid layout
            <div className={`grid gap-3 h-full
              ${enrichedParticipants.length === 1 ? "grid-cols-1" :
                enrichedParticipants.length <= 4 ? "grid-cols-2" :
                "grid-cols-3"
              }`}>
              {enrichedParticipants.map((p) => (
                <VideoTile
                  key={p.userId}
                  participant={p}
                  isSpotlight={false}
                  isLocal={p.userId === currentUser?.id}
                  onSpotlight={() => { setSpotlight(p.userId); setLayout("spotlight"); }}
                  hostControls={isHost}
                  onMute={() => {
                    const dbP = dbParticipants.find((dp) => dp.participant_user_id === p.userId);
                    if (dbP) updateParticipantState(dbP.id, { is_muted: true });
                  }}
                  onKick={() => {
                    const dbP = dbParticipants.find((dp) => dp.participant_user_id === p.userId);
                    if (dbP) handleKick(dbP);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="w-72 flex-shrink-0 border-l border-zinc-800 bg-zinc-900
                          flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">In-call Chat</p>
              <button onClick={() => setChatOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-zinc-800 flex items-center justify-center transition">
                <X size={12} className="text-zinc-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMsgs.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-4">No messages yet</p>
              )}
              {chatMsgs.map((msg) => (
                <div key={msg.id}
                  className={`flex flex-col ${msg.userId === currentUser?.id ? "items-end" : "items-start"}`}>
                  <p className="text-[10px] text-zinc-500 mb-0.5">{msg.name}</p>
                  <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] break-words
                    ${msg.userId === currentUser?.id
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-white"
                    }`}>
                    {msg.content}
                  </div>
                  <p className="text-[9px] text-zinc-700 mt-0.5">{formatTime(msg.time)}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-zinc-800">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Send a message..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2
                             text-sm text-white placeholder-zinc-600 outline-none
                             focus:border-indigo-500 transition"
                />
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

      {/* Waiting room admit panel */}
      {isHost && waitingList.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 top-16 z-40
                        bg-zinc-900 border border-amber-500/30 rounded-2xl p-4
                        shadow-2xl min-w-[300px]">
          <p className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
            <Shield size={12} /> Waiting Room ({waitingList.length})
          </p>
          <div className="space-y-2">
            {waitingList.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-white">{p.display_name ?? p.participant_user_id}</p>
                <div className="flex gap-1.5">
                  <button onClick={() => handleAdmit(p)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500
                               text-white text-xs font-medium transition">
                    Admit
                  </button>
                  <button onClick={() => handleKick(p)}
                    className="px-3 py-1 rounded-lg bg-zinc-700 hover:bg-red-500/20
                               text-zinc-400 hover:text-red-400 text-xs transition">
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="flex items-center justify-center gap-3 px-6 py-4
                      bg-zinc-900/90 border-t border-zinc-800 flex-shrink-0 backdrop-blur-sm">
        {/* Mic */}
        <button onClick={handleToggleMute}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
            ${isMuted
              ? "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/20"
              : "bg-zinc-700 hover:bg-zinc-600"
            }`}
          title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-white" />}
        </button>

        {/* Video */}
        <button onClick={handleToggleVideo}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
            ${!isVideoOn
              ? "bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/20"
              : "bg-zinc-700 hover:bg-zinc-600"
            }`}
          title={isVideoOn ? "Stop Video" : "Start Video"}>
          {isVideoOn ? <Video size={18} className="text-white" /> : <VideoOff size={18} className="text-white" />}
        </button>

        {/* Screen share */}
        <button onClick={handleScreenShare}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
            ${isSharing
              ? "bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
              : "bg-zinc-700 hover:bg-zinc-600"
            }`}
          title={isSharing ? "Stop sharing" : "Share screen"}>
          {isSharing ? <MonitorOff size={18} className="text-white" /> : <Monitor size={18} className="text-white" />}
        </button>

        {/* Chat */}
        <button onClick={() => setChatOpen(!chatOpen)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition
            ${chatOpen ? "bg-indigo-500 hover:bg-indigo-400" : "bg-zinc-700 hover:bg-zinc-600"}`}
          title="Chat">
          <MessageSquare size={18} className="text-white" />
        </button>

        {/* Leave */}
        <button onClick={handleLeave}
          className="w-14 h-12 rounded-2xl bg-red-500 hover:bg-red-400
                     flex items-center justify-center transition shadow-lg shadow-red-500/20"
          title="Leave">
          <PhoneOff size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}