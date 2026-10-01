/**
 * ==========================================
 * PIVOTOPS VOICE ROOM ENGINE
 * ==========================================
 * Enterprise Workforce Voice Infrastructure
 * ==========================================
 */

export type VoiceRoomStatus = "active" | "closed";

export interface VoiceParticipant {
  userId: string;
  joinedAt: number;
  muted: boolean;
  speaking?: boolean;
}

export interface VoiceRoom {
  id: string;
  roomName: string;
  createdBy: string;
  department?: string | null;
  participants: VoiceParticipant[];
  createdAt: number;
  status: VoiceRoomStatus;
  emergency?: boolean;
  meetingId?: string | null;
}

export interface CreateVoiceRoomParams {
  id: string;
  roomName?: string;
  name?: string;
  createdBy: string;
  department?: string;
  emergency?: boolean;
  meetingId?: string;
}

/**
 * ==========================================
 * IN-MEMORY ACTIVE ROOMS
 * ==========================================
 */
const activeVoiceRooms: VoiceRoom[] = [];

/**
 * ==========================================
 * CREATE VOICE ROOM
 * ==========================================
 */
export async function createVoiceRoom(
  params: CreateVoiceRoomParams
): Promise<VoiceRoom> {
  const existingRoom = activeVoiceRooms.find(
    (room) => room.id === params.id
  );

  if (existingRoom) return existingRoom;

  const room: VoiceRoom = {
    id: params.id,
    roomName: params.roomName ?? params.name ?? "Untitled Voice Room",
    createdBy: params.createdBy,
    department: params.department ?? null,
    participants: [],
    createdAt: Date.now(),
    status: "active",
    emergency: params.emergency ?? false,
    meetingId: params.meetingId ?? null,
  };

  activeVoiceRooms.unshift(room);
  return room;
}

/**
 * ==========================================
 * GET ACTIVE ROOMS
 * ==========================================
 */
export function getActiveVoiceRooms(): VoiceRoom[] {
  return activeVoiceRooms.filter((room) => room.status === "active");
}

/**
 * ==========================================
 * GET ROOM BY ID
 * ==========================================
 */
export function getVoiceRoomById(
  roomId: string
): VoiceRoom | undefined {
  return activeVoiceRooms.find((room) => room.id === roomId);
}

/**
 * ==========================================
 * JOIN ROOM
 * ==========================================
 */
export function joinVoiceRoom(
  roomId: string,
  userId: string
): VoiceRoom | null {
  const room = getVoiceRoomById(roomId);

  if (!room) {
    console.error("Voice room not found");
    return null;
  }

  const existing = room.participants.find(
    (p) => p.userId === userId
  );

  if (!existing) {
    room.participants.push({
      userId,
      joinedAt: Date.now(),
      muted: false,
      speaking: false,
    });
  }

  return room;
}

/**
 * ==========================================
 * LEAVE ROOM
 * ==========================================
 */
export function leaveVoiceRoom(
  roomId: string,
  userId: string
): VoiceRoom | null {
  const room = getVoiceRoomById(roomId);
  if (!room) return null;

  room.participants = room.participants.filter(
    (p) => p.userId !== userId
  );

  return room;
}

/**
 * ==========================================
 * TOGGLE MUTE
 * ==========================================
 */
export function toggleMuteParticipant(
  roomId: string,
  userId: string
): VoiceRoom | null {
  const room = getVoiceRoomById(roomId);
  if (!room) return null;

  const participant = room.participants.find(
    (p) => p.userId === userId
  );

  if (!participant) return null;

  participant.muted = !participant.muted;
  return room;
}

/**
 * ==========================================
 * UPDATE SPEAKING STATE
 * ==========================================
 */
export function setParticipantSpeaking(
  roomId: string,
  userId: string,
  speaking: boolean
): VoiceRoom | null {
  const room = getVoiceRoomById(roomId);
  if (!room) return null;

  const participant = room.participants.find(
    (p) => p.userId === userId
  );

  if (!participant) return null;

  participant.speaking = speaking;
  return room;
}

/**
 * ==========================================
 * CLOSE ROOM
 * ==========================================
 */
export function closeVoiceRoom(
  roomId: string
): VoiceRoom | null {
  const room = getVoiceRoomById(roomId);
  if (!room) return null;

  room.status = "closed";
  return room;
}

/**
 * ==========================================
 * CLEANUP CLOSED ROOMS
 * ==========================================
 */
export function cleanupClosedRooms() {
  for (let i = activeVoiceRooms.length - 1; i >= 0; i--) {
    if (activeVoiceRooms[i].status === "closed") {
      activeVoiceRooms.splice(i, 1);
    }
  }
}

/**
 * ==========================================
 * GET PARTICIPANT COUNT
 * ==========================================
 */
export function getRoomParticipantCount(roomId: string): number {
  const room = getVoiceRoomById(roomId);
  return room?.participants.length ?? 0;
}

/**
 * ==========================================
 * CHECK USER IN ROOM
 * ==========================================
 */
export function isUserInRoom(
  roomId: string,
  userId: string
): boolean {
  const room = getVoiceRoomById(roomId);
  if (!room) return false;

  return room.participants.some(
    (p) => p.userId === userId
  );
}

/**
 * ==========================================
 * GET USER ROOMS
 * ==========================================
 */
export function getUserVoiceRooms(userId: string): VoiceRoom[] {
  return activeVoiceRooms.filter((room) =>
    room.participants.some((p) => p.userId === userId)
  );
}

/**
 * ==========================================
 * GET MEETING ROOM
 * ==========================================
 */
export function getMeetingVoiceRoom(
  meetingId: string
): VoiceRoom | undefined {
  return activeVoiceRooms.find(
    (room) => room.meetingId === meetingId
  );
}