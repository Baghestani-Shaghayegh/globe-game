import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FindGame from "../features/globe-guess/FindGame";
import type { RoundOutcome } from "../features/globe-guess/FindGame";
import LessonRun, { Flag } from "../features/learn/LessonRun";
import { useLessons } from "../features/learn/useLessons";
import { getCountryMeta } from "../data/countries";
import { flagUrl } from "../data/flags";
import { cluesFor } from "../data/clues";
import { GAME_TYPES, type GameType, type Mode } from "../data/modes";
import { allCountries } from "../lib/countryStats";
import {
  BOX_DAYS,
  boxHint,
  boxLabel,
  loadDeck,
  masteredCount,
  nextSession,
  practiceSummary,
  recallsFrom,
  saveReview,
  TOP_BOX,
  type Recall,
} from "../lib/practice";
import { playTap } from "../lib/sound";
import { choiceClass } from "../components/choice";

/**
 * Practice: the countries due for another look, asked again.
 *
 * It used to be a plain game round over whatever you'd missed elsewhere — a
 * test, with nothing in it to learn from. Now the default is the lesson's own
 * Find-then-Name, with a direction after a wrong click, a first letter after a
 * wrong name and the answer after two. And lessons feed it: every country
 * learned comes back here, the ones that needed help first. A lesson teaches a
 * country; this is what makes it stay.
 */

/** How to ask. "review" is the lesson's Find-then-Name; the rest are games. */
type Way = "review" | Exclude<GameType, "name" | "find">;

const WAYS: { id: Way; label: string; blurb: string }[] = [
  {
    id: "review",
    label: "Find & name",
    blurb: "Find each one, then name it. Hints after a miss.",
  },
  ...GAME_TYPES.filter(
    (t): t is (typeof GAME_TYPES)[number] & { id: Way } =>
      t.id !== "name" && t.id !== "find"
  ),
];

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

/** The deck, as the page needs it: what to ask, and how the rest stands. */
function readSession() {
  return { queue: nextSession(), mastered: masteredCount(), summary: practiceSummary() };
}

/** Countries this way of asking can actually pose a question about. */
function askable(way: Way, names: string[]): string[] {
  return names.filter((name) => {
    if (way === "flag") return flagUrl(name) !== null;
    if (way === "famous") return cluesFor(name).length > 0;
    return true;
  });
}

const display = (name: string) => getCountryMeta(name).displayName;

/** When a country is back, from the box it has just been put in. */
function backIn(box: number): string {
  const days = BOX_DAYS[Math.max(0, Math.min(TOP_BOX, box))];
  if (days === 0) return "Again now";
  if (days === 1) return "Back tomorrow";
  return `Back in ${days} days`;
}

