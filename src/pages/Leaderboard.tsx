import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import {
  activeBoards,
  dayStart,
  describeBucket,
  isDailyBucket,
  overallTop,
  topScores,
  untilWeekEnd,
  weekStart,
  type ActiveBoard,
  type BoardRow,
  type OverallRow,
} from "../lib/leaderboard";
import { formatDuration } from "../lib/records";

/** Gold, silver, bronze, then nothing — a podium only reads as one if it's short. */
function rankColor(rank: number): string {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#cbd5e1";
  if (rank === 3) return "#d97757";
  return "#52525b";
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

function Row({
  rank,
  username,
  country,
  isYou,
  headline,
  detail,
}: {
  rank: number;
  username: string;
  country: string | null;
  isYou: boolean;
  headline: string;
  detail?: string;
}) {
  return (
    <li
      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
        isYou ? "bg-sky-400/[0.07]" : ""
      }`}
    >
      <span
        className="w-6 shrink-0 text-right font-medium tabular-nums"
        style={{ color: rankColor(rank) }}
      >
        {rank}
      </span>
      <Flag code={country} />
      <span className={`truncate ${isYou ? "text-sky-200" : "text-zinc-100"}`}>
        {username}
        {isYou && <span className="ml-1.5 text-xs text-sky-300/70">you</span>}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-3 tabular-nums">
        {detail && (
          <span className="hidden text-zinc-600 sm:inline">{detail}</span>
        )}
        <span className="w-20 text-right font-medium text-zinc-200">
          {headline}
        </span>
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

/** One per-bucket board, opened from the list below the headline one. */
function BucketBoard({
  bucket,
  since,
  meId,
}: {
  bucket: string;
  since: Date | null;
  meId: string | null;
}) {
  const [rows, setRows] = useState<BoardRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    topScores(bucket, since, 10)
      .then((data) => !cancelled && setRows(data))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [bucket, since]);

  if (rows === null) return <Empty>Loading…</Empty>;
  if (!rows.length) return <Empty>Nothing here yet.</Empty>;

  return (
    <ul className="divide-y divide-white/[0.05]">
      {rows.map((row) => (
        <Row
          key={row.user_id}
          rank={row.rank}
          username={row.username}
          country={row.country}
          isYou={row.user_id === meId}
          headline={row.points.toLocaleString()}
          detail={`${row.found}/${row.total} · ${formatDuration(row.ms)}`}
        />
      ))}
    </ul>
  );
}

export default function Leaderboard() {
  const { profile } = useAuth();
  const meId = profile?.id ?? null;
  const [thisWeek, setThisWeek] = useState(true);
  const [overall, setOverall] = useState<OverallRow[] | null>(null);
  const [boards, setBoards] = useState<ActiveBoard[]>([]);
  const [daily, setDaily] = useState<BoardRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const since = useMemo(() => (thisWeek ? weekStart() : null), [thisWeek]);

  useEffect(() => {
    if (!accountsEnabled) return;
    let cancelled = false;
    setOverall(null);
    setError(null);
    setOpen(null);

    Promise.all([overallTop(since, 20), activeBoards(since)])
      .then(([top, active]) => {
        if (cancelled) return;
        setOverall(top);
        setBoards(active);
      })
      .catch(() => {
        if (cancelled) return;
        setOverall([]);
        setBoards([]);
        setError("Couldn't reach the leaderboard. Check your connection.");
      });

    return () => {
      cancelled = true;
    };
  }, [since]);

  // Today's daily is its own board: everyone played the identical round, which
  // makes it the fairest comparison the game has.
  const todaysDaily = boards.find((board) => isDailyBucket(board.bucket));
  useEffect(() => {
    if (!todaysDaily) {
      setDaily(null);
      return;
    }
    let cancelled = false;
    topScores(todaysDaily.bucket, dayStart(), 10)
      .then((rows) => !cancelled && setDaily(rows))
      .catch(() => !cancelled && setDaily([]));
    return () => {
      cancelled = true;
    };
  }, [todaysDaily]);

  const otherBoards = boards.filter((board) => !isDailyBucket(board.bucket));

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
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            {[true, false].map((weekly) => (
              <button
                key={String(weekly)}
                onClick={() => setThisWeek(weekly)}
                aria-pressed={thisWeek === weekly}
                className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
                  thisWeek === weekly
                    ? "bg-white/15 text-zinc-50"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {weekly ? "This week" : "All time"}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-2 text-sm text-zinc-500">
          {thisWeek
            ? `Points from every round you play. Everyone starts level again in ${untilWeekEnd()}.`
            : "Points from every round ever played."}
        </p>

        {!accountsEnabled ? (
          <p className="mt-6 text-zinc-400">
            This copy of the game is running without accounts configured, so
            there's no board to show.
          </p>
        ) : (
          <>
            <div className="mt-6">
              <Panel>
                {overall === null ? (
                  <Empty>Loading…</Empty>
                ) : overall.length === 0 ? (
                  <Empty>
                    {error ?? "Nobody has played yet. Be the first name here."}
                  </Empty>
                ) : (
                  <ul className="divide-y divide-white/[0.05]">
                    {overall.map((row) => (
                      <Row
                        key={row.user_id}
                        rank={row.rank}
                        username={row.username}
                        country={row.country}
                        isYou={row.user_id === meId}
                        headline={row.points.toLocaleString()}
                        detail={`${row.runs} ${row.runs === 1 ? "round" : "rounds"}`}
                      />
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            {daily && daily.length > 0 && (
              <section className="mt-9">
                <div className="flex items-baseline gap-3 px-1">
                  <h2 className="text-sm uppercase tracking-wider text-zinc-500">
                    Today's daily
                  </h2>
                  <span className="text-xs text-zinc-600">
                    the same ten countries for everyone
                  </span>
                </div>
                <div className="mt-2">
                  <Panel>
                    <ul className="divide-y divide-white/[0.05]">
                      {daily.map((row) => (
                        <Row
                          key={row.user_id}
                          rank={row.rank}
                          username={row.username}
                          country={row.country}
                          isYou={row.user_id === meId}
                          headline={row.points.toLocaleString()}
                          detail={`${row.found}/${row.total}`}
                        />
                      ))}
                    </ul>
                  </Panel>
                </div>
              </section>
            )}

            {otherBoards.length > 0 && (
              <section className="mt-9">
                <div className="flex items-baseline gap-3 px-1">
                  <h2 className="text-sm uppercase tracking-wider text-zinc-500">
                    By mode
                  </h2>
                  <span className="text-xs text-zinc-600">
                    best single run
                  </span>
                </div>

                <ul className="mt-2 flex flex-col gap-2">
                  {otherBoards.map((board) => {
                    const showing = open === board.bucket;
                    return (
                      <li key={board.bucket}>
                        <Panel>
                          <button
                            onClick={() =>
                              setOpen(showing ? null : board.bucket)
                            }
                            aria-expanded={showing}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/[0.03]"
                          >
                            <span className="min-w-0 truncate text-zinc-100">
                              {describeBucket(board.bucket)}
                            </span>
                            <span className="ml-auto flex shrink-0 items-center gap-3 tabular-nums text-xs text-zinc-600">
                              <span>
                                {board.players}{" "}
                                {board.players === 1 ? "player" : "players"}
                              </span>
                              <span
                                aria-hidden="true"
                                className={`transition-transform ${showing ? "rotate-90" : ""}`}
                              >
                                ›
                              </span>
                            </span>
                          </button>
                          {showing && (
                            <div className="border-t border-white/[0.07]">
                              <BucketBoard
                                bucket={board.bucket}
                                since={since}
                                meId={meId}
                              />
                            </div>
                          )}
                        </Panel>
                      </li>
                    );
                  })}
                </ul>
              </section>
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
      </main>
    </div>
  );
}
