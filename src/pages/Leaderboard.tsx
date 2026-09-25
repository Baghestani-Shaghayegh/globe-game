import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import {
  monthPeriod,
  myStanding,
  overallTop,
  weekPeriod,
  type OverallRow,
  type Period,
} from "../lib/leaderboard";
import AdSlot from "../components/AdSlot";
import CrownWall from "../components/CrownWall";
import { crowns as fetchCrowns, type Crown } from "../lib/crowns";
import { playTap } from "../lib/sound";
import { PageShell } from "../components/SiteHeader";
import { TabButton, TabRow } from "../components/Tabs";

/** How many places one page of the board holds. */
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
 *
 * Both are centred in the cell rather than flushed right, so a numeral sits
 * under the middle of the medals above it. Right-aligned, a "4" landed under
 * the medal's right edge and the column read as two columns.
 */
function Rank({ rank }: { rank: number }) {
  const medal = MEDALS[rank - 1];
  return (
    <span className="flex w-9 shrink-0 items-center justify-center">
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
 * One place on a board: rank, who, and the number they are ranked by.
 *
 * The rows used to carry a second figure — how many rounds the weekly total
 * came from — and it competed with the number that actually decides the order.
 *
 * They also carried a "#10 last week" chip. It said the same kind of thing as
 * the gain under the total — this player is moving — only slower and a week
 * late, and between the two the row had rank, medal, flag, name, chip, total
 * and gain on it. The faster of the two signals stayed.
 */
function Row({ row, isYou }: { row: OverallRow; isYou: boolean }) {
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
      className={`flex items-center gap-2.5 py-2.5 pr-4 text-sm ${sheen} ${
        isYou
          ? // A tint alone was not enough to find yourself in a page of forty
            // — it reads as a slightly different grey at arm's length. The bar
            // down the left edge is what the eye catches when scanning.
            "border-l-[3px] border-sky-400 bg-sky-400/[0.10] pl-[calc(1rem-3px)]"
          : "border-l-[3px] border-transparent pl-[calc(1rem-3px)]"
      }`}
    >
      <Rank rank={row.rank} />
      <Flag code={row.country} />
      <span className={`truncate ${isYou ? "text-sky-200" : "text-zinc-100"}`}>
        {row.username}
        {isYou && <span className="ml-1.5 text-xs text-sky-300/70">you</span>}
      </span>
      {/* The total for the window, and under it what they have added today.
          The total says who is ahead; the gain says who is moving, which is
          the half that makes a table worth opening twice in a day.

          Nothing on a day somebody hasn't played, and nothing when the gain
          is the whole total either: on a Monday morning everything in the
          weekly window was earned today, and a board where every row reads
          "3,364" over "+3,364" has printed one number twice. */}
      <span className="ml-auto w-24 shrink-0 text-right">
        <span className="block font-medium tabular-nums text-zinc-200">
          {row.points.toLocaleString()}
        </span>
        {row.today_points > 0 && row.today_points < row.points && (
          <span className="block text-xs font-medium tabular-nums text-emerald-400/90">
            +{row.today_points.toLocaleString()}
          </span>
        )}
      </span>
    </li>
  );
}

/** 1st, 2nd, 3rd, 4th — and 11th through 13th, which break the rule. */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {children}
    </div>
  );
}

/**
 * Back and forward through a board too long to print at once.
 *
 * Only the two arrows and the count. Numbered page links are for a board you
 * would jump around in; a leaderboard is read from the top, and the one page
 * anybody wants that isn't this one is the one with them on it — which is
 * pinned under the board whatever page is open.
 */
