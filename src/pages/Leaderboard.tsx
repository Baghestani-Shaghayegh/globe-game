import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import {
  monthPeriod,
  myStanding,
  overallTop,
  untilWeekEnd,
  weekPeriod,
  type OverallRow,
  type Period,
} from "../lib/leaderboard";
import AdSlot from "../components/AdSlot";
import CrownWall from "../components/CrownWall";
import { crowns as fetchCrowns, type Crown } from "../lib/crowns";
import { playTap } from "../lib/sound";
import { PageShell } from "../components/SiteHeader";

/** How many places the board shows before it stops. */
const BOARD_SIZE = 40;

/**
 * First, second and third, as the thing itself rather than a tinted number.
 *
 * The rank used to be a numeral coloured gold, silver or bronze. At 12px on a
 * dark page that reads as three slightly different greys — and it asks anyone
 * who can't separate those hues to take the game's word for who won. A medal
 * beside the name says it in a glance, and survives a screenshot.
 */
const MEDALS = ["🥇", "🥈", "🥉"] as const;

function Medal({ rank }: { rank: number }) {
  const medal = MEDALS[rank - 1];
  if (!medal) return null;
  return (
    <span aria-label={`rank ${rank}`} className="text-base leading-none">
      {medal}
    </span>
  );
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

/**
 * Where this player finished the period before.
 *
 * The one thing that turns a table into a story: a row that says "#10 last
 * week" is a player climbing, and the board reads as something happening
 * rather than a list of names. Nothing at all for someone who wasn't playing
 * then — "new" would be a guess, and most of the time a wrong one.
 */
function LastTime({ rank, label }: { rank: number | null; label: string }) {
  if (rank === null) return null;
  const medal = MEDALS[rank - 1];
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">
      {medal ? (
        <span aria-hidden="true">{medal}</span>
      ) : (
        <span className="tabular-nums">#{rank}</span>
      )}
      {label}
    </span>
  );
}

/**
 * One place on a board: rank, who, and the number they are ranked by.
 *
 * The rows used to carry a second figure — how many rounds the weekly total
 * came from — and it competed with the number that actually decides the order.
 */
function Row({
  row,
  isYou,
  prevLabel,
}: {
  row: OverallRow;
  isYou: boolean;
  prevLabel: string;
}) {
  return (
    <li
      className={`flex items-center gap-2.5 px-4 py-2.5 text-sm ${
        isYou ? "bg-sky-400/[0.07]" : ""
      }`}
    >
      <span className="w-6 shrink-0 text-right font-medium tabular-nums text-zinc-500">
        {row.rank}
      </span>
      <Medal rank={row.rank} />
      <Flag code={row.country} />
      <span className={`truncate ${isYou ? "text-sky-200" : "text-zinc-100"}`}>
        {row.username}
        {isYou && <span className="ml-1.5 text-xs text-sky-300/70">you</span>}
      </span>
      <LastTime rank={row.prev_rank} label={prevLabel} />
      <span className="ml-auto w-20 shrink-0 text-right font-medium tabular-nums text-zinc-200">
        {row.points.toLocaleString()}
      </span>
    </li>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-6 text-center text-sm text-zinc-500">{children}</p>
  );
}

