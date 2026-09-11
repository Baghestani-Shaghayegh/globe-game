import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { useRoom } from "../features/multiplayer/useRoom";
import MatchGlobe from "../features/multiplayer/MatchGlobe";
import {
  MATCH_ROUNDS,
  callTimeUp,
  describeRoomError,
  joinRoom,
  leaveRoom,
  pickQuestions,
  rematch,
  secondsLeft,
  standings,
  startMatch,
  submitAnswer,
  type Room as RoomRow,
} from "../lib/rooms";
import { getCountryMeta } from "../data/countries";
import { flagUrl } from "../data/flags";
import Celebrate from "../components/Celebrate";
import { playCorrect, playLose, playSolved, playWrong } from "../lib/sound";
import { cluesFor } from "../data/clues";
import { GAME_TYPES, MODES } from "../data/modes";
import type { Geometry } from "../lib/geo";
import { accountsEnabled, supabase } from "../lib/supabase";

type CountryFeature = { properties: { name: string }; geometry: Geometry };

/** Names shown next to scores. Fetched once — a match is a handful of people. */
function useNames(userIds: string[]): Record<string, { name: string; country: string | null }> {
  const [names, setNames] = useState<Record<string, { name: string; country: string | null }>>({});
  const key = [...userIds].sort().join(",");

  useEffect(() => {
    if (!supabase || !key) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, username, country")
      .in("id", key.split(","))
      .then(({ data }) => {
        if (cancelled || !data) return;
        setNames(
          Object.fromEntries(
            data.map((row) => [
              row.id as string,
              { name: row.username as string, country: row.country as string | null },
            ])
          )
        );
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return names;
}

/** The map this room is playing over, filtered the same way a solo round is. */
function useFeatures(room: RoomRow | null): CountryFeature[] {
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const modeId = room?.mode_id;
  const gameType = room?.game_type;

  useEffect(() => {
    if (!modeId || !gameType) return;
    let cancelled = false;
    const mode = MODES.find((m) => m.id === modeId);
    fetch("/data/world.geojson")
      .then((res) => res.json())
      .then((data: { features: CountryFeature[] }) => {
        if (cancelled) return;
        setFeatures(
          data.features.filter((f) => {
            const meta = getCountryMeta(f.properties.name);
            if (mode && !mode.includes(meta)) return false;
            if (gameType === "flag" && flagUrl(meta.geoName) === null) return false;
            if (gameType === "famous" && cluesFor(meta.geoName).length === 0) return false;
            return true;
          })
        );
      })
      .catch(() => {
        /* the lobby still works without the map */
      });
    return () => {
      cancelled = true;
    };
  }, [modeId, gameType]);

  return features;
}

function Flag({ code }: { code: string | null }) {
  if (!code) return <span aria-hidden="true" className="w-5 shrink-0" />;
  return (
    <img
      src={`/flags/${code}.svg`}
      alt=""
      width={20}
      height={15}
      className="w-5 shrink-0 rounded-[2px]"
    />
  );
}

export default function Room() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { loading, room, players, answers, error, refresh } = useRoom(code);
  const features = useFeatures(room);
  const names = useNames(players.map((p) => p.user_id));
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastAward, setLastAward] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  /** So the end-of-match sound plays once, not on every refresh afterwards. */
  const sounded = useRef(false);

  const me = session?.user.id ?? null;
  const isHost = room?.host_id === me;
  const target = room?.questions[room.current_index] ?? null;
  const myAnswer = answers.find(
    (a) => a.user_id === me && a.question_index === room?.current_index
  );

  // Someone arriving by shared link is joined by the act of opening it.
  useEffect(() => {
    if (!me || !profile || loading || room) return;
    void joinRoom(code)
      .then(refresh)
      .catch((caught) => setActionError(describeRoomError(caught)));
  }, [me, profile, loading, room, code, refresh]);

  // A one-second heartbeat drives the countdown; the server still owns when a
  // question actually ends.
  useEffect(() => {
    if (room?.status !== "playing") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [room?.status]);

  const left = room ? secondsLeft(room, Date.now()) : 0;
  const questionIndex = room?.current_index ?? 0;

  // When the clock runs out, whoever notices asks the server to move on. It
  // refuses if the time isn't really up, so both clients asking is harmless.
  useEffect(() => {
    if (room?.status !== "playing" || left > 0) return;
    void callTimeUp(code, questionIndex);
  }, [room?.status, left, code, questionIndex, tick]);

  useEffect(() => setLastAward(null), [questionIndex]);

  const answer = useCallback(
    async (correct: boolean) => {
      if (!room) return;
      if (correct) playCorrect(0);
      else playWrong();
      try {
        setLastAward(await submitAnswer(code, room.current_index, correct));
      } catch (caught) {
        setActionError(describeRoomError(caught));
      }
    },
    [code, room]
  );

  const begin = async () => {
    if (busy || !features.length) return;
    setBusy(true);
    setActionError(null);
    try {
      await startMatch(
        code,
        pickQuestions(features.map((f) => f.properties.name), MATCH_ROUNDS)
      );
    } catch (caught) {
      setActionError(describeRoomError(caught));
    } finally {
      setBusy(false);
    }
  };

  const quit = async () => {
    await leaveRoom(code).catch(() => {});
    navigate("/play-together");
  };

  const table = useMemo(() => standings(players), [players]);

  // The match ending, sounded once. Winning gets paper; losing gets the fall.
  useEffect(() => {
    if (room?.status !== "done" || sounded.current || !table.length) return;
    sounded.current = true;
    const mine = table.find((p) => p.user_id === me);
    if (mine?.rank === 1) {
      playSolved();
      setBurst((n) => n + 1);
    } else {
      playLose();
    }
  }, [room?.status, table, me]);

  // Checked before the room is looked up: a signed-out visitor following a
  // shared link can't read it anyway, and would otherwise sit on the spinner
  // waiting for a request that was never going to come back.
  if (!accountsEnabled || !session || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#07111c] px-6 text-center">
        <p className="max-w-xs text-zinc-100">
          {accountsEnabled
            ? "Matches show everyone's name, so you'll need one to join this room."
            : "This copy of the game is running without accounts configured."}
        </p>
        {accountsEnabled && (
          <Link
            to="/account"
            className="rounded-lg bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30"
          >
            {session ? "Pick a player name" : "Sign in"}
          </Link>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111c] text-zinc-400">
        Finding the room…
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#07111c] px-6 text-center">
        <p className="text-zinc-100">
          {error ?? actionError ?? "That room has closed."}
        </p>
        <Link
          to="/play-together"
          className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100"
        >
          Back
        </Link>
      </div>
    );
  }

  const typeLabel =
    GAME_TYPES.find((t) => t.id === room.game_type)?.label ?? room.game_type;
  const modeName = MODES.find((m) => m.id === room.mode_id)?.name ?? room.mode_id;

  // ---- Lobby ----------------------------------------------------------------
  if (room.status === "lobby") {
    return (
      <div className="min-h-screen bg-[#07111c] px-5 py-10">
        <main className="mx-auto w-full max-w-md">
          <button
            onClick={quit}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            ← Leave
          </button>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
            Waiting room
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {typeLabel} · {modeName} · {MATCH_ROUNDS} countries
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Room code
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-[0.3em] text-zinc-50">
              {room.code}
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              Send it to whoever you're playing.
            </p>
          </div>

          <ul className="mt-6 divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {table.map((player) => (
              <li
                key={player.user_id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <Flag code={names[player.user_id]?.country ?? null} />
                <span className="text-zinc-100">
                  {names[player.user_id]?.name ?? "…"}
                </span>
                {player.user_id === room.host_id && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-400">
                    host
                  </span>
                )}
                {player.user_id === me && (
                  <span className="text-xs text-sky-300/70">you</span>
                )}
              </li>
            ))}
          </ul>

          {isHost ? (
            <>
              <button
                onClick={begin}
                disabled={busy || players.length < 2 || !features.length}
                className="mt-6 w-full rounded-lg bg-sky-500/20 py-2.5 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30 disabled:opacity-40"
              >
                {busy ? "Starting…" : "Start the match"}
              </button>
              {players.length < 2 && (
                <p className="mt-2.5 text-center text-sm text-zinc-600">
                  Waiting for someone to join.
                </p>
              )}
            </>
          ) : (
            <p className="mt-6 text-center text-sm text-zinc-500">
              Waiting for the host to start.
            </p>
          )}

          {actionError && (
            <p className="mt-4 text-center text-sm text-rose-300">{actionError}</p>
          )}
        </main>
      </div>
    );
  }

  // ---- Results --------------------------------------------------------------
  if (room.status === "done") {
    const winner = table[0];
    const drawn = table.filter((p) => p.rank === 1).length > 1;
    return (
      <div className="min-h-screen bg-[#07111c] px-5 py-10">
        <main className="mx-auto w-full max-w-md">
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
            {drawn
              ? "A draw"
              : winner?.user_id === me
                ? "You won"
                : `${names[winner?.user_id ?? ""]?.name ?? "They"} won`}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {typeLabel} · {modeName} · {room.questions.length} countries
          </p>

          <ul className="mt-7 divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {table.map((player) => (
              <li
                key={player.user_id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  player.user_id === me ? "bg-sky-400/[0.07]" : ""
                }`}
              >
                <span className="w-5 shrink-0 text-right tabular-nums text-zinc-500">
                  {player.rank}
                </span>
                <Flag code={names[player.user_id]?.country ?? null} />
                <span className="text-zinc-100">
                  {names[player.user_id]?.name ?? "…"}
                </span>
                <span className="ml-auto tabular-nums font-medium text-zinc-200">
                  {player.score.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>

          {isHost && (
            <button
              onClick={() =>
                void rematch(code).catch((caught) =>
                  setActionError(describeRoomError(caught))
                )
              }
              className="mt-6 w-full rounded-lg bg-sky-500/20 py-2.5 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30"
            >
              Play again
            </button>
          )}
          <button
            onClick={quit}
            className="mt-3 w-full rounded-lg bg-white/5 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/10"
          >
            Leave the room
          </button>
        </main>
        <Celebrate burst={burst} count={100} />
      </div>
    );
  }

  // ---- The match ------------------------------------------------------------
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07111c]">
      {target && features.length > 0 && (
        <MatchGlobe
          features={features}
          target={target}
          type={room.game_type}
          questionIndex={room.current_index}
          locked={Boolean(myAnswer) || left === 0}
          onAnswer={(correct) => void answer(correct)}
        />
      )}

      {/* Scores stay on screen: watching your opponent pull ahead is the game. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        <ul className="flex flex-col gap-1.5">
          {table.map((player) => {
            const answered = answers.some(
              (a) =>
                a.user_id === player.user_id &&
                a.question_index === room.current_index
            );
            return (
              <li
                key={player.user_id}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#141b23]/90 px-2.5 py-1.5 text-sm backdrop-blur"
              >
                <Flag code={names[player.user_id]?.country ?? null} />
                <span
                  className={
                    player.user_id === me ? "text-sky-200" : "text-zinc-200"
                  }
                >
                  {names[player.user_id]?.name ?? "…"}
                </span>
                <span className="ml-1 tabular-nums font-medium text-zinc-100">
                  {player.score}
                </span>
                <span
                  aria-label={answered ? "answered" : "still thinking"}
                  className={`h-1.5 w-1.5 rounded-full ${
                    answered ? "bg-emerald-400" : "bg-zinc-600"
                  }`}
                />
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col items-end gap-2">
          <div className="rounded-lg border border-white/10 bg-[#141b23]/90 px-3 py-1.5 text-sm backdrop-blur">
            <span className="text-zinc-500">
              {room.current_index + 1}/{room.questions.length}
            </span>
            <span
              className={`ml-2.5 tabular-nums font-medium ${
                left <= 5 ? "text-rose-400" : "text-zinc-100"
              }`}
            >
              {left}s
            </span>
          </div>
          {lastAward !== null && (
            <span
              className={`rounded-lg px-2.5 py-1 text-sm font-medium ${
                lastAward > 0
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-rose-400/15 text-rose-300"
              }`}
            >
              {lastAward > 0 ? `+${lastAward}` : "No points"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
