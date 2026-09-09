import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { normalizeCode, type Room, type RoomAnswer, type RoomPlayer } from "../../lib/rooms";

export type RoomState = {
  loading: boolean;
  room: Room | null;
  players: RoomPlayer[];
  /** Answers to the question currently on screen. */
  answers: RoomAnswer[];
  error: string | null;
  /** Re-reads everything — used after a call that changes the room. */
  refresh: () => Promise<void>;
};

/**
 * Watches one room and everything in it.
 *
 * The database is the match: it holds the questions, whose turn it is and what
 * everyone has scored, and both browsers are readers of it. That is what keeps
 * two players in step without either of them being in charge — and why every
 * change arrives here as a Postgres change rather than a message one client
 * decided to send.
 */
export function useRoom(rawCode: string | undefined): RoomState {
  const code = rawCode ? normalizeCode(rawCode) : "";
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [answers, setAnswers] = useState<RoomAnswer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roomId = useRef<number | null>(null);

  const read = useCallback(async () => {
    // Without a client or a code there is nothing to wait for, and leaving
    // `loading` set would park the page on its spinner forever.
    if (!supabase || !code) {
      setLoading(false);
      return;
    }
    const { data: rooms, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .order("created_at", { ascending: false })
      .limit(1);

    if (roomError) {
      setError(roomError.message);
      setLoading(false);
      return;
    }
    const found = (rooms?.[0] as Room | undefined) ?? null;
    setRoom(found);
    roomId.current = found?.id ?? null;
    if (!found) {
      setPlayers([]);
      setAnswers([]);
      setLoading(false);
      return;
    }

    const [{ data: playerRows }, { data: answerRows }] = await Promise.all([
      supabase.from("room_players").select("*").eq("room_id", found.id),
      supabase.from("room_answers").select("*").eq("room_id", found.id),
    ]);
    setPlayers((playerRows ?? []) as RoomPlayer[]);
    setAnswers((answerRows ?? []) as RoomAnswer[]);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    void read();
  }, [read]);

  // One channel for the room and its two child tables. Each event only says
  // that something moved, so we re-read rather than trying to patch state from
  // the payload — a match is small, and a wrong guess about ordering here
  // would show two players different boards.
  useEffect(() => {
    const client = supabase;
    if (!client || !code) return;
    const channel = client
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        () => void read()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players" },
        (payload) => {
          const changed = (payload.new ?? payload.old) as { room_id?: number };
          if (changed?.room_id === roomId.current) void read();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_answers" },
        (payload) => {
          const changed = (payload.new ?? payload.old) as { room_id?: number };
          if (changed?.room_id === roomId.current) void read();
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [code, read]);

  return { loading, room, players, answers, error, refresh: read };
}
