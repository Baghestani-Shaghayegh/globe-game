import { Link } from "react-router-dom";
import { formatDuration } from "../lib/records";
import { crownFeat, CROWN_RUN, type Crown } from "../lib/crowns";
import { GAME_TYPES, gamePath } from "../data/modes";

/**
 * The hall of fame: one name per crown, held until somebody is faster.
 *
 * Above the weekly board rather than below it, because this is the thing
 * worth screenshotting. The weekly board answers "who played most this week",
 * which nobody brags about; this answers "who can name every country on earth
 * faster than anyone alive", which is the only claim in the game anyone would
 * repeat out loud.
 *
 * An unclaimed crown is shown, not hidden. A vacant throne with "nobody yet"
 * on it is an invitation; an absent card is nothing at all.
 */
export default function CrownWall({
  crowns,
  meId,
}: {
  crowns: Crown[] | null;
  meId: string | null;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
          Hall of fame
        </h2>
        <p className="text-sm text-zinc-500">
          Fastest to clear all 167 — held until somebody is quicker.
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(crowns ?? []).map((crown) => {
          const mine = crown.holder?.user_id === meId && meId !== null;
          return (
            <Link
              key={crown.type}
              to={gamePath(crown.type, CROWN_RUN.mode, CROWN_RUN.limit, CROWN_RUN.rules, CROWN_RUN.count)}
              className={`group flex flex-col rounded-xl border p-4 transition-colors ${
                crown.holder
                  ? mine
                    ? "border-amber-400/40 bg-amber-400/[0.08] hover:border-amber-400/60"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  : "border-dashed border-white/12 bg-transparent hover:border-white/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={crown.holder ? "" : "opacity-30 grayscale"}
                >
                  👑
                </span>
                <span className="text-sm font-semibold text-zinc-100">
                  {crown.title}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-zinc-500">
                {crownFeat(crown.type)}
              </p>

              {crown.holder ? (
                <div className="mt-3 flex items-center gap-2">
                  {crown.holder.country && (
                    <img
                      src={`/flags/${crown.holder.country}.svg`}
                      alt=""
                      width={20}
                      height={15}
                      className="w-5 shrink-0 rounded-[2px]"
                    />
                  )}
                  <span className="truncate text-base font-semibold text-zinc-50">
                    {crown.holder.username}
                  </span>
                  {mine && (
                    <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                      You
                    </span>
                  )}
                  <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-amber-200">
                    {formatDuration(crown.holder.ms)}
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Unclaimed —{" "}
                  <span className="text-teal-300 group-hover:underline">
                    take it
                  </span>
                </p>
              )}
            </Link>
          );
        })}

        {crowns === null &&
          GAME_TYPES.map((option) => (
            <div
              key={option.id}
              className="h-[104px] animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
            />
          ))}
      </div>
    </section>
  );
}