export default function Practice() {
  const [way, setWay] = useState<Way>("review");
  const [playing, setPlaying] = useState<{ way: Way; names: string[] } | null>(null);
  const [justDone, setJustDone] = useState<{ clean: number; total: number } | null>(
    null
  );
  const map = useLessons();

  // Both come from the deck, so they are read together and replaced together.
  // Read once per visit, so the queue can't shuffle under the player while
  // they are looking at it.
  const [{ queue, mastered, summary }, setSession] = useState(readSession);
  const rows = useMemo(() => {
    const deck = loadDeck();
    return queue.map((name) => ({
      name,
      box: deck[name]?.box ?? 0,
      // Practised before and missed, as against never practised at all:
      // both sit at the bottom, but they aren't the same thing to the player.
      practised: deck[name] !== undefined,
      stat: allCountries().find((row) => row.geoName === name) ?? null,
    }));
  }, [queue]);

  const finishGame = useCallback((outcome: RoundOutcome) => {
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

  const backToList = () => {
    setPlaying(null);
    setSession(readSession());
  };

  if (playing?.way === "review" && map && map !== "error") {
    return (
      <LessonRun
        // A second go is a new run from the top, not the old one carried on.
        key={playing.names.join("|")}
        countries={playing.names}
        features={map.features}
        meet={false}
        heading="Practice"
        back={{ label: "Practice", onClick: backToList }}
        onFinish={(recalls) => {
          saveReview(recalls);
          const values = Object.values(recalls);
          setJustDone({
            clean: values.filter((r) => r === "clean").length,
            total: values.length,
          });
        }}
        done={(recalls) => (
          <ReviewDone
            recalls={recalls}
            onAgain={(names) => {
              playTap();
              setPlaying({ way: "review", names });
            }}
            onBack={backToList}
          />
        )}
      />
    );
  }

  if (playing && playing.way !== "review") {
    return (
      <FindGame
        mode={practiceMode(playing.names)}
        limitMs={null}
        ruleset="relaxed"
        type={playing.way}
        fixedOrder={playing.names}
        onRoundEnd={finishGame}
        record={false}
        // The whole world, with the ones being drilled raised out of it and
        // pulsing, as the Country hunt's are. The backdrop stays clickable:
        // clicking Brazil when asked for Burundi is a wrong answer and
        // deserves to be told so.
        backdrop
        showInPlay
      />
    );
  }

  const ready = askable(way, queue);

  return (
    <div className="min-h-screen bg-page px-5 py-10 sm:px-8 lg:px-12">
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
          Countries from your lessons and the ones you've missed come back
          here. Each one you get right waits longer before it comes back.
        </p>

        {/* Where the whole deck stands, so a round's work shows: the
            countries got right move from the first number to the second. */}
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-amber-400/15 px-3 py-1 font-semibold text-amber-200">
            {summary.waiting} to practise
          </span>
          <span
            title="Got right. Each comes back on its own day, a little later every time."
            className="rounded-full bg-white/[0.06] px-3 py-1 text-zinc-300"
          >
            {summary.resting} coming back later
          </span>
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-300">
            {summary.learned} learned
          </span>
        </div>

        {justDone && (
          <p className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-200">
            {justDone.clean === justDone.total
              ? `All ${justDone.total} right first time. They're back in a day or more.`
              : `${justDone.clean} of ${justDone.total} right first time. Those are back in a day or more; the rest stay in.`}
            {queue.length > 0 && " Here are the next ones."}
          </p>
        )}

        {queue.length === 0 ? (
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-zinc-100">Nothing due.</p>
            <p className="mt-2 text-sm text-zinc-500">
              {mastered > 0
                ? `${mastered} ${mastered === 1 ? "country is" : "countries are"} put away for now.`
                : "Finish a lesson and its countries come back here."}
            </p>
            <Link
              to="/learn"
              onClick={playTap}
              className="mt-4 inline-block rounded-full bg-teal-300 px-5 py-2 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
            >
              Go to lessons →
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-3 px-4 pb-1.5 text-[11px] uppercase tracking-wider text-zinc-600">
              <span>
                This round · {rows.length} of {summary.waiting}
              </span>
              <span className="ml-auto w-20 text-right">Times missed</span>
              <span className="w-32 text-right">Progress</span>
            </div>

            <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {rows.map((entry) => (
                <li
                  key={entry.name}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <Flag name={entry.name} className="h-4 w-6 shrink-0" />
                  <span className="text-zinc-100">{display(entry.name)}</span>
                  {!askable(way, [entry.name]).length && (
                    <span className="text-xs text-zinc-600">
                      not asked this way
                    </span>
                  )}
                  <span
                    className={`ml-auto w-20 text-right tabular-nums text-xs ${
                      entry.stat && entry.stat.missed > 0 ? "text-rose-300/70" : "text-zinc-600"
                    }`}
                  >
                    {entry.stat && entry.stat.missed > 0 ? entry.stat.missed : "—"}
                  </span>
                  <span
                    title={boxHint(entry.box)}
                    className={`w-32 whitespace-nowrap text-right text-xs ${
                      entry.box === 0
                        ? "text-zinc-500"
                        : entry.box >= TOP_BOX
                          ? "text-emerald-300/80"
                          : "text-amber-300/80"
                    }`}
                  >
                    {entry.practised ? (entry.box === 0 ? "Missed last time" : boxLabel(entry.box)) : "New"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-zinc-200">
                How should I ask about these {rows.length}?
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {WAYS.find((option) => option.id === way)?.blurb}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {WAYS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setWay(option.id)}
                    aria-pressed={way === option.id}
                    className={choiceClass(way === option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                playTap();
                setJustDone(null);
                setPlaying({ way, names: ready });
              }}
              disabled={ready.length === 0 || (way === "review" && !map)}
              className="mt-3 w-full rounded-lg bg-amber-400/15 py-2.5 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-400/25 disabled:opacity-40"
            >
              Practise {ready.length}{" "}
              {ready.length === 1 ? "country" : "countries"}
            </button>
            {ready.length < queue.length && (
              <p className="mt-2.5 text-center text-xs text-zinc-600">
                {queue.length - ready.length} of them can't be asked this way.
                No flag or clue on file.
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

/**
 * The end of a practice run: how each one went and when it's back. The ones
 * that needed the answer are due again straight away, so going again is the
 * obvious next thing — asked twice in a sitting is how a slip gets fixed.
 */
function ReviewDone({
  recalls,
  onAgain,
  onBack,
}: {
  recalls: Record<string, Recall>;
  onAgain: (names: string[]) => void;
  onBack: () => void;
}) {
  // Read after the run was filed, so the boxes are the new ones.
  const [deck] = useState(loadDeck);
  const [again] = useState(() => nextSession());
  const names = Object.keys(recalls);
  const clean = names.filter((name) => recalls[name] === "clean").length;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-300">
        Practice done
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
        {clean} of {names.length} without help
      </h1>
      <ul className="mt-4 space-y-2">
        {names.map((name) => (
          <li key={name} className="flex items-center gap-3">
            <Flag name={name} className="h-5 w-7 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
              {recalls[name] === "clean" ? "✓ " : ""}
              {display(name)}
            </span>
            <span
              className={`shrink-0 text-xs ${
                recalls[name] === "clean" ? "text-zinc-500" : "text-amber-300"
              }`}
            >
              {backIn(deck[name]?.box ?? 0)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-2">
        {again.length > 0 && (
          <button
            onClick={() => onAgain(again)}
            autoFocus
            className="rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
          >
            {/* "Go again" only when it is these again; after a clean round
                the next ones are different countries. */}
            {again.some((name) => name in recalls)
              ? `Go again · ${again.length} →`
              : `Next ${again.length} →`}
          </button>
        )}
        <button
          onClick={() => {
            playTap();
            onBack();
          }}
          className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:text-zinc-100"
        >
          Back to practice
        </button>
      </div>
    </div>
  );
}
