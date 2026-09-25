import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  allBuckets,
  formatDuration,
  isComplete,
  type Bucket,
} from "../lib/records";
import { CROWN_RUN, type Crown } from "../lib/crowns";
import { gamePath, type GameType } from "../data/modes";

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

/**
 * The crown itself, with no disc behind it.
 *
 * Badges are struck medals, and a crown sitting inside one was a crown
 * pretending to be a badge — the same object twice, on two pages that hand out
 * different things. A crown is already a shape; it does not need a coin to sit
 * on to be read as an award.
 *
 * Gold and filled when somebody holds it, drawn in outline when nobody does —
 * the same "here but not yours yet" the locked badges use, minus the metal.
 */
function CrownMark({ held, id }: { held: boolean; id: string }) {
  const gold = `crown-${id}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-9 w-9 shrink-0"
      fill="none"
    >
      {held && (
        <defs>
          <linearGradient id={gold} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="55%" stopColor="#f0b429" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
      )}

      <path
        d="M2.4 6.6 7 11.3 12 3.4l5 7.9 4.6-4.7-1.5 11.1H3.9z"
        fill={held ? `url(#${gold})` : "none"}
        stroke={held ? "#fef3c7" : "#4b5563"}
        strokeWidth={held ? 0.9 : 1.6}
        strokeLinejoin="round"
      />
      <path
        d="M4.6 20.4h14.8"
        stroke={held ? "#fde68a" : "#4b5563"}
        strokeWidth={held ? 2 : 1.6}
        strokeLinecap="round"
      />

      {/* Three stones, only on a crown somebody actually holds. */}
      {held && (
        <>
          <circle cx="7" cy="14.4" r="1" fill="#7c2d12" opacity="0.5" />
          <circle cx="12" cy="13.8" r="1.2" fill="#7c2d12" opacity="0.5" />
          <circle cx="17" cy="14.4" r="1" fill="#7c2d12" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

/**
 * Your own best against a crown, from the runs already on this device.
 *
 * A time for the eleven stopwatches, lowest wins; a streak for the one that
 * isn't, highest wins. Returned as a bare number either way, since the only
 * thing the card does with it is compare and format.
 */
function myBest(
  crown: Crown,
  buckets: Bucket[]
): { best: number | null; hintedOnly: boolean } {
  // Hinted runs are out, the same as they are on the server. A card that says
  // "2:56 off it" about a run that could never hold the crown is a lie with a
  // number in it. But having played and having played clean are two different
  // answers, so the card is told which one this is.
  const unaided = (run: { hintsUsed?: number }) => (run.hintsUsed ?? 0) === 0;
  const runs = buckets.flatMap((bucket) =>
    crown.metric === "streak" || new Set(crown.buckets).has(bucket.key)
      ? bucket.runs
      : []
  );

  if (crown.metric === "streak") {
    const streaked = runs.filter((run) => (run.bestStreak ?? 0) > 0);
    const clean = streaked.filter(unaided);
    const best = clean.reduce((most, run) => Math.max(most, run.bestStreak ?? 0), 0);
    return {
      best: best > 0 ? best : null,
      hintedOnly: best === 0 && streaked.length > 0,
    };
  }

  const cleared = runs.filter(isComplete);
  const clean = cleared.filter(unaided);
  return {
    best: clean.length ? Math.min(...clean.map((run) => run.ms)) : null,
    hintedOnly: clean.length === 0 && cleared.length > 0,
  };
}

/** A record, in whatever it is measured in. */
function reading(crown: Crown, value: number): string {
  return crown.metric === "streak"
    ? `${value} in a row`
    : formatDuration(value);
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
  hintedOnly,
  meId,
}: {
  crown: Crown;
  mine: number | null;
  hintedOnly: boolean;
  meId: string | null;
}) {
  const holder = crown.holder;
  const yours = meId !== null && holder?.user_id === meId;
  const theirs = holder
    ? crown.metric === "streak"
      ? (holder.best_streak ?? 0)
      : holder.ms
    : 0;

  if (yours) {
    return <span className="text-amber-200/90">This one is yours.</span>;
  }
  if (!holder) {
    // Two words, where there were nine. The row above already says there is no
    // holder, so this line only has to be the thing you press.
    return (
      <span className="font-medium text-teal-300 group-hover:underline">
        Claim it
      </span>
    );
  }
  if (mine === null) {
    // Having played it and having played it clean are different answers, and
    // the second is the one where somebody would otherwise wonder why their
    // run isn't counted.
    if (hintedOnly) {
      return (
        <span className="text-zinc-500">
          {crown.metric === "streak"
            ? "Your streaks were set with hints — crowns don't count those."
            : "You cleared it with hints — crowns don't count those."}
        </span>
      );
    }
    return (
      <span className="text-zinc-500">
        {crown.metric === "streak"
          ? "No streak of yours yet."
          : "You haven't cleared this map yet."}
      </span>
    );
  }

  // Beaten outright or not at all: a matched record stays with whoever set it
  // first. Anything better than theirs that isn't on the board is a sign-in
  // problem rather than a ranking one.
  const ahead = crown.metric === "streak" ? mine > theirs : mine < theirs;
  if (ahead) {
    return (
      <span className="text-zinc-500">
        Your best {reading(crown, mine)} — sign in to put it up.
      </span>
    );
  }

  const gap =
    crown.metric === "streak"
      ? `${theirs - mine + 1} more`
      : `${formatDuration(mine - theirs)} off it`;

  return (
    <span className="text-zinc-400">
      Your best {reading(crown, mine)} —{" "}
      <span className="text-teal-300">{gap}</span>
      {crown.metric === "streak" ? " to beat it." : "."}
    </span>
  );
}

function Card({
  crown,
  meId,
  loading,
  buckets,
}: {
  crown: Crown;
  meId: string | null;
  loading: boolean;
  buckets: Bucket[];
}) {
  const holder = crown.holder;
  const yours = meId !== null && holder?.user_id === meId;
  const { best: mine, hintedOnly } = myBest(crown, buckets);

  // Where the card sends you. A world crown is its own game type; a continent
  // is contested in all six, so it opens the one it is named for in the
  // plainest of them.
  // Where the card sends you. A world crown for one game type is its own; the
  // full map, a continent and the streak are contested everywhere, so they
  // open the plainest game type on the list they are named for.
  const spans = crown.buckets.length !== 1;
  const type: GameType = spans ? "name" : (crown.id as GameType);
  const mode =
    crown.tier === "region" ? crown.id : crown.id === "hard" ? "hard" : CROWN_RUN.mode;

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
        <CrownMark id={crown.id} held={holder !== null} />

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
            {crown.heldIn && crown.buckets.length > 1 && (
              <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                {crown.heldIn}
              </span>
            )}
            {/* Labelled, because a bare "8:32" beside a name is a number
                without a noun — it could be how long ago they played, or how
                long they have held it. */}
            <span className="ml-auto flex shrink-0 items-baseline gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-zinc-600">
                Record
              </span>
              <span className="font-mono text-sm tabular-nums text-amber-200">
                {reading(
                  crown,
                  crown.metric === "streak" ? (holder.best_streak ?? 0) : holder.ms
                )}
              </span>
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
          <Standing
            crown={crown}
            mine={mine}
            hintedOnly={hintedOnly}
            meId={meId}
          />
        )}
      </p>
    </Link>
  );
}

