import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { Link } from "react-router-dom";
import { useGlobeTheme } from "../features/globe-guess/useGlobeTheme";
import { getCountryMeta } from "../data/countries";
import { globeMaterial, theme } from "../lib/globeTheme";
import { featureCentre, type Geometry } from "../lib/geo";
import { dayKey, formatDay } from "../lib/daily";
import ShareButton from "../components/ShareButton";
import {
  isConnected,
  loadConnect,
  puzzleFor,
  resolveName,
  saveConnect,
  scoreFor,
  shareText,
  shortestPath,
  touchesChain,
  type ConnectResult,
} from "../lib/connect";

type CountryFeature = {
  properties: { name: string };
  geometry: Geometry;
};

const display = (name: string) => getCountryMeta(name).displayName;

export default function Connect() {
  useGlobeTheme();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const framed = useRef(false);
  const day = useMemo(dayKey, []);
  const puzzle = useMemo(() => puzzleFor(day), [day]);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [giveUp, setGiveUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { features: CountryFeature[] }) => {
        if (!cancelled) setFeatures(data.features);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!puzzle) return;
    setResult(
      loadConnect(day) ?? {
        day,
        number: puzzle.number,
        from: puzzle.from,
        to: puzzle.to,
        par: puzzle.par,
        chain: [],
        solved: false,
        wrong: 0,
      }
    );
  }, [day, puzzle]);

  const centres = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }>();
    for (const feature of features) {
      const { lat, lng } = featureCentre(feature.geometry);
      map.set(feature.properties.name, { lat, lng });
    }
    return map;
  }, [features]);

  // Open on the two ends, so the shape of the problem is visible at a glance.
  useEffect(() => {
    if (framed.current || !result || !centres.size || !globeRef.current) return;
    const a = centres.get(result.from);
    const b = centres.get(result.to);
    if (!a || !b) return;
    framed.current = true;
    globeRef.current.pointOfView(
      { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2, altitude: 2.1 },
      900
    );
  }, [result, centres]);

  const chainSet = useMemo(() => new Set(result?.chain ?? []), [result]);

  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!result || result.solved) return;

      const name = resolveName(typed);
      if (!name) {
        setNote("No country by that name.");
        return;
      }
      if (name === result.from || name === result.to) {
        setNote(`${display(name)} is already one of the ends.`);
        return;
      }
      if (chainSet.has(name)) {
        setNote(`${display(name)} is already in the chain.`);
        return;
      }
      if (!touchesChain(result.from, result.to, result.chain, name)) {
        // Counted, but not placed: it has to touch something to be a step.
        const next = { ...result, wrong: result.wrong + 1 };
        saveConnect(next);
        setResult(next);
        setNote(`${display(name)} doesn't border anything you've placed.`);
        setTyped("");
        return;
      }

      const chain = [...result.chain, name];
      // Any order in, but the chain only counts if some arrangement walks it.
      const ordered = orderChain(result.from, result.to, chain);
      const next: ConnectResult = {
        ...result,
        chain: ordered ?? chain,
        solved: ordered !== null,
      };
      saveConnect(next);
      setResult(next);
      setTyped("");
      setNote(ordered ? null : `${display(name)} added.`);
    },
    [result, typed, chainSet]
  );

  const capColor = useMemo(
    () => (d: object) => {
      const { name } = (d as CountryFeature).properties;
      if (!result) return theme.unfound;
      if (name === result.from || name === result.to) return theme.selected;
      if (chainSet.has(name)) return theme.found;
      if (giveUp && shortestPath(result.from, result.to)?.includes(name)) {
        return theme.missed;
      }
      return theme.unfound;
    },
    [result, chainSet, giveUp]
  );

  if (loadError || !puzzle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#07111c] px-6 text-center">
        <p className="text-zinc-100">
          {loadError ? "Couldn't load the map data." : "No puzzle for today."}
        </p>
        <Link
          to="/"
          className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100"
        >
          Back to modes
        </Link>
      </div>
    );
  }

  const answer = giveUp ? shortestPath(puzzle.from, puzzle.to) : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07111c]">
      <Globe
        ref={globeRef}
        rendererConfig={{ antialias: true, alpha: true, logarithmicDepthBuffer: true }}
        backgroundColor={theme.page}
        globeMaterial={globeMaterial}
        atmosphereColor={theme.atmosphere}
        atmosphereAltitude={0.14}
        polygonsData={features}
        polygonCapColor={capColor}
        polygonSideColor={() => theme.sphere}
        polygonStrokeColor={() => theme.stroke}
        polygonAltitude={(d) => {
          const { name } = (d as CountryFeature).properties;
          return name === result?.from || name === result?.to || chainSet.has(name)
            ? 0.05
            : 0.012;
        }}
        polygonsTransitionDuration={250}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <Link
          to="/"
          className="pointer-events-auto rounded-lg border border-white/10 bg-[#141b23]/90 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>
        <div className="rounded-lg border border-white/10 bg-[#141b23]/90 px-3 py-1.5 text-right text-sm backdrop-blur">
          <p className="font-medium text-zinc-100">Connect #{puzzle.number}</p>
          <p className="text-xs tabular-nums text-zinc-500">
            par {puzzle.par} · {result?.chain.length ?? 0} placed
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#141b23]/90 px-5 py-3 text-center backdrop-blur">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Walk from
        </p>
        <p className="text-lg font-medium text-zinc-50 sm:text-xl">
          {display(puzzle.from)}{" "}
          <span className="text-zinc-600">→</span> {display(puzzle.to)}
        </p>

        {result?.solved ? (
          <>
            <p className="text-sm text-emerald-300">
              Connected in {result.chain.length}{" "}
              {result.chain.length === 1 ? "step" : "steps"} · par {result.par} ·{" "}
              {scoreFor(result).toLocaleString()} points
            </p>
            <p className="text-sm text-zinc-400">
              {[puzzle.from, ...result.chain, puzzle.to].map(display).join(" → ")}
            </p>
            <div className="pointer-events-auto w-full pt-1">
              <ShareButton
                card={() => ({
                  eyebrow: `Connect #${result.number}`,
                  title: `${display(result.from)} → ${display(result.to)}`,
                  subtitle: `${result.chain.length} steps · par ${result.par}`,
                  tiles: result.chain.map((_, i) =>
                    i < result.par ? "#5bb98c" : "#f2a93b"
                  ),
                  note: `${scoreFor(result).toLocaleString()} points`,
                })}
                text={shareText(result)}
                filename={`worldguess-connect-${result.number}.png`}
                className="w-full rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15 disabled:opacity-60"
              />
            </div>
          </>
        ) : (
          <>
            <p className="max-w-xs text-sm text-zinc-400">
              Name countries that link them up. Each one has to border something
              already on the board.
            </p>
            <form onSubmit={submit} className="pointer-events-auto flex gap-2 pt-1">
              <label htmlFor="link" className="sr-only">
                A country in the chain
              </label>
              <input
                id="link"
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Country name"
                autoComplete="off"
                className="w-48 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
              />
              <button
                type="submit"
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15"
              >
                Add
              </button>
            </form>
            {note && <p className="text-xs text-amber-300/80">{note}</p>}
          </>
        )}
      </div>

      {(result?.chain.length ?? 0) > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-64 max-w-[calc(100vw-2rem)]">
          <ul className="max-h-[45vh] overflow-y-auto rounded-xl border border-white/10 bg-[#141b23]/90 backdrop-blur">
            {result!.chain.map((name, i) => (
              <li
                key={name}
                className="flex items-center gap-2.5 border-b border-white/[0.05] px-3 py-2 text-sm last:border-b-0"
              >
                <span className="w-4 shrink-0 text-right tabular-nums text-zinc-600">
                  {i + 1}
                </span>
                <span className="min-w-0 truncate text-zinc-100">
                  {display(name)}
                </span>
              </li>
            ))}
          </ul>
          {result!.wrong > 0 && (
            <p className="mt-2 px-1 text-xs text-zinc-600">
              {result!.wrong} that didn't touch anything
            </p>
          )}
        </div>
      )}

      {!result?.solved && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex flex-col items-center gap-2">
          {answer && (
            <p className="rounded-lg border border-white/10 bg-[#141b23]/90 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur">
              One way: {answer.map(display).join(" → ")}
            </p>
          )}
          {!answer && (
            <button
              onClick={() => setGiveUp(true)}
              className="pointer-events-auto text-xs text-zinc-600 underline underline-offset-4 transition-colors hover:text-zinc-400"
            >
              Show me one route
            </button>
          )}
        </div>
      )}

      {result?.solved && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 z-10 text-center text-sm text-zinc-500">
          {formatDay(day)} · a new pair at midnight UTC
        </p>
      )}
    </div>
  );
}

/**
 * Puts a set of countries into an order that actually walks from one end to
 * the other, or says it can't yet.
 *
 * Players name countries as they think of them, not in order, so the chain has
 * to be arranged rather than trusted. Small enough to brute force: a chain long
 * enough for this to matter is one nobody is going to finish.
 */
function orderChain(from: string, to: string, chain: string[]): string[] | null {
  if (chain.length > 8) return isConnected(from, to, chain) ? chain : null;

  const walk = (used: boolean[], order: string[]): string[] | null => {
    if (order.length === chain.length) {
      return isConnected(from, to, order) ? order : null;
    }
    for (let i = 0; i < chain.length; i += 1) {
      if (used[i]) continue;
      used[i] = true;
      const found = walk(used, [...order, chain[i]]);
      used[i] = false;
      if (found) return found;
    }
    return null;
  };
  return walk(new Array(chain.length).fill(false), []);
}
