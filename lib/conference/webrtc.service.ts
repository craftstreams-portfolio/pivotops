import { supabase } from "../supabase";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TYPES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface SignalMessage {
  type:      "offer" | "answer" | "ice-candidate" | "leave" | "mute" | "admit" | "kick";
  from:      string;
  to?:       string; // null = broadcast
  roomId:    string;
  payload:   any;
}

export interface PeerConnection {
  userId:     string;
  pc:         RTCPeerConnection;
  stream:     MediaStream | null;
  audioLevel: number;
  isMuted:    boolean;
  isVideoOn:  boolean;
  isSharing:  boolean;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ICE SERVERS (STUN/TURN)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302"    },
  { urls: "stun:stun1.l.google.com:19302"   },
  { urls: "stun:stun2.l.google.com:19302"   },
  { urls: "stun:stun3.l.google.com:19302"   },
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// WebRTC ENGINE CLASS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export class WebRTCEngine {
  private roomId:     string;
  private userId:     string;
  private peers:      Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private channel:    any = null;
  private audioCtx:   AudioContext | null = null;
  private analyserMap: Map<string, AnalyserNode> = new Map();

  onPeerJoined?:   (userId: string, stream: MediaStream) => void;
  onPeerLeft?:     (userId: string) => void;
  onAudioLevel?:   (userId: string, level: number) => void;
  onMuteChanged?:  (userId: string, muted: boolean) => void;
  onScreenShare?:  (userId: string, stream: MediaStream | null) => void;
  onError?:        (err: string) => void;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  async getLocalStream(video = true, audio = true): Promise<MediaStream> {
    const { safeGetUserMedia } = await import("../media/safeGetUserMedia");

    const constraints: MediaStreamConstraints = {
      video: video ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate:   { ideal: 30 },
        facingMode:  "user",
      } : false,
      audio: audio ? {
        echoCancellation:    true,
        noiseSuppression:    true,
        autoGainControl:     true,
      } : false,
    };

    const { stream, error } = await safeGetUserMedia(constraints);

    if (error || !stream) {
      this.onError?.(error ?? "Media access failed.");
      throw new Error(error ?? "Media access failed.");
    }

