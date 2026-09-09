import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { refresh, tally, type Earned } from "../lib/achievements";

function when(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Badge({ badge }: { badge: Earned }) {
  const share = badge.need > 0 ? Math.min(1, badge.have / badge.need) : 0;
  const showBar = !badge.unlocked && badge.need > 1 && badge.have > 0;

  return (
    <li
      className={`rounded-xl border p-4 transition-colors ${
        badge.unlocked
          ? "border-amber-300/25 bg-amber-300/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`text-2xl leading-none ${badge.unlocked ? "" : "opacity-25 grayscale"}`}
        >
          {badge.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`font-medium ${
              badge.unlocked ? "text-amber-100" : "text-zinc-400"
            }`}
          >
            {badge.name}
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">{badge.desc}</p>

          {showBar && (
            <div className="mt-2.5 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]"
              >
                <span
                  className="block h-full rounded-full bg-zinc-500"
                  style={{ width: `${share * 100}%` }}
                />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-600">
                {badge.have}/{badge.need}
              </span>
            </div>
          )}

          {badge.unlocked && badge.at && (
            <p className="mt-1.5 text-xs tabular-nums text-amber-200/40">
              {when(badge.at)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export default function Achievements() {
  // Scored once on mount, which is also when anything newly earned is stamped.
  const [badges] = useState<Earned[]>(() => refresh());
  const counts = useMemo(() => tally(badges), [badges]);

  // Earned first — the page should open on what you've done, not what you haven't.
  const ordered = useMemo(
    () => [...badges].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)),
    [badges]
  );

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
            Badges
          </h1>
          <span className="tabular-nums text-zinc-400">
            {counts.unlocked} of {counts.total}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]"
          >
            <span
              className="block h-full rounded-full bg-amber-300/70"
              style={{ width: `${(counts.unlocked / counts.total) * 100}%` }}
            />
          </span>
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          Counted from everything you've already played — badges you'd earned
          before this page existed are here too.
        </p>

        <ul className="mt-7 grid gap-3 sm:grid-cols-2">
          {ordered.map((badge) => (
            <Badge key={badge.id} badge={badge} />
          ))}
        </ul>
      </main>
    </div>
  );
}
