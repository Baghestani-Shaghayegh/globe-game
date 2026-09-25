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
import { PageShell } from "../components/SiteHeader";
import { TabButton, TabRow } from "../components/Tabs";

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

/**
 * The place, as a medal for the top three and a numeral for everyone else.
 *
 * The first three rows used to carry both — a small grey "1" and a medal
 * beside it, saying the same thing twice in two alphabets. The medal is the
 * louder of the two and the one that survives a screenshot, so it takes the
 * whole cell and grows into it. The label keeps the rank readable to a screen
 * reader, which an emoji on its own is not.
 */
function Rank({ rank }: { rank: number }) {
  const medal = MEDALS[rank - 1];
  return (
    <span className="flex w-9 shrink-0 items-center justify-end">
      {medal ? (
        <span aria-label={`rank ${rank}`} className="text-2xl leading-none">
          {medal}
        </span>
      ) : (
        <span className="font-medium tabular-nums text-zinc-500">{rank}</span>
      )}
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
  // The podium catches the light. Gold gets its own, warmer sweep; fourth
  // place down gets none, which is what makes the top three look like the
  // top three from across the room.
  const sheen =
    row.rank === 1
      ? "shine shine-gold"
      : row.rank <= 3
        ? "shine"
        : "";

  return (
    <li
      className={`flex items-center gap-2.5 px-4 py-2.5 text-sm ${sheen} ${
        isYou ? "bg-sky-400/[0.07]" : ""
      }`}
    >
      <Rank rank={row.rank} />
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
  // The hall of fame is a third tab rather than a block above the board. It
  // used to sit on top of both boards, which meant the page opened on six
  // cards and you scrolled to reach the thing the page is named after.
  const [tab, setTab] = useState<Period["id"] | "fame">("week");
  const periodId: Period["id"] = tab === "fame" ? "week" : tab;
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

  // Two players to a row, so a board of forty is one screen rather than a
  // column you scroll past the end of. Split at any length: the column widths
  // are the same either way, and a board that changes shape at the twelfth
  // player looks like two different pages.
  const columns = useMemo(() => {
    if (!overall?.length) return [];
    const half = Math.ceil(overall.length / 2);
    return [overall.slice(0, half), overall.slice(half)].filter(
      (column) => column.length > 0
    );
  }, [overall]);

  const players = overall?.[0]?.players ?? 0;

  // Named after the window it covers, not after the tab. The month reads off
  // the period's own start date in UTC — the same midnight the board is
  // ranked from, so the name can't drift a day either side of the first.
  const board = useMemo(() => {
    if (tab === "fame") {
      return {
        title: "Hall of fame",
        blurb: "Fastest to clear all 167 — held until somebody is quicker.",
      };
    }
    if (period.id === "week") {
      return {
        title: "This week's leaderboard",
        blurb: `Cumulative rankings since Monday. Everyone starts level again in ${untilWeekEnd()}.`,
      };
    }
    const month = period.since.toLocaleDateString(undefined, {
      month: "long",
      timeZone: "UTC",
    });
    return {
      title: `${month} leaderboard`,
      blurb: `Cumulative rankings since ${month} 1st.`,
    };
  }, [tab, period]);
  const onBoard =
    mine !== null && overall !== null
      ? overall.some((row) => row.user_id === mine.user_id)
      : false;

  return (
    <PageShell>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
        Leaderboard
      </h1>

      {!accountsEnabled ? (
        <p className="mt-6 text-zinc-400">
          This copy of the game is running without accounts configured, so
          there's no board to show.
        </p>
      ) : (
        <>
          <TabRow label="Board" tablist>
            {periods.map((option) => (
              <TabButton
                key={option.id}
                active={tab === option.id}
                onClick={() => setTab(option.id)}
              >
                {option.label}
              </TabButton>
            ))}
            <TabButton active={tab === "fame"} onClick={() => setTab("fame")}>
              Hall of fame
            </TabButton>
          </TabRow>

          {/* What you are looking at, under the tab that chose it. "This
              month" names the tab; "September leaderboard" names the board,
              which is the thing a player would say out loud. The count is
              proof there is a crowd, and the number they are measuring
              themselves against. */}
          <div className="mt-6 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
              {board.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{board.blurb}</p>
            {tab !== "fame" && players > 0 && (
              <p className="mt-1 text-sm tabular-nums text-zinc-500">
                {players.toLocaleString()}{" "}
                {players === 1 ? "player" : "players"}
              </p>
            )}
          </div>

          {tab === "fame" ? (
            <div className="mt-6">
              <CrownWall crowns={held} meId={meId} />
            </div>
          ) : overall === null ? (
            <div className="mt-6">
              <Panel>
                <Empty>Loading…</Empty>
              </Panel>
            </div>
          ) : overall.length === 0 ? (
            <div className="mt-6">
              <Panel>
                <Empty>
                  {error ?? "Nobody has played yet. Be the first name here."}
                </Empty>
              </Panel>
            </div>
          ) : (
            // Two to a row wherever there is room for them.
            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {columns.map((column, index) => (
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
              ))}
            </div>
          )}

          {/* Below the board, when they are past the end of it. A player in
              34th used to open this page and find nothing about themselves on
              it at all — the page quietly told them they weren't in the game. */}
          {tab !== "fame" && mine && !onBoard && (
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
