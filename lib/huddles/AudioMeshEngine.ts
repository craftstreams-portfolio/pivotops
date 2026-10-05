import { supabase } from "@/lib/supabase";

/**
 * lib/huddles/AudioMeshEngine.ts
 *
 * Extracted verbatim from app/dashboard/voice/page.tsx so the engine can be
 * owned by a layout-level provider rather than the page - a page-owned
 * engine is torn down on navigation, which ends the call. No logic changed
 * in this move; behaviour is identical.
 */

export interface SignalMsg {
  type: "offer" | "answer" | "ice" | "leave";
  from: string;
  to?: string;
  payload: any;
}
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export class AudioMeshEngine {
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