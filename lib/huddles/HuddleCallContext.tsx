"use client";

import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { AudioMeshEngine } from "@/lib/huddles/AudioMeshEngine";

/**
 * lib/huddles/HuddleCallContext.tsx
 *
 * Owns the live call so it survives route changes. The engine used to be a
 * useRef inside app/dashboard/voice/page.tsx, which meant navigating away
 * unmounted the page and tore down every peer connection - ending the call.
 * Mounted once in the dashboard layout, the call now persists while the user
 * moves around the app, with a mini bar giving them control from anywhere.
 *
 * Deliberately holds ONLY call-critical state. Everything else (reactions,
 * hand-raise UI, idle warnings, Time It, room list) stays on the page.
 */

export interface VoiceRoom {
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

export interface VoiceRoomParticipant {
  id: string;
  tenant_id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  hand_raised: boolean;
  is_muted: boolean;
}

interface JoinArgs {
  room: VoiceRoom;
  me: { id: string; tenantId: string };
}

interface HuddleCallValue {
  activeRoom: VoiceRoom | null;
  participants: VoiceRoomParticipant[];
  setParticipants: React.Dispatch<React.SetStateAction<VoiceRoomParticipant[]>>;
  levels: Record<string, number>;
  myMuted: boolean;
  myParticipantId: string | null;
  engine: AudioMeshEngine | null;
  joinRoom: (args: JoinArgs) => Promise<VoiceRoomParticipant[]>;
  leaveRoom: () => Promise<void>;
  toggleMute: () => void;
  setMutedFromRemote: (muted: boolean) => void;
}

const Ctx = createContext<HuddleCallValue | null>(null);

export function HuddleCallProvider({ children }: { children: ReactNode }) {
  const [activeRoom, setActiveRoom] = useState<VoiceRoom | null>(null);
  const [participants, setParticipants] = useState<VoiceRoomParticipant[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [myMuted, setMyMuted] = useState(true);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);

  const engineRef = useRef<AudioMeshEngine | null>(null);
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const myMutedRef = useRef(true);
  const meRef = useRef<{ id: string; tenantId: string } | null>(null);

  const joinRoom = useCallback(async ({ room, me }: JoinArgs) => {
    meRef.current = me;

    // Clear any row this user already holds in the room - a refresh or
    // reconnect otherwise leaves a second live row and they render twice.
    await supabase.from("voice_room_participants")
      .delete().eq("room_id", room.id).eq("user_id", me.id);

    const { data: existingRows } = await supabase
      .from("voice_room_participants").select("*").eq("room_id", room.id);

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
        room_id: room.id, tenant_id: me.tenantId, user_id: me.id,
        joined_at: new Date().toISOString(), hand_raised: false, is_muted: true,
      })
      .select().single();

    if (insertErr) throw insertErr;
    setMyParticipantId(myRow.id);

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

    try {
      await engine.getLocalStream();
      engine.setMuted(true);
      await engine.join(existingPeerIds);
    } catch (e) {
      // The participant row is written before the mic is requested, so a
      // failure here would otherwise leave a ghost in the roster.
      await supabase.from("voice_room_participants").delete().eq("id", myRow.id);
      setMyParticipantId(null);
      engineRef.current = null;
      throw e;
    }

    const all = [...existing, myRow as VoiceRoomParticipant];
    setParticipants(all);
    setActiveRoom(room);
    setMyMuted(true);
    myMutedRef.current = true;
    return all;
  }, []);

  const leaveRoom = useCallback(async () => {
    try { await engineRef.current?.leave(); } catch {}
    engineRef.current = null;
    audioElsRef.current.forEach((el) => el.remove());
    audioElsRef.current.clear();
    if (myParticipantId) {
      await supabase.from("voice_room_participants").delete().eq("id", myParticipantId);
    }
    setMyParticipantId(null);
    setActiveRoom(null);
    setParticipants([]);
    setLevels({});
  }, [myParticipantId]);

  const toggleMute = useCallback(() => {
    const next = !myMutedRef.current;
    myMutedRef.current = next;
    setMyMuted(next);
    engineRef.current?.setMuted(next);
    if (myParticipantId) {
      supabase.from("voice_room_participants").update({ is_muted: next }).eq("id", myParticipantId);
    }
  }, [myParticipantId]);

  // Used by the page's remote-mute watcher (Time It auto-mute, host mute) -
  // a DB flag alone does not silence a mic in this mesh, the local engine
  // has to be told.
  const setMutedFromRemote = useCallback((muted: boolean) => {
    myMutedRef.current = muted;
    setMyMuted(muted);
    engineRef.current?.setMuted(muted);
  }, []);

  return (
    <Ctx.Provider value={{
      activeRoom, participants, setParticipants, levels, myMuted, myParticipantId,
      engine: engineRef.current, joinRoom, leaveRoom, toggleMute, setMutedFromRemote,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useHuddleCall(): HuddleCallValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHuddleCall must be used inside HuddleCallProvider");
  return v;
}