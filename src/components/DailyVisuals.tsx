import { useEffect, useState } from "react";
import { getCountryMeta } from "../data/countries";
import { flagUrl } from "../data/flags";
import type { Outcome } from "../lib/daily";
import { heatColor, heatGradient } from "../lib/mystery";

/**
 * The pictures on today's cards: what each puzzle looks like before it's
 * played, and how it went after.
 */

const OUTCOME_TILE: Record<Outcome, string> = {
  first: "bg-emerald-400",
  retried: "bg-amber-300",
  missed: "bg-rose-400",
};

/** Ten slots to fill, or filled: green first time, amber retried, red missed. */
export function HuntSlots({ outcomes, count = 10 }: { outcomes?: Outcome[]; count?: number }) {
  return (
    <span className="grid w-full grid-cols-10 gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const o = outcomes?.[i];
        return (
          <span
            key={i}
            className={`aspect-square rounded-[5px] ${
              o ? OUTCOME_TILE[o] : "border border-dashed border-sky-300/35 bg-sky-300/[0.06]"
            }`}
          />
        );
      })}
    </span>
  );
}

/** The heat scale the mystery is played on, or the trail of guesses along it. */
export function MysteryHeat({ kms }: { kms?: number[] }) {
  if (kms && kms.length) {
    // Oldest first, as the hunt went; the last dozen, which is where it closed in.
    const trail = [...kms].reverse().slice(-12);
    return (
      <span className="flex w-full flex-wrap gap-1.5" aria-hidden="true">
        {trail.map((km, i) => (
          <span
            key={i}
            className="h-5 w-5 rounded-[5px]"
            style={{ backgroundColor: heatColor(km) }}
          />
        ))}
      </span>
    );
  }
  return (
    <span className="w-full" aria-hidden="true">
      <span className="relative block h-3 rounded-full" style={{ background: heatGradient() }}>
        {/* The answer sits at the hot end; you start somewhere in the cold. */}
        <span className="absolute -top-1.5 left-0 flex h-6 w-6 -translate-x-1/3 items-center justify-center rounded-full border-2 border-white/80 bg-rose-500 text-[11px] font-bold text-white shadow">
          ?
        </span>
      </span>
      <span className="mt-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wider">
        <span className="text-rose-300">Hot</span>
        <span className="text-sky-300">Cold</span>
      </span>
    </span>
  );
}

function FlagName({ name, align }: { name: string; align: "left" | "right" }) {
  const flag = flagUrl(name);
  return (
    <span
      className={`flex min-w-0 flex-col gap-1 ${align === "right" ? "items-end text-right" : "items-start"}`}
    >
      {flag ? (
        <img src={flag} alt="" className="h-7 w-10 rounded-[3px] object-cover ring-1 ring-white/15" />
      ) : (
        <span className="h-7 w-10 rounded-[3px] bg-white/10" />
      )}
      <span className="max-w-full truncate text-xs font-medium text-zinc-200">
        {getCountryMeta(name).displayName}
      </span>
    </span>
  );
}

/**
 * Today's two ends, with the gap between them: dashed until it's walked, a
 * dot per country once it is.
 */
export function ConnectPair({ from, to, steps }: { from: string; to: string; steps?: number }) {
  return (
    <span className="flex w-full items-start gap-2">
      <FlagName name={from} align="left" />
      <span className="mt-3.5 flex min-w-6 flex-1 items-center justify-center gap-1" aria-hidden="true">
        {steps ? (
          Array.from({ length: Math.min(steps, 8) }, (_, i) => (
            <span key={i} className="h-2 w-2 shrink-0 rounded-full bg-violet-300" />
          ))
        ) : (
          <span className="h-0 w-full border-t-2 border-dashed border-violet-300/40" />
        )}
      </span>
      <FlagName name={to} align="right" />
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
