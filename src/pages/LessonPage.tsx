import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getCountryMeta } from "../data/countries";
import { capitalOf } from "../data/capitals";
import { LESSON_CONTINENTS, learnedCountries, markLearned, type Lesson } from "../lib/lessons";
import type { Recall } from "../lib/practice";
import { saveReview } from "../lib/practice";
import { playTap } from "../lib/sound";
import LessonRun, { Flag } from "../features/learn/LessonRun";
import { useLessons } from "../features/learn/useLessons";

const display = (name: string) => getCountryMeta(name).displayName;

const continentOf = (lesson: Lesson) =>
  LESSON_CONTINENTS.find((c) => c.id === lesson.continent)?.name ?? "";

export default function LessonPage() {
  const { id } = useParams();
  const map = useLessons();

  if (map === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page px-6">
        <p className="text-zinc-100">Couldn't load the map data.</p>
        <Link to="/learn" className="text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-100">
          All lessons
        </Link>
      </div>
    );
  }
  if (!map) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page text-zinc-500">
        Loading the lesson…
      </div>
    );
  }
  const at = map.lessons.findIndex((lesson) => lesson.id === id);
  if (at < 0) return <Navigate to="/learn" replace />;
  return (
    // Keyed, so going on to the next lesson starts it from the top.
    <LessonScreen
      key={id}
      lesson={map.lessons[at]}
      next={map.lessons[at + 1] ?? null}
      all={map.lessons}
      features={map.features}
    />
  );
}

function LessonScreen({
  lesson,
  next,
  all,
  features,
}: {
  lesson: Lesson;
  next: Lesson | null;
  all: Lesson[];
  features: Parameters<typeof LessonRun>[0]["features"];
}) {
  const navigate = useNavigate();
  const [countries] = useState(lesson.countries);
  return (
    <LessonRun
      countries={countries}
      features={features}
      heading={`${continentOf(lesson)} · Lesson ${lesson.number}`}
      back={{ label: "Lessons", onClick: () => navigate("/learn") }}
      onFinish={(recalls) => {
        markLearned(lesson.countries);
        // Into the practice deck, so what was just learned comes back to be
        // remembered: a clean one tomorrow, one that needed help today.
        saveReview(recalls);
      }}
      done={(recalls) => (
        <Done
          lesson={lesson}
          next={next}
          all={all}
          recalls={recalls}
          onNext={(to) => {
            playTap();
            navigate(`/learn/${to.id}`);
          }}
        />
      )}
    />
  );
}

/** How far through a set of countries: a bar and the count. */
function Progress({ label, have, of }: { label: string; have: number; of: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-500">
          {have} of {of}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${Math.round((100 * have) / Math.max(1, of))}%` }}
        />
      </div>
    </div>
  );
}

function Done({
  lesson,
  next,
  all,
  recalls,
  onNext,
}: {
  lesson: Lesson;
  next: Lesson | null;
  all: Lesson[];
  recalls: Record<string, Recall>;
  onNext: (lesson: Lesson) => void;
}) {
  const nameOf = (l: Lesson) =>
    LESSON_CONTINENTS.find((c) => c.id === l.continent)?.name ?? "";
  const nextContinent = next ? nameOf(next) : null;
  const continentName = nameOf(lesson);
  // Read after this lesson was filed, so it counts.
  const [learned] = useState(learnedCountries);
  const everyone = all.flatMap((l) => l.countries);
  const continent = all.filter((l) => l.continent === lesson.continent).flatMap((l) => l.countries);
  const clean = lesson.countries.filter((name) => recalls[name] === "clean").length;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-300">
        {continentName} {lesson.number} done
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
        +{lesson.countries.length} on your map
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        {clean === lesson.countries.length
          ? "Every one named without help."
          : `${clean} of ${lesson.countries.length} named without help. The others come back in Practice today.`}
      </p>
      <ul className="mt-4 space-y-2">
        {lesson.countries.map((name) => (
          <li key={name} className="flex items-center gap-3">
            <Flag name={name} className="h-5 w-7 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
              {recalls[name] === "clean" ? "✓ " : ""}
              {display(name)}
            </span>
            <span className="shrink-0 truncate text-xs text-zinc-500">
              {capitalOf(name) ?? ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 space-y-2.5">
        <Progress
          label={continentName}
          have={continent.filter((name) => learned[name]).length}
          of={continent.length}
        />
        <Progress
          label="The world"
          have={everyone.filter((name) => learned[name]).length}
          of={everyone.length}
        />
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {next && (
          <button
            onClick={() => onNext(next)}
            autoFocus
            className="rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-semibold text-teal-950 transition-colors hover:bg-teal-200"
          >
            Play {nextContinent} {next.number} →
          </button>
        )}
        <Link
          to="/learn"
          onClick={playTap}
          className="rounded-lg border border-white/15 px-4 py-2.5 text-center text-sm text-zinc-300 transition-colors hover:text-zinc-100"
        >
          All lessons
        </Link>
      </div>
    </div>
  );
}