export default function Leaderboard() {
  const { profile } = useAuth();
  const meId = profile?.id ?? null;

  // Never all time. An all-time table freezes: whoever played most in the
  // first month sits on top of it forever, and a board nobody can climb is one
  // nobody tries at. Both of these turn over.
  const periods = useMemo(() => [weekPeriod(), monthPeriod()], []);
  const [periodId, setPeriodId] = useState<Period["id"]>("week");
  const period = periods.find((p) => p.id === periodId) ?? periods[0];

  const [overall, setOverall] = useState<OverallRow[] | null>(null);
  const [mine, setMine] = useState<OverallRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountsEnabled) return;
    let cancelled = false;
    setOverall(null);
    setMine(null);
    setError(null);

    overallTop(period, BOARD_SIZE)
      .then((top) => !cancelled && setOverall(top))
      .catch(() => {
        if (cancelled) return;
        setOverall([]);
        setError("Couldn't reach the leaderboard. Check your connection.");
      });

    // Their own place, for when it is below the end of the board. A failure
    // here is silent: it costs one row, and the board itself still stands.
    myStanding(period)
      .then((row) => !cancelled && setMine(row))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [period]);

  const [held, setHeld] = useState<Crown[] | null>(null);
  useEffect(() => {
    if (!accountsEnabled) return;
    let cancelled = false;
    fetchCrowns()
      .then((rows) => {
        if (!cancelled) setHeld(rows);
      })
      .catch(() => {
        // A wall that won't load must not take the weekly board down with it.
        if (!cancelled) setHeld([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Two columns once there are enough names to fill them, so a board of forty
  // is one screen rather than a column you scroll past the end of.
  const columns = useMemo(() => {
    if (!overall || overall.length <= 12) return [overall ?? []];
    const half = Math.ceil(overall.length / 2);
    return [overall.slice(0, half), overall.slice(half)];
  }, [overall]);

  const players = overall?.[0]?.players ?? 0;
  const onBoard =
    mine !== null && overall !== null
      ? overall.some((row) => row.user_id === mine.user_id)
      : false;

  return (
    <PageShell>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
        Leaderboard
      </h1>

      <p className="mt-2 text-sm text-zinc-500">
        Points from every round you play, the daily included.{" "}
        {period.id === "week"
          ? `Everyone starts level again in ${untilWeekEnd()}.`
          : "Everyone starts level again on the first of the month."}
      </p>

      {!accountsEnabled ? (
        <p className="mt-6 text-zinc-400">
          This copy of the game is running without accounts configured, so
          there's no board to show.
        </p>
      ) : (
        <>
          {/* Above the weekly board on purpose. "Who scored most this week"
              is not a thing anyone repeats out loud; "fastest person alive
              to name every country" is. */}
          <div className="mt-7">
            <CrownWall crowns={held} meId={meId} />
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div role="tablist" aria-label="Board" className="flex gap-1.5">
              {periods.map((option) => {
                const active = option.id === periodId;
                return (
                  <button
                    key={option.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      playTap();
                      setPeriodId(option.id);
                    }}
                    className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-teal-300/60 bg-teal-300/[0.14] text-teal-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.06] hover:text-zinc-100"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* Proof there is a crowd. One number, and it is the number a
                player is measuring themselves against. */}
            {players > 0 && (
              <span className="text-sm tabular-nums text-zinc-500">
                {players.toLocaleString()}{" "}
                {players === 1 ? "player" : "players"}
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[repeat(auto-fit,minmax(24rem,1fr))]">
            {overall === null ? (
              <Panel>
                <Empty>Loading…</Empty>
              </Panel>
            ) : overall.length === 0 ? (
              <Panel>
                <Empty>
                  {error ?? "Nobody has played yet. Be the first name here."}
                </Empty>
              </Panel>
            ) : (
              columns.map((column, index) => (
                <Panel key={index}>
                  <ul className="divide-y divide-white/[0.05]">
                    {column.map((row) => (
                      <Row
                        key={row.user_id}
                        row={row}
                        isYou={row.user_id === meId}
                        prevLabel={period.prevLabel}
                      />
                    ))}
                  </ul>
                </Panel>
              ))
            )}
          </div>

          {/* Below the board, when they are past the end of it. A player in
              34th used to open this page and find nothing about themselves on
              it at all — the page quietly told them they weren't in the game. */}
          {mine && !onBoard && (
            <div className="mt-3">
              <Panel>
                <ul>
                  <Row row={mine} isYou prevLabel={period.prevLabel} />
                </ul>
              </Panel>
            </div>
          )}

          {!profile && (
            <p className="mt-8 text-sm text-zinc-500">
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

      <AdSlot className="mt-10" />
    </PageShell>
  );
}
