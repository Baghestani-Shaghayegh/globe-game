import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FindGame from "../features/globe-guess/FindGame";
import GlobeGame from "../features/globe-guess/GlobeGame";
import type { RoundOutcome } from "../features/globe-guess/FindGame";
import { getCountryMeta } from "../data/countries";
import { flagUrl } from "../data/flags";
import { cluesFor } from "../data/clues";
import { GAME_TYPES, type GameType, type Mode } from "../data/modes";
import { allCountries } from "../lib/countryStats";
import {
  boxHint,
  boxLabel,
  loadDeck,
  masteredCount,
  nextSession,
  recallsFrom,
  saveReview,
  TOP_BOX,
} from "../lib/practice";
import { choiceClass } from "../components/choice";

/** A mode built for one drill: the countries this session is about. */
function practiceMode(names: string[]): Mode {
  const wanted = new Set(names);
  return {
    id: "practice",
    name: "Practice",
    desc: "",
    label: "Practice",
    level: 1,
    accent: "#f59e0b",
    regional: false,
    noun: "countries",
    includes: (meta) => wanted.has(meta.geoName),
  };
}

/** The deck, as the page needs it: what to ask, and what is put away. */
function readSession(): { queue: string[]; mastered: number } {
  return { queue: nextSession(), mastered: masteredCount() };
}

/** Countries this game type can actually pose a question about. */
function askable(type: GameType, names: string[]): string[] {
  return names.filter((name) => {
    if (type === "flag") return flagUrl(name) !== null;
    if (type === "famous") return cluesFor(name).length > 0;
    return true;
  });
}

export default function Practice() {
  const [type, setType] = useState<GameType>("find");
  const [playing, setPlaying] = useState<string[] | null>(null);
  const [justDone, setJustDone] = useState<{ clean: number; total: number } | null>(
    null
  );

  // Both come from the deck, so they are read together and replaced together
  // — deriving one from the other would only pretend they were independent.
  // Read once per visit, so the queue can't shuffle under the player while
  // they are looking at it.
  const [{ queue, mastered }, setSession] = useState(readSession);
  const worst = useMemo(() => {
    const deck = loadDeck();
    return queue.map((name) => ({
      name,
      display: getCountryMeta(name).displayName,
      box: deck[name]?.box ?? 0,
      stat: allCountries().find((row) => row.geoName === name) ?? null,
    }));
  }, [queue]);

  const finish = useCallback((outcome: RoundOutcome) => {
    const recalls = recallsFrom(outcome);
    saveReview(recalls);
    const values = Object.values(recalls);
    setJustDone({
      clean: values.filter((r) => r === "clean").length,
      total: values.length,
    });
    setPlaying(null);
    setSession(readSession());
  }, []);

  if (playing) {
    return type === "name" ? (
      <GlobeGame
        mode={practiceMode(playing)}
        limitMs={null}
        ruleset="relaxed"
        onRoundEnd={finish}
        record={false}
      />
    ) : (
      <FindGame
        mode={practiceMode(playing)}
        limitMs={null}
        ruleset="relaxed"
        type={type}
        fixedOrder={playing}
        onRoundEnd={finish}
        record={false}
        // The whole world, with the ones being drilled raised out of it. On
        // their own the eight were specks on an empty sphere, which is no way
        // to learn where they are.
        backdrop
        showInPlay
      />
    );
  }

  const ready = askable(type, queue);

  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10 sm:px-8 lg:px-12">
      <main className="mx-auto w-full max-w-[1180px]">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Practice
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          The countries that keep getting away, asked again on a widening
          schedule until they don't.
        </p>

        {justDone && (
          <p className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-200">
            {justDone.clean} of {justDone.total} clean. The ones you got move
            further out; the ones you didn't come back tomorrow.
          </p>
        )}

        {queue.length === 0 ? (
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-zinc-100">Nothing due.</p>
            <p className="mt-2 text-sm text-zinc-500">
              {mastered > 0
                ? `${mastered} ${mastered === 1 ? "country is" : "countries are"} put away for now. Play a round and anything you slip on will turn up here.`
                : "Play a few rounds — the countries you miss will collect here."}
            </p>
          </div>
        ) : (
          <>
            {/* A header row, because the two numbers on the right were
                unlabelled and one of them was five dots. */}
            <div className="mt-5 flex items-center gap-3 px-4 pb-1.5 text-[11px] uppercase tracking-wider text-zinc-600">
              <span>Country</span>
              <span className="ml-auto w-20 text-right">Times missed</span>
              <span className="w-24 text-right">Progress</span>
            </div>

            <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {worst.map((entry) => (
                <li
                  key={entry.name}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="text-zinc-100">{entry.display}</span>
                  {!askable(type, [entry.name]).length && (
                    <span className="text-xs text-zinc-600">
                      not asked this way
                    </span>
                  )}
                  <span className="ml-auto w-20 text-right tabular-nums text-xs text-rose-300/70">
                    {entry.stat && entry.stat.missed > 0 ? entry.stat.missed : "—"}
                  </span>
                  {/* Words, not dots. The ladder is a run of clean answers, so
                      that is what it says; the tooltip carries what getting it
                      right again would buy. */}
                  <span
                    title={boxHint(entry.box)}
                    className={`w-24 text-right text-xs ${
                      entry.box === 0
                        ? "text-zinc-500"
                        : entry.box >= TOP_BOX
                          ? "text-emerald-300/80"
                          : "text-amber-300/80"
                    }`}
                  >
                    {boxLabel(entry.box)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Below the list rather than above it. Up there it read as a
                filter on the countries, which it never was — the same eight
                are drilled whichever is picked. It is a choice about the
                round you are about to start, so it lives with the button
                that starts it. */}
            <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-zinc-200">
                How should I ask about these {worst.length}?
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {GAME_TYPES.find((option) => option.id === type)?.blurb}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {GAME_TYPES.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setType(option.id)}
                    aria-pressed={type === option.id}
                    className={choiceClass(type === option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setPlaying(ready)}
              disabled={ready.length === 0}
              className="mt-3 w-full rounded-lg bg-amber-400/15 py-2.5 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-400/25 disabled:opacity-40"
            >
              Practise {ready.length}{" "}
              {ready.length === 1 ? "country" : "countries"}
            </button>
            {ready.length < queue.length && (
              <p className="mt-2.5 text-center text-xs text-zinc-600">
                {queue.length - ready.length} of them can't be asked this way —
                no flag or clue on file.
              </p>
            )}
            <p className="mt-4 text-center text-xs text-zinc-600">
              Practice doesn't touch your records or the leaderboard.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