    this.localStream = stream;
    return stream;
  }

  // â”€â”€ Get screen share stream â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getScreenStream(): Promise<MediaStream> {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: "always", displaySurface: "monitor" },
        audio: true,
      });
      this.screenStream = stream;
      return stream;
    } catch (err) {
      throw new Error(`Screen share failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // â”€â”€ Stop screen share â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  stopScreenShare() {
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;

    // Replace video track in all peer connections
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.peers.forEach((peer) => {
          const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
          sender?.replaceTrack(videoTrack);
        });
      }
    }
  }

  // â”€â”€ Start screen share â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async startScreenShare(): Promise<MediaStream> {
    const stream = await this.getScreenStream();
    const videoTrack = stream.getVideoTracks()[0];

    // Replace video track in all peer connections
    this.peers.forEach((peer) => {
      const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
      sender?.replaceTrack(videoTrack);
    });

    videoTrack.onended = () => this.stopScreenShare();
    return stream;
  }

  // â”€â”€ Join room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async joinRoom(existingPeerIds: string[]) {
    // Subscribe to signaling channel
    this.channel = supabase
      .channel(`conference-${this.roomId}`)
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        await this.handleSignal(payload as SignalMessage);
      })
      .subscribe();

    // Create offers to all existing peers
    for (const peerId of existingPeerIds) {
      if (peerId !== this.userId) {
        await this.createPeerConnection(peerId, true);
      }
    }
  }

  // â”€â”€ Leave room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async leaveRoom() {
    await this.sendSignal({ type: "leave", from: this.userId, roomId: this.roomId, payload: {} });

    this.peers.forEach((peer) => {
      peer.pc.close();
      peer.stream?.getTracks().forEach((t) => t.stop());
    });
    this.peers.clear();

    this.localStream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.localStream  = null;
    this.screenStream = null;

    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.audioCtx?.close();
    this.audioCtx = null;
  }

  // â”€â”€ Mute/unmute local audio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    this.sendSignal({
      type:    "mute",
      from:    this.userId,
      roomId:  this.roomId,
      payload: { muted },
    });
  }

  // â”€â”€ Enable/disable local video â”€â”€â”€â”€â”€â”€â”€â”€
  setVideoEnabled(enabled: boolean) {
  if (!this.localStream) return;
  const videoTracks = this.localStream.getVideoTracks();
  videoTracks.forEach((t) => { t.enabled = enabled; });

  // Force video elements to re-attach the stream when re-enabling
  if (enabled) {
    this.peers.forEach((peer) => {
      const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
      const track  = videoTracks[0];
      if (sender && track) sender.replaceTrack(track);
    });
  }
}

  // â”€â”€ Audio level detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  startAudioLevelDetection(stream: MediaStream, userId: string) {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    try {
      const source   = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.analyserMap.set(userId, analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        this.onAudioLevel?.(userId, Math.round(avg));
        requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // AudioContext may fail in some environments
    }
  }

  // â”€â”€ Create peer connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async createPeerConnection(peerId: string, initiator: boolean) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    this.localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
    });

    // Handle remote stream
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
      this.onPeerJoined?.(peerId, remoteStream);
      this.startAudioLevelDetection(remoteStream, peerId);
    };

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type:    "ice-candidate",
          from:    this.userId,
          to:      peerId,
          roomId:  this.roomId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.onPeerLeft?.(peerId);
        this.peers.delete(peerId);
      }
    };

    this.peers.set(peerId, {
      userId:     peerId,
      pc,
      stream:     remoteStream,
      audioLevel: 0,
      isMuted:    false,
      isVideoOn:  true,
      isSharing:  false,
    });

    if (initiator) {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      this.sendSignal({
        type:    "offer",
        from:    this.userId,
        to:      peerId,
        roomId:  this.roomId,
        payload: offer,
      });
    }

    return pc;
  }

  // â”€â”€ Handle incoming signal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async handleSignal(msg: SignalMessage) {
    if (msg.from === this.userId) return;
    if (msg.to && msg.to !== this.userId) return;

    switch (msg.type) {
      case "offer": {
        let peer = this.peers.get(msg.from);
        if (!peer) {
          const pc = await this.createPeerConnection(msg.from, false);
          peer = this.peers.get(msg.from)!;
        }
        await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.sendSignal({
          type:    "answer",
          from:    this.userId,
          to:      msg.from,
          roomId:  this.roomId,
          payload: answer,
        });
        break;
      }

      case "answer": {
        const peer = this.peers.get(msg.from);
        if (peer) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        }
        break;
      }

      case "ice-candidate": {
        const peer = this.peers.get(msg.from);
        if (peer && msg.payload) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(msg.payload));
          } catch { /* ignore stale candidates */ }
        }
        break;
      }

      case "leave": {
        this.onPeerLeft?.(msg.from);
        const peer = this.peers.get(msg.from);
        peer?.pc.close();
        this.peers.delete(msg.from);
        break;
      }

      case "mute": {
        const peer = this.peers.get(msg.from);
        if (peer) {
          peer.isMuted = msg.payload.muted;
          this.onMuteChanged?.(msg.from, msg.payload.muted);
        }
        break;
      }
    }
  }

  // â”€â”€ Send signal via Supabase broadcast â”€
  private sendSignal(msg: SignalMessage) {
    this.channel?.send({ type: "broadcast", event: "signal", payload: msg });
  }

  // â”€â”€ Get peers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MEETING DB OPERATIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface Meeting {
  id:                     string;
  title:                  string;
  description:            string | null;
  meeting_type:           string;
  host_user_id:           string;
  department:             string | null;
  scheduled_start:        string;
  scheduled_end:          string;
  meeting_status:         string;
  voice_room_id:          string | null;
  room_code:              string | null;
  max_participants:       number;
  waiting_room_enabled:   boolean;
  created_at:             string;
}

export interface MeetingParticipant {
  id:                   string;
  meeting_id:           string;
  participant_user_id:  string;
  participant_role:     string;
  joined_at:            string | null;
  admitted:             boolean;
  is_muted:             boolean;
  is_video_on:          boolean;
  is_screen_sharing:    boolean;
  display_name:         string | null;
  tenant_id:            string | null;
}

export async function createMeeting(payload: {
  title:          string;
  description?:   string;
  meetingType?:   string;
  hostUserId:     string;
  department?:    string;
  scheduledStart: string;
  scheduledEnd:   string;
  tenantId:       string;
}): Promise<Meeting> {
  const roomCode = Math.random().toString(36).substring(2, 9).toUpperCase();

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      title:                  payload.title,
      description:            payload.description ?? null,
      meeting_type:           payload.meetingType ?? "conference",
      host_user_id:           payload.hostUserId,
      department:             payload.department ?? null,
      scheduled_start:        payload.scheduledStart,
      scheduled_end:          payload.scheduledEnd,
      meeting_status:         "scheduled",
      room_code:              roomCode,
      max_participants:       50,
      waiting_room_enabled:   true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Meeting;
}

export async function getMeetings(tenantId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("scheduled_start", { ascending: true });

  if (error) throw new Error(error.message);
  return data as Meeting[];
}

export async function updateMeetingStatus(
  meetingId: string,
  status:    "scheduled" | "live" | "ended"
): Promise<void> {
  await supabase.from("meetings").update({ meeting_status: status }).eq("id", meetingId);
}

export async function joinMeeting(payload: {
  meetingId:   string;
  userId:      string;
  displayName: string;
  role:        "host" | "participant" | "guest";
  tenantId:    string;
}): Promise<MeetingParticipant> {
  // Upsert participant
  const { data, error } = await supabase
    .from("meeting_participants")
    .upsert({
      meeting_id:           payload.meetingId,
      participant_user_id:  payload.userId,
      participant_role:     payload.role,
      joined_at:            new Date().toISOString(),
      admitted:             payload.role === "host",
      is_muted:             false,
      is_video_on:          true,
      is_screen_sharing:    false,
      display_name:         payload.displayName,
      tenant_id:            payload.tenantId,
    }, { onConflict: "meeting_id,participant_user_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingParticipant;
}

export async function admitParticipant(participantId: string): Promise<void> {
  await supabase
    .from("meeting_participants")
    .update({ admitted: true, joined_at: new Date().toISOString() })
    .eq("id", participantId);
}

export async function kickParticipant(participantId: string): Promise<void> {
  await supabase
    .from("meeting_participants")
    .delete()
    .eq("id", participantId);
}

export async function updateParticipantState(
  participantId: string,
  state: Partial<{ is_muted: boolean; is_video_on: boolean; is_screen_sharing: boolean }>
): Promise<void> {
  await supabase.from("meeting_participants").update(state).eq("id", participantId);
}

export async function getMeetingParticipants(meetingId: string): Promise<MeetingParticipant[]> {
  const { data, error } = await supabase
    .from("meeting_participants")
    .select("*")
    .eq("meeting_id", meetingId);

  if (error) return [];
  return data as MeetingParticipant[];
}

export function subscribeToMeetingParticipants(
  meetingId: string,
  onChange:  (participants: MeetingParticipant[]) => void
) {
  const channel = supabase
    .channel(`meeting-participants-${meetingId}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "meeting_participants",
        filter: `meeting_id=eq.${meetingId}` },
      async () => {
        const participants = await getMeetingParticipants(meetingId);
        onChange(participants);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

