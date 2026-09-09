import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import {
  topScores,
  untilWeekEnd,
  weekStart,
  type BoardRow,
} from "../lib/leaderboard";
import { formatDuration } from "../lib/records";
import {
  GAME_TYPES,
  MODES,
  RULESETS,
  TIME_LIMITS,
  recordKey,
  type GameType,
  type ModeId,
  type Ruleset,
} from "../data/modes";

const pillRow =
  "flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/5 p-1";

function pill(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
    active ? "bg-white/15 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
  }`;
}

/** Gold, silver, bronze, then nothing — a podium only reads as one if it's short. */
function rankColor(rank: number): string {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#cbd5e1";
  if (rank === 3) return "#d97757";
  return "#52525b";
}

function Row({ row, isYou }: { row: BoardRow; isYou: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
        isYou ? "bg-sky-400/[0.07]" : ""
      }`}
    >
      <span
        className="w-6 shrink-0 text-right font-medium tabular-nums"
        style={{ color: rankColor(row.rank) }}
      >
        {row.rank}
      </span>
      {row.country ? (
        <img
          src={`/flags/${row.country}.svg`}
          alt=""
          width={20}
          height={15}
          className="w-5 shrink-0 rounded-[2px]"
        />
      ) : (
        <span aria-hidden="true" className="w-5 shrink-0" />
      )}
      <span className={`truncate ${isYou ? "text-sky-200" : "text-zinc-100"}`}>
        {row.username}
        {isYou && <span className="ml-1.5 text-xs text-sky-300/70">you</span>}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-3 tabular-nums">
        <span className="hidden text-zinc-600 sm:inline">
          {row.found}/{row.total}
        </span>
        <span className="hidden text-zinc-500 sm:inline">
          {formatDuration(row.ms)}
        </span>
        <span className="w-16 text-right font-medium text-zinc-200">
          {row.points.toLocaleString()}
        </span>
      </span>
    </li>
  );
}

export default function Leaderboard() {
  const { profile } = useAuth();
  const [type, setType] = useState<GameType>("name");
  const [modeId, setModeId] = useState<ModeId>("easy");
  const [limit, setLimit] = useState<number | null>(null);
  const [ruleset, setRuleset] = useState<Ruleset>("relaxed");
  const [thisWeek, setThisWeek] = useState(true);

  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bucket = useMemo(
    () => recordKey(type, modeId, limit, ruleset),
    [type, modeId, limit, ruleset]
  );

  useEffect(() => {
    if (!accountsEnabled) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    topScores(bucket, thisWeek ? weekStart() : null, 20)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        // Whatever went wrong upstream, a player can only do one thing about
        // it, so the raw message would just be noise.
        if (!cancelled) {
          setRows([]);
          setError("Couldn't reach the leaderboard. Check your connection.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, thisWeek]);

  const modeName = MODES.find((m) => m.id === modeId)?.name ?? modeId;

  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>

        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Leaderboard
          </h1>
          <div className={pillRow}>
            <button
              onClick={() => setThisWeek(true)}
              className={pill(thisWeek)}
              aria-pressed={thisWeek}
            >
              This week
            </button>
            <button
              onClick={() => setThisWeek(false)}
              className={pill(!thisWeek)}
              aria-pressed={!thisWeek}
            >
              All time
            </button>
          </div>
        </div>

        <p className="mt-2 text-sm text-zinc-500">
          {thisWeek
            ? `${modeName} · everyone starts level again in ${untilWeekEnd()}.`
            : `${modeName} · every run ever posted.`}
        </p>

        {!accountsEnabled ? (
          <p className="mt-6 text-zinc-400">
            This copy of the game is running without accounts configured, so
            there's no board to show.
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-12 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
                  Game
                </span>
                <div className={pillRow}>
                  {GAME_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id)}
                      aria-pressed={type === t.id}
                      className={pill(type === t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-12 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
                  Map
                </span>
                <div className={pillRow}>
                  {MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setModeId(mode.id)}
                      aria-pressed={modeId === mode.id}
                      className={pill(modeId === mode.id)}
                    >
                      {mode.regional ? mode.name : mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-12 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
                  Rules
                </span>
                <div className={pillRow}>
                  {TIME_LIMITS.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => setLimit(option.seconds)}
                      aria-pressed={limit === option.seconds}
                      className={pill(limit === option.seconds)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className={pillRow}>
                  {RULESETS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setRuleset(option.id)}
                      aria-pressed={ruleset === option.id}
                      className={pill(ruleset === option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {rows === null ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  Loading…
                </p>
              ) : rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  {error
                    ? error
                    : thisWeek
                      ? "Nobody has posted a run here this week. Be first."
                      : "Nobody has posted a run here yet. Be first."}
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {rows.map((row) => (
                    <Row
                      key={row.user_id}
                      row={row}
                      isYou={row.user_id === profile?.id}
                    />
                  ))}
                </ul>
              )}
            </div>

            {!profile && (
              <p className="mt-5 text-sm text-zinc-500">
                Your runs are saved on this device already.{" "}
                <Link
                  to="/account"
                  className="text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
                >
                  Pick a name
                </Link>{" "}
                and the next one lands here too.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
