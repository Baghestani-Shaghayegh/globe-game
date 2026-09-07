import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import RoundSummary from "./RoundSummary";
import GameHud from "./GameHud";
import ExitConfirm from "./ExitConfirm";
import { useRound } from "./useRound";
import { getCountryMeta } from "../../data/countries";
import { flagUrl } from "../../data/flags";
import {
  BLITZ_SECONDS,
  recordKey,
  type Mode,
  type Ruleset,
} from "../../data/modes";
import { isCorrectGuess, normalizeAnswer } from "../../lib/answerMatch";
import { HINT_COST } from "../../lib/scoring";

type Question = { geoName: string; displayName: string; flag: string };

const MAX_SUGGESTIONS = 6;

/** Fisher-Yates, so each round shows the flags in a different order. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Props = { mode: Mode; limitMs: number | null; ruleset: Ruleset };

/** "Whose flag": a flag is shown and the player types the country. */
export default function FlagGame({ mode, limitMs, ruleset }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrongTimer = useRef<number | undefined>(undefined);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [queue, setQueue] = useState<Question[]>([]);
  const [foundNames, setFoundNames] = useState<Set<string>>(new Set());
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState(0);
  const [isWrong, setIsWrong] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [hintLetter, setHintLetter] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(BLITZ_SECONDS);

  const round = useRound(recordKey("flag", mode.id, limitMs, ruleset), limitMs);
  const { begin, reset, tick, end, summary, correct, wrong, spendHint } = round;

  useEffect(() => {
    reset();
    setFoundNames(new Set());
    setQueue([]);
    setGuess("");
    setGuesses(0);
    setIsWrong(false);
    setRevealed(null);
    setHintLetter(null);
    setSecondsLeft(BLITZ_SECONDS);

    let cancelled = false;
    fetch("/data/world.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load map data (${res.status})`);
        return res.json();
      })
      .then((data: { features: { properties: { name: string } }[] }) => {
        if (cancelled) return;
        // Only countries this mode asks for that actually have a flag.
        const playable = data.features
          .map((f) => getCountryMeta(f.properties.name))
          .filter((meta) => mode.includes(meta))
          .map((meta) => {
            const flag = flagUrl(meta.geoName);
            return flag
              ? {
                  geoName: meta.geoName,
                  displayName: meta.displayName,
                  flag,
                }
              : null;
          })
          .filter((q): q is Question => q !== null);
        setQuestions(playable);
        setQueue(shuffled(playable));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, reset]);

  useEffect(() => () => window.clearTimeout(wrongTimer.current), []);

  useEffect(() => {
    if (questions.length) begin();
  }, [questions, begin]);

  useEffect(() => {
    if (!questions.length || summary) return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [questions.length, summary, tick]);

  const current = queue[0] ?? null;

  const endRound = useCallback(() => {
    end({ found: foundNames.size, total: questions.length, guesses });
  }, [end, foundNames.size, questions.length, guesses]);

  useEffect(() => {
    if (round.timeUp) endRound();
  }, [round.timeUp, endRound]);

  useEffect(() => {
    if (questions.length > 0 && queue.length === 0) endRound();
  }, [questions.length, queue.length, endRound]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [current]);

  const advance = useCallback(() => {
    setQueue((prev) => prev.slice(1));
    setGuess("");
    setHighlighted(-1);
    setIsWrong(false);
    setHintLetter(null);
    setRevealed(null);
    setSecondsLeft(BLITZ_SECONDS);
  }, []);

  /** Blitz: each flag gets a fixed window before the next one replaces it. */
  useEffect(() => {
    if (ruleset !== "blitz" || !current || summary || revealed) return;
    const id = window.setInterval(() => {
      setSecondsLeft((left) => {
        if (left > 1) return left - 1;
        window.clearInterval(id);
        advance();
        return BLITZ_SECONDS;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [ruleset, current, summary, revealed, advance]);

  const suggestions = useMemo(() => {
    const query = normalizeAnswer(guess);
    if (!query) return [];
    return questions
      .map((q) => q.displayName)
      .filter((name) => normalizeAnswer(name).includes(query))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_SUGGESTIONS);
  }, [guess, questions]);

  const submit = (value: string) => {
    if (!current || !value.trim() || revealed) return;
    setGuesses((n) => n + 1);

    if (isCorrectGuess(value, getCountryMeta(current.geoName))) {
      setFoundNames((prev) => new Set(prev).add(current.geoName));
      correct();
      advance();
      return;
    }

    wrong();
    setIsWrong(true);
    window.clearTimeout(wrongTimer.current);
    if (ruleset === "sudden") {
      wrongTimer.current = window.setTimeout(endRound, 700);
      return;
    }
    wrongTimer.current = window.setTimeout(() => setIsWrong(false), 600);
  };

  /** Gives up on this flag: names it, then moves on. */
  const handlePass = () => {
    if (!current || revealed) return;
    spendHint("answer");
    setRevealed(current.displayName);
    window.clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(advance, 1400);
  };

  const handleLetter = () => {
    if (!current || hintLetter || revealed) return;
    spendHint("letter");
    setHintLetter(current.displayName.charAt(0).toUpperCase());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(highlighted >= 0 ? suggestions[highlighted] : guess);
    }
  };

  const handleBack = () => {
    if (summary || foundNames.size === 0) {
      navigate("/");
      return;
    }
    round.setConfirmingExit(true);
  };

  const playAgain = () => {
    reset();
    setFoundNames(new Set());
    setGuesses(0);
    setGuess("");
    setIsWrong(false);
    setRevealed(null);
    setHintLetter(null);
    setSecondsLeft(BLITZ_SECONDS);
    setQueue(shuffled(questions));
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#07111c] px-6">
        <p className="text-zinc-100">Couldn't load the map data.</p>
        <Link
          to="/"
          className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100"
        >
          Back to modes
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#07111c]">
      <GameHud
        onBack={handleBack}
        found={foundNames.size}
        total={questions.length}
        ms={round.displayMs}
        countdown={round.countdown}
        modeLabel={mode.label}
        modeLevel={mode.level}
        points={round.score.points}
        streak={round.score.streak}
        onFinish={summary ? null : endRound}
      />

      {current && !summary && (
        <main className="flex min-h-screen flex-col items-center justify-center px-5 py-24">
          <img
            key={current.flag}
            src={current.flag}
            alt="Flag of the country to name"
            width={320}
            height={240}
            className={`w-full max-w-xs rounded-lg border border-white/10 shadow-2xl ${
              isWrong ? "animate-shake" : ""
            }`}
          />

          <div className="mt-6 w-full max-w-xs">
            {revealed ? (
              <p className="rounded-lg border border-white/10 bg-white/5 py-2.5 text-center text-zinc-100">
                {revealed}
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3 pb-1.5">
                  <label
                    htmlFor="flag-guess"
                    className="text-sm text-zinc-400"
                  >
                    Which country?
                  </label>
                  {ruleset === "blitz" && (
                    <span
                      className={`text-sm font-medium tabular-nums ${
                        secondsLeft <= 5 ? "text-rose-400" : "text-zinc-400"
                      }`}
                      aria-label="Seconds left on this flag"
                    >
                      {secondsLeft}s
                    </span>
                  )}
                </div>

                <input
                  id="flag-guess"
                  ref={inputRef}
                  type="text"
                  value={guess}
                  onChange={(e) => {
                    setHighlighted(-1);
                    setGuess(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Start typing a name"
                  autoComplete="off"
                  className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 ${
                    isWrong
                      ? "border-rose-500/60 focus:border-rose-500"
                      : "border-white/10 focus:border-white/40"
                  }`}
                />

                {suggestions.length > 0 && (
                  <ul className="mt-2 overflow-hidden rounded-lg border border-white/10">
                    {suggestions.map((name, index) => (
                      <li
                        key={name}
                        onClick={() => submit(name)}
                        onMouseEnter={() => setHighlighted(index)}
                        className={`cursor-pointer px-3 py-2 text-sm text-zinc-200 ${
                          index === highlighted ? "bg-white/10" : ""
                        }`}
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center gap-3 text-xs">
                  {hintLetter ? (
                    <span className="rounded-md bg-white/5 px-2 py-1 text-zinc-300">
                      Starts with <b className="font-medium">{hintLetter}</b>
                    </span>
                  ) : (
                    <button
                      onClick={handleLetter}
                      className="rounded-md border border-white/10 px-2 py-1 text-zinc-400 transition-colors hover:border-white/25 hover:text-zinc-100"
                    >
                      First letter{" "}
                      <span className="text-zinc-600">−{HINT_COST.letter}</span>
                    </button>
                  )}
                  <button
                    onClick={handlePass}
                    className="ml-auto text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
                  >
                    Show me{" "}
                    <span className="text-zinc-600">−{HINT_COST.answer}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {round.confirmingExit && (
        <ExitConfirm
          found={foundNames.size}
          total={questions.length}
          onFinish={endRound}
          onKeepPlaying={() => round.setConfirmingExit(false)}
          onDiscard={() => navigate("/")}
        />
      )}

      {summary && (
        <RoundSummary
          completed={summary.completed}
          outOfTime={round.countdown && !summary.completed}
          endedOnMistake={ruleset === "sudden" && !summary.completed}
          ms={summary.ms}
          points={summary.points}
          bestStreak={summary.bestStreak}
          found={summary.found}
          total={summary.total}
          accuracy={summary.accuracy}
          isBest={summary.isBest}
          previousBest={summary.previousBest}
          missedCount={summary.total - summary.found}
          onPlayAgain={playAgain}
          onReviewMap={playAgain}
        />
      )}
    </div>
  );
}