function Pager({
  page,
  pages,
  onGo,
}: {
  page: number;
  pages: number;
  onGo: (next: number) => void;
}) {
  const step = (delta: number) => () => {
    playTap();
    onGo(Math.min(pages - 1, Math.max(0, page + delta)));
  };

  const arrow = (disabled: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
      disabled
        ? "cursor-not-allowed border-white/[0.07] text-zinc-700"
        : "border-white/15 text-zinc-300 hover:border-white/35 hover:text-zinc-100"
    }`;

  return (
    <nav
      aria-label="Board pages"
      className="mt-4 flex items-center justify-center gap-3 text-sm"
    >
      <button
        onClick={step(-1)}
        disabled={page === 0}
        aria-label="Previous page"
        className={arrow(page === 0)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m14.5 5-7 7 7 7" />
        </svg>
      </button>

      <p aria-live="polite" className="tabular-nums text-zinc-400">
        <span className="rounded-lg border border-white/15 px-3 py-1.5 text-zinc-100">
          {page + 1}
        </span>{" "}
        <span className="text-zinc-600">/</span> {pages}
      </p>

      <button
        onClick={step(1)}
        disabled={page >= pages - 1}
        aria-label="Next page"
        className={arrow(page >= pages - 1)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9.5 5 7 7-7 7" />
        </svg>
      </button>
    </nav>
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
  const [page, setPage] = useState(0);

  // A new board starts at its own top. Without this, switching from page 4 of
  // the month to the week asks for an offset the week may not have.
  useEffect(() => setPage(0), [periodId]);

  useEffect(() => {
    if (!accountsEnabled) return;
    let cancelled = false;
    setOverall(null);
    setError(null);

    overallTop(period, BOARD_SIZE, page * BOARD_SIZE)
      .then((top) => !cancelled && setOverall(top))
      .catch(() => {
        if (cancelled) return;
        setOverall([]);
        setError("Couldn't reach the leaderboard. Check your connection.");
      });

    return () => {
      cancelled = true;
    };
  }, [period, page]);

  // Their own place, whichever page is open. Fetched once per board rather
  // than once per page, because it does not change as you turn them. A
  // failure here is silent: it costs one row, and the board still stands.
  useEffect(() => {
    if (!accountsEnabled) return;
    let cancelled = false;
    setMine(null);
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
  const pages = Math.max(1, Math.ceil(players / BOARD_SIZE));

  // Named after the window it covers, not after the tab. The month reads off
  // the period's own start date in UTC — the same midnight the board is
  // ranked from, so the name can't drift a day either side of the first.
  const board = useMemo((): { title: string; blurb?: string } => {
    if (tab === "fame") {
      return {
        title: "Hall of fame",
        blurb: "Fastest to clear all 167 — held until somebody is quicker.",
      };
    }
    // No line under this one. A board headed "This week" has said everything
    // a second sentence was going to: where the points come from is the same
    // on every board, and when the week turns over is not what anyone came
    // here to read.
    if (period.id === "week") return { title: "This week" };
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
            {board.blurb && (
              <p className="mt-1 text-sm text-zinc-500">{board.blurb}</p>
            )}
            {tab !== "fame" && players > 0 && (
              <p className="mt-1 text-sm tabular-nums text-zinc-500">
                {players.toLocaleString()}{" "}
                {players === 1 ? "player" : "players"}
              </p>
            )}
            {/* Where you are, whichever page is open. The row itself may be
                on this page, on the fourth, or pinned under the board; this
                answers the question without any of that mattering. */}
            {tab !== "fame" && mine && (
              <p className="mt-1.5 text-sm text-sky-300/80">
                You&rsquo;re{" "}
                <span className="font-medium tabular-nums">
                  {ordinal(mine.rank)}
                </span>{" "}
                of {players.toLocaleString()}
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
                      />
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )}

          {tab !== "fame" && pages > 1 && (
            <Pager page={page} pages={pages} onGo={setPage} />
          )}

          {/* Below the board, when they are past the end of it. A player in
              34th used to open this page and find nothing about themselves on
              it at all — the page quietly told them they weren't in the game. */}
          {tab !== "fame" && mine && !onBoard && (
            <div className="mt-3">
              {/* The gap between the end of this page and wherever they are.
                  Without it the row reads as the next place along. */}
              <p aria-hidden="true" className="pb-2 text-center text-zinc-700">
                · · ·
              </p>
              <Panel>
                <ul>
                  <Row row={mine} isYou />
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
