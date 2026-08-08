"use client";

import { useEffect, useState } from "react";

import {
  Mic,
  Users,
  Volume2,
  PhoneCall,
} from "lucide-react";

import {
  createVoiceRoom,
  getActiveVoiceRooms,
  joinVoiceRoom,
  leaveVoiceRoom,
  toggleMuteParticipant,
  VoiceRoom,
} from ".../../../lib/voice/voiceRoomEngine";

export default function VoiceRoomPanel() {
  const [rooms, setRooms] =
    useState<VoiceRoom[]>([]);

  const currentUserId =
    "current-user";

  /**
   * ===============================
   * LOAD ACTIVE ROOMS
   * ===============================
   */
  useEffect(() => {
    syncRooms();
  }, []);

  function syncRooms() {
    setRooms([
      ...getActiveVoiceRooms(),
    ]);
  }

  /**
   * ===============================
   * CREATE ROOM
   * ===============================
   */
  function handleCreateRoom() {
    createVoiceRoom({
      id: crypto.randomUUID(),

      roomName:
        "Emergency Coordination Room",

      createdBy: currentUserId,

      department: "Operations",
    });

    syncRooms();
  }

  /**
   * ===============================
   * JOIN ROOM
   * ===============================
   */
  function handleJoin(
    roomId: string
  ) {
    joinVoiceRoom(
      roomId,
      currentUserId
    );

    syncRooms();
  }

  /**
   * ===============================
   * LEAVE ROOM
   * ===============================
   */
  function handleLeave(
    roomId: string
  ) {
    leaveVoiceRoom(
      roomId,
      currentUserId
    );

    syncRooms();
  }

  /**
   * ===============================
   * TOGGLE MUTE
   * ===============================
   */
  function handleToggleMute(
    roomId: string
  ) {
    toggleMuteParticipant(
      roomId,
      currentUserId
    );

    syncRooms();
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">

      {/* =============================== */}
      {/* HEADER */}
      {/* =============================== */}
      <div className="flex items-center justify-between">

        <div>
          <h2 className="text-xl font-bold text-white">
            Pivot Teams Voice Rooms
          </h2>

          <p className="text-sm text-zinc-400 mt-1">
            Live workforce communication infrastructure.
          </p>
        </div>

        <button
          onClick={
            handleCreateRoom
          }
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition"
        >
          Create Room
        </button>
      </div>

      {/* =============================== */}
      {/* ROOMS */}
      {/* =============================== */}
      <div className="space-y-4">

        {rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-500 text-center">
            No active voice rooms.
          </div>
        ) : (
          rooms.map(
            (
              room: VoiceRoom
            ) => {
              const joined =
                room.participants.some(
                  (
                    participant
                  ) =>
                    participant.userId ===
                    currentUserId
                );

              const currentParticipant =
                room.participants.find(
                  (
                    participant
                  ) =>
                    participant.userId ===
                    currentUserId
                );

              return (
                <div
                  key={room.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
                >

                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    {/* LEFT */}
                    <div className="space-y-3">

                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <PhoneCall
                            size={18}
                            className="text-emerald-400"
                          />
                        </div>

                        <div>
                          <h3 className="font-semibold text-white">
                            {room.roomName}
                          </h3>

                          <p className="text-xs text-zinc-500">
                            Department:
                            {" "}
                            {room.department ||
                              "General"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-zinc-400">

                        <div className="flex items-center gap-2">
                          <Users
                            size={15}
                          />

                          <span>
                            {
                              room
                                .participants
                                .length
                            }
                            {" "}
                            participants
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Volume2
                            size={15}
                          />

                          <span>
                            Status:
                            {" "}
                            {
                              room.status
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center gap-3">

                      {!joined ? (
                        <button
                          onClick={() =>
                            handleJoin(
                              room.id
                            )
                          }
                          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800 transition"
                        >
                          Join Room
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              handleToggleMute(
                                room.id
                              )
                            }
                            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                              currentParticipant?.muted
                                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Mic
                                size={15}
                              />

                              <span>
                                {currentParticipant?.muted
                                  ? "Unmute"
                                  : "Mute"}
                              </span>
                            </div>
                          </button>

                          <button
                            onClick={() =>
                              handleLeave(
                                room.id
                              )
                            }
                            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800 transition"
                          >
                            Leave
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          )
        )}
      </div>
    </div>
  );
}