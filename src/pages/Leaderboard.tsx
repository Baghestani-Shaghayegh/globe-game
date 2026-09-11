import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import {
  overallTop,
  untilWeekEnd,
  weekStart,
  type OverallRow,
} from "../lib/leaderboard";
import AdSlot from "../components/AdSlot";

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

/**
 * One place on a board: rank, who, and the number they are ranked by.
 *
 * Nothing else. The rows used to carry a second figure — how many rounds the
 * weekly total came from, how many countries the daily score found — and it
 * competed with the number that actually decides the order.
 */
function Row({
  rank,
  username,
  country,
  isYou,
  headline,
}: {
  rank: number;
  username: string;
  country: string | null;
  isYou: boolean;
  headline: string;
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
      <span className="ml-auto w-20 shrink-0 text-right font-medium tabular-nums text-zinc-200">
        {headline}
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
  const [overall, setOverall] = useState<OverallRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only ever this week. An all-time table freezes: whoever played most in the
  // first month sits on top of it forever, and a board nobody can climb is one
  // nobody tries at. The weekly reset is the board.
  const since = useMemo(() => weekStart(), []);

  useEffect(() => {
    if (!accountsEnabled) return;
    let cancelled = false;
    setOverall(null);
    setError(null);

    overallTop(since, 20)
      .then((top) => !cancelled && setOverall(top))
      .catch(() => {
        if (cancelled) return;
        setOverall([]);
        setError("Couldn't reach the leaderboard. Check your connection.");
      });

    return () => {
      cancelled = true;
    };
  }, [since]);

  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Leaderboard
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          Points from every round you play, the daily included. Everyone starts
          level again in {untilWeekEnd()}.
        </p>

        {!accountsEnabled ? (
          <p className="mt-6 text-zinc-400">
            This copy of the game is running without accounts configured, so
            there's no board to show.
          </p>
        ) : (
          <>
            <div className="mt-5">
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
                      />
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

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
      </main>
    </div>
  );
}