function Shelf({
  title,
  crowns,
  meId,
  loading,
  buckets,
}: {
  title: string;
  crowns: Crown[];
  meId: string | null;
  loading: boolean;
  buckets: Bucket[];
}) {
  return (
    <section>
      {/* A heading and the cards. Both shelves carried a line explaining
          themselves, and both were explaining six cards that say it on their
          own faces. */}
      <h3 className="text-base font-semibold tracking-tight text-zinc-100">
        {title}
      </h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {crowns.map((crown) => (
          <Card
            key={crown.id}
            crown={crown}
            meId={meId}
            loading={loading}
            buckets={buckets}
          />
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
  // Read once for the whole wall rather than once per card: eleven cards
  // parsing the same store eleven times would also be eleven chances to
  // disagree with each other mid-render.
  const buckets = useMemo(() => allBuckets(), []);

  return (
    <div className="space-y-8">
      <Shelf
        title="The whole world"
        crowns={all.filter((crown) => crown.tier === "world")}
        meId={meId}
        loading={loading}
        buckets={buckets}
      />
      <Shelf
        title="The continents"
        crowns={all.filter((crown) => crown.tier === "region")}
        meId={meId}
        loading={loading}
        buckets={buckets}
      />
      <Shelf
        title="The longest run"
        crowns={all.filter((crown) => crown.tier === "streak")}
        meId={meId}
        loading={loading}
        buckets={buckets}
      />
    </div>
  );
}
