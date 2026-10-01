import { useEffect, useState } from "react";
import { getCountryMeta } from "../data/countries";
import { flagUrl } from "../data/flags";
import type { Outcome } from "../lib/daily";
import { heatColor } from "../lib/mystery";

/**
 * The pictures on today's cards: what each puzzle looks like before it's
 * played, and how it went after.
 */

const OUTCOME_TILE: Record<Outcome, string> = {
  first: "bg-emerald-400",
  retried: "bg-amber-300",
  missed: "bg-rose-400",
};

/** Ten targets to find, or found: green first time, amber retried, red missed. */
export function HuntSlots({ outcomes, count = 10 }: { outcomes?: Outcome[]; count?: number }) {
  return (
    <span className="grid w-full grid-cols-5 gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const o = outcomes?.[i];
        return o ? (
          <span key={i} className={`h-7 rounded-md shadow-sm ${OUTCOME_TILE[o]}`} />
        ) : (
          <span
            key={i}
            className="flex h-7 items-center justify-center rounded-md border border-dashed border-sky-300/50 bg-sky-300/[0.08]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300/70" />
          </span>
        );
      })}
    </span>
  );
}

/**
 * The mystery's hot-and-cold, as a radar: rings from cold blue out at the
 * edge to hot red at the middle, where the answer hides. Once played, the
 * trail of guesses instead, getting warmer.
 */
export function MysteryHeat({ kms }: { kms?: number[] }) {
  if (kms && kms.length) {
    // Oldest first, as the hunt went; the last ten, which is where it closed in.
    const trail = [...kms].reverse().slice(-10);
    return (
      <span className="flex w-full flex-wrap justify-center gap-1.5" aria-hidden="true">
        {trail.map((km, i) => (
          <span
            key={i}
            className="h-7 w-7 rounded-md shadow-sm"
            style={{ backgroundColor: heatColor(km) }}
          />
        ))}
      </span>
    );
  }
  const rings = [9000, 6000, 3500, 1800, 600];
  return (
    <svg viewBox="0 0 120 70" className="h-[4.5rem] w-auto" aria-hidden="true">
      {rings.map((km, i) => (
        <circle
          key={km}
          cx="60"
          cy="35"
          r={34 - i * 6.5}
          fill={heatColor(km)}
          fillOpacity={0.22 + i * 0.12}
          stroke={heatColor(km)}
          strokeOpacity="0.8"
          strokeWidth="1"
        />
      ))}
      <text
        x="60"
        y="40.5"
        textAnchor="middle"
        fontSize="15"
        fontWeight="800"
        fill="#fff"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        ?
      </text>
    </svg>
  );
}

function Flag({ name }: { name: string }) {
  const flag = flagUrl(name);
  return flag ? (
    <img
      src={flag}
      alt=""
      className="h-9 w-[3.25rem] rounded-[4px] object-cover shadow-md ring-1 ring-white/20"
    />
  ) : (
    <span className="h-9 w-[3.25rem] rounded-[4px] bg-white/10" />
  );
}

/**
 * Today's two ends, joined by a route arcing over the map: dashed until it's
 * walked, solid with a dot per country once it is.
 */
export function ConnectPair({ from, to, steps }: { from: string; to: string; steps?: number }) {
  const n = Math.min(steps ?? 0, 7);
  return (
    <span className="flex w-full flex-col gap-1">
      <span className="flex w-full items-end">
        <Flag name={from} />
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 min-w-0 flex-1" aria-hidden="true">
          <path
            d="M4 34 Q50 -6 96 34"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={steps ? undefined : "4 5"}
            vectorEffect="non-scaling-stroke"
            className="text-violet-300"
          />
          {Array.from({ length: n }, (_, i) => {
            // Points along the same curve, evenly spaced between the ends.
            const t = (i + 1) / (n + 1);
            const x = (1 - t) ** 2 * 4 + 2 * (1 - t) * t * 50 + t ** 2 * 96;
            const y = (1 - t) ** 2 * 34 + 2 * (1 - t) * t * -6 + t ** 2 * 34;
            return <circle key={i} cx={x} cy={y} r="3.2" className="fill-violet-200" />;
          })}
        </svg>
        <Flag name={to} />
      </span>
      <span className="flex justify-between gap-2 text-xs font-medium text-zinc-200">
        <span className="truncate">{getCountryMeta(from).displayName}</span>
        <span className="truncate text-right">{getCountryMeta(to).displayName}</span>
      </span>
    </span>
  );
}

/** "New in 5h 12m": until midnight UTC, when all three change. */
export function NewIn() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.ceil((next.getTime() - now) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return <>{h > 0 ? `New in ${h}h ${m}m` : `New in ${m}m`}</>;
}
