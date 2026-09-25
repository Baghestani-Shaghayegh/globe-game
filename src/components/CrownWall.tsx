import { Link } from "react-router-dom";
import { bestTime, formatDuration } from "../lib/records";
import { CROWN_RUN, type Crown } from "../lib/crowns";
import { gamePath, type GameType } from "../data/modes";
import { Medallion } from "./BadgeMedal";

/**
 * The hall of fame: one holder per crown, held until somebody is faster.
 *
 * The weekly board answers "who played most this week", which nobody brags
 * about. This answers "who can clear the map faster than anyone alive", which
 * is the only claim in the game anyone would repeat out loud.
 *
 * It used to be six cards, all of them the same feat — the whole world, one
 * per game type — and for almost every player that is six things they cannot
 * have. A page of locked doors is not an invitation. The continents are the
 * bottom rung: Oceania is fourteen countries, and somebody's first crown is
 * going to be one of these.
 *
 * Every card says the same three things in the same order: what it takes, who
 * has it, and where you are against them. The last is the one that makes a
 * record feel takeable rather than admirable — "1:21 off" is a thing you can
 * picture closing.
 */

/** A crown, for the medal's face. */
const CROWN_GLYPH = (
  <>
    <path d="M4 17.5h16M4.6 6.2l3.9 3.3L12 4.2l3.5 5.3 3.9-3.3-1.4 9.3H6z" />
    <circle cx="12" cy="2.9" r="1.2" fill="currentColor" stroke="none" />
  </>
);

/** Your own best over every bucket a crown is contested in. */
function myBest(buckets: string[]): number | null {
  const times = buckets
    .map((bucket) => bestTime(bucket)?.ms)
    .filter((ms): ms is number => typeof ms === "number");
  return times.length ? Math.min(...times) : null;
}

/**
 * Where you stand, in the one sentence that decides whether anybody tries.
 *
 * "Nobody yet" on an empty crown is the strongest of the three: an unclaimed
 * record is the only one that can be taken by simply finishing.
 */
function Standing({
  crown,
  mine,
  meId,
}: {
  crown: Crown;
  mine: number | null;
  meId: string | null;
}) {
  const holder = crown.holder;
  const yours = meId !== null && holder?.user_id === meId;

  if (yours) {
    return <span className="text-amber-200/90">This one is yours.</span>;
  }
  if (!holder) {
    return (
      <span className="text-teal-300/90">
        Unclaimed — finish one and it is yours.
      </span>
    );
  }
  if (mine === null) {
    return <span className="text-zinc-500">You haven't finished one yet.</span>;
  }
  if (mine <= holder.ms) {
    // Their run stands until it is beaten outright, so an equal time is not a
    // take — and a faster one that hasn't been posted is a sign-in problem,
    // not a ranking one.
    return (
      <span className="text-zinc-500">
        Your best {formatDuration(mine)} — sign in to put it up.
      </span>
    );
  }
  return (
    <span className="text-zinc-400">
      Your best {formatDuration(mine)} —{" "}
      <span className="text-teal-300">{formatDuration(mine - holder.ms)}</span>{" "}
      off it.
    </span>
  );
}

function Card({
  crown,
  meId,
  loading,
}: {
  crown: Crown;
  meId: string | null;
  loading: boolean;
}) {
  const holder = crown.holder;
  const yours = meId !== null && holder?.user_id === meId;
  const mine = myBest(crown.buckets);

  // Where the card sends you. A world crown is its own game type; a continent
  // is contested in all six, so it opens the one it is named for in the
  // plainest of them.
  const type: GameType = crown.tier === "world" ? (crown.id as GameType) : "name";
  const mode = crown.tier === "world" ? CROWN_RUN.mode : crown.id;

  return (
    <Link
      to={gamePath(type, mode, CROWN_RUN.limit, CROWN_RUN.rules, CROWN_RUN.count)}
      className={`group flex flex-col rounded-xl border p-4 transition-colors ${
        yours
          ? "border-amber-400/45 bg-amber-400/[0.07] hover:border-amber-400/70"
          : holder
            ? "border-white/10 bg-white/[0.03] hover:border-white/30"
            : "border-dashed border-white/[0.14] bg-transparent hover:border-teal-300/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <Medallion
          id={`crown-${crown.id}`}
          lit={holder !== null}
          className="h-12 w-12"
        >
          {CROWN_GLYPH}
        </Medallion>

        <div className="min-w-0 flex-1">
          <p
            className={`font-semibold ${yours ? "text-amber-100" : "text-zinc-100"}`}
          >
            {crown.title}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{crown.feat}</p>
        </div>
      </div>

      {/* The record itself: a name and a time, or the empty throne. */}
      <div className="mt-3.5 flex min-h-[1.75rem] items-center gap-2 border-t border-white/[0.06] pt-3">
        {loading ? (
          <span className="h-4 w-28 animate-pulse rounded bg-white/[0.07]" />
        ) : holder ? (
          <>
            {holder.country && (
              <img
                src={`/flags/${holder.country}.svg`}
                alt=""
                width={20}
                height={15}
                className="w-5 shrink-0 rounded-[2px]"
              />
            )}
            <span className="truncate font-medium text-zinc-50">
              {holder.username}
            </span>
            {crown.tier === "region" && crown.heldIn && (
              <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                {crown.heldIn}
              </span>
            )}
            <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-amber-200">
              {formatDuration(holder.ms)}
            </span>
          </>
        ) : (
          <span className="text-sm text-zinc-600">No holder yet</span>
        )}
      </div>

      <p className="mt-2 text-xs">
        {loading ? (
          <span className="block h-3 w-40 animate-pulse rounded bg-white/[0.05]" />
        ) : (
          <Standing crown={crown} mine={mine} meId={meId} />
        )}
      </p>
    </Link>
  );
}

function Shelf({
  title,
  blurb,
  crowns,
  meId,
  loading,
}: {
  title: string;
  blurb: string;
  crowns: Crown[];
  meId: string | null;
  loading: boolean;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-base font-semibold tracking-tight text-zinc-100">
          {title}
        </h3>
        <p className="text-sm text-zinc-500">{blurb}</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {crowns.map((crown) => (
          <Card key={crown.id} crown={crown} meId={meId} loading={loading} />
        ))}
      </div>
    </section>
  );
}

export default function CrownWall({
  crowns,
  meId,
}: {
  crowns: Crown[] | null;
  meId: string | null;
}) {
  // The catalogue is known before the holders are, so the wall is laid out
  // while they load rather than appearing all at once after them.
  const all = crowns ?? [];
  const loading = crowns === null;

  return (
    <div className="space-y-8">
      <Shelf
        title="The whole world"
        blurb="All 167 countries in one run. Six ways to be asked."
        crowns={all.filter((crown) => crown.tier === "world")}
        meId={meId}
        loading={loading}
      />
      <Shelf
        title="The continents"
        blurb="One continent, any game type. Where a first crown comes from."
        crowns={all.filter((crown) => crown.tier === "region")}
        meId={meId}
        loading={loading}
      />
    </div>
  );
}
