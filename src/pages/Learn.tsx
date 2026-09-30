import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/SiteHeader";
import { TabButton, TabRow } from "../components/Tabs";
import { getCountryMeta } from "../data/countries";
import { flagUrl } from "../data/flags";
import type { Continent } from "../data/continents";
import { playTap } from "../lib/sound";
import {
  LESSON_CONTINENTS,
  learnedCountries,
  lessonDone,
  nextLesson,
  type Learned,
  type Lesson,
} from "../lib/lessons";
import { useLessons } from "../features/learn/useLessons";

function LessonCard({
  lesson,
  done,
  next,
}: {
  lesson: Lesson;
  done: boolean;
  next: boolean;
}) {
  return (
    <Link
      to={`/learn/${lesson.id}`}
      onClick={playTap}
      className={`group flex h-full flex-col rounded-xl border p-4 transition-colors ${
        next
          ? "border-teal-300/70 bg-teal-300/[0.07] hover:border-teal-300"
          : "border-white/10 bg-surface hover:border-white/25"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-50">
          Lesson {lesson.number}
        </span>
        {done ? (
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
            ✓ Done
          </span>
        ) : next ? (
          <span className="rounded-full bg-teal-300 px-2 py-0.5 text-xs font-semibold text-teal-950">
            Up next
          </span>
        ) : null}
      </span>
      {/* The flags first: they are what a row of five names can't be, a
          thing to recognise at a glance. */}
      <span className="mt-3 flex gap-1.5" aria-hidden="true">
        {lesson.countries.map((name) => {
          const flag = flagUrl(name);
          return flag ? (
            <img
              key={name}
              src={flag}
              alt=""
              loading="lazy"
              className="h-5 w-7 rounded-[3px] object-cover ring-1 ring-white/10"
            />
          ) : (
            <span key={name} className="h-5 w-7 rounded-[3px] bg-white/10" />
          );
        })}
      </span>
      <span className="mt-2.5 text-sm leading-snug text-zinc-400">
        {lesson.countries.map((name) => getCountryMeta(name).displayName).join(", ")}
      </span>
    </Link>
  );
}

/**
 * Learn the world: every lesson, by continent, with where you're up to.
 *
 * Practice asked "what have you got wrong?", which a beginner can't answer
 * — they haven't played enough to have got anything wrong. This starts from
 * nothing: five neighbouring countries at a time, met, then found, then named.
 */
export default function Learn() {
  const map = useLessons();
  // Read once a visit; a lesson finished elsewhere comes back through a
  // fresh mount of this page anyway.
  const [learned] = useState<Learned>(learnedCountries);
  const lessons = useMemo(
    () => (map && map !== "error" ? map.lessons : []),
    [map]
  );
  const done = (lesson: Lesson) => lessonDone(lesson, learned);
  const next = useMemo(() => nextLesson(lessons, learned), [lessons, learned]);

  const [continent, setContinent] = useState<Continent | null>(null);
  const shown = continent ?? next?.continent ?? "europe";

  const total = useMemo(
    () => lessons.reduce((sum, lesson) => sum + lesson.countries.length, 0),
    [lessons]
  );
  const learnedCount = useMemo(
    () =>
      lessons.reduce(
        (sum, lesson) =>
          sum + lesson.countries.filter((name) => name in learned).length,
        0
      ),
    [lessons, learned]
  );

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        {/* The words follow docs/WRITING.md. */}
        <div className="mt-5 flex flex-col items-center text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Learn the world
          </h1>
          <p className="mt-2 max-w-lg text-zinc-400">
            Each lesson is a handful of neighbours, so every country you learn
            helps you place the next.
          </p>

          {lessons.length > 0 && (
            <div className="mt-5 flex w-full max-w-sm flex-col items-center gap-3">
              <div className="flex w-full items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]"
                >
                  <span
                    className="block h-full rounded-full bg-emerald-400"
                    style={{ width: `${(learnedCount / Math.max(1, total)) * 100}%` }}
                  />
                </span>
                <span className="shrink-0 text-sm tabular-nums text-zinc-400">
                  {learnedCount} / {total} learned
                </span>
              </div>
              {next && (
                <Link
                  to={`/learn/${next.id}`}
                  onClick={playTap}
                  className="rounded-full bg-teal-300 px-6 py-2.5 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
                >
                  Play {LESSON_CONTINENTS.find((c) => c.id === next.continent)?.name}{" "}
                  {next.number} →
                </Link>
              )}
            </div>
          )}
        </div>

        {map === "error" && (
          <p className="mt-10 text-center text-zinc-400">
            Couldn't load the map data.
          </p>
        )}
        {map === null && (
          <p className="mt-10 text-center text-zinc-500">Loading the lessons…</p>
        )}

        {lessons.length > 0 && (
          <>
            <TabRow label="Continent" tablist>
              {LESSON_CONTINENTS.map(({ id, name }) => {
                const ofIt = lessons.filter((l) => l.continent === id);
                return (
                  <TabButton
                    key={id}
                    active={shown === id}
                    onClick={() => setContinent(id)}
                  >
                    {name}{" "}
                    <span className="tabular-nums text-zinc-500">
                      {ofIt.filter(done).length}/{ofIt.length}
                    </span>
                  </TabButton>
                );
              })}
            </TabRow>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lessons
                .filter((lesson) => lesson.continent === shown)
                .map((lesson) => (
                  <li key={lesson.id}>
                    <LessonCard
                      lesson={lesson}
                      done={done(lesson)}
                      next={lesson.id === next?.id}
                    />
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </PageShell>
  );
}
