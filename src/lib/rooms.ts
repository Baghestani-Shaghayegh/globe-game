import { supabase } from "./supabase";
import type { GameType } from "../data/modes";

export type RoomStatus = "lobby" | "playing" | "done";

export type Room = {
  id: number;
  code: string;
  host_id: string;
  status: RoomStatus;
  game_type: GameType;
  mode_id: string;
  question_seconds: number;
  questions: string[];
  current_index: number;
  question_started_at: string | null;
  started_at: string | null;
  ended_at: string | null;
};

export type RoomPlayer = {
  room_id: number;
  user_id: string;
  score: number;
  joined_at: string;
};

export type RoomAnswer = {
  room_id: number;
  question_index: number;
  user_id: string;
  correct: boolean;
  points: number;
  ms: number;
};

/** How many countries a match asks for. Short enough to play in a sitting. */
export const MATCH_ROUNDS = 10;
export const MAX_PLAYERS = 8;

/** The alphabet room codes are drawn from — no O/0 or I/1 to mishear. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

/**
 * What a typed code becomes before it is sent: people paste them with spaces,
 * type them in lower case, and read O for 0.
 */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .slice(0, CODE_LENGTH);
}

/** Whether a code is worth sending to the server at all. */
export function isCompleteCode(raw: string): boolean {
  const code = normalizeCode(raw);
  return (
    code.length === CODE_LENGTH &&
    [...code].every((c) => CODE_ALPHABET.includes(c))
  );
}

/** Picks the match's questions: a shuffle, trimmed to length. */
export function pickQuestions(
  names: string[],
  rounds = MATCH_ROUNDS,
  random: () => number = Math.random
): string[] {
  const pool = [...names];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(rounds, pool.length));
}

/** Seconds left on the question on screen, from the server's start time. */
export function secondsLeft(room: Room, now: number = Date.now()): number {
  if (room.status !== "playing" || !room.question_started_at) return 0;
  const started = new Date(room.question_started_at).getTime();
  const left = room.question_seconds - (now - started) / 1000;
  return Math.max(0, Math.ceil(left));
}

/** Final standings: most points first, ties split by who joined earlier. */
export function standings(
  players: RoomPlayer[]
): (RoomPlayer & { rank: number })[] {
  return [...players]
    .sort((a, b) => b.score - a.score || (a.joined_at < b.joined_at ? -1 : 1))
    .map((player, i, all) => ({
      ...player,
      // Equal scores share a rank, so a draw reads as a draw.
      rank:
        i > 0 && all[i - 1].score === player.score
          ? all.findIndex((p) => p.score === player.score) + 1
          : i + 1,
    }));
}

function client() {
  if (!supabase) throw new Error("Multiplayer needs an account.");
  return supabase;
}

/** Turns a Postgres error into something a player can act on. */
export function describeRoomError(error: unknown): string {
  const message = (error as { message?: string })?.message;
  return message && !message.startsWith("{")
    ? message
    : "Something went wrong. Try again.";
}

export async function createRoom(
  gameType: GameType,
  modeId: string,
  questionSeconds = 15
): Promise<string> {
  const { data, error } = await client().rpc("create_room", {
    p_game_type: gameType,
    p_mode_id: modeId,
    p_question_seconds: questionSeconds,
  });
  if (error) throw error;
  return data as string;
}

export async function joinRoom(code: string): Promise<number> {
  const { data, error } = await client().rpc("join_room", {
    p_code: normalizeCode(code),
  });
  if (error) throw error;
  return data as number;
}

export async function startMatch(code: string, questions: string[]) {
  const { error } = await client().rpc("start_match", {
    p_code: code,
    p_questions: questions,
  });
  if (error) throw error;
}

/** Reports an answer and returns what it scored. */
export async function submitAnswer(
  code: string,
  index: number,
  correct: boolean
): Promise<number> {
  const { data, error } = await client().rpc("submit_answer", {
    p_code: code,
    p_index: index,
    p_correct: correct,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Asks the server to move on. It refuses until the clock is genuinely up. */
export async function callTimeUp(code: string, index: number) {
  await client().rpc("time_up", { p_code: code, p_index: index });
}

export async function rematch(code: string) {
  const { error } = await client().rpc("rematch", { p_code: code });
  if (error) throw error;
}

export async function leaveRoom(code: string) {
  await client().rpc("leave_room", { p_code: code });
}
