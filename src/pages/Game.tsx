import { Navigate, useParams, useSearchParams } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import FindGame from "../features/globe-guess/FindGame";
import ChallengeBanner from "../components/ChallengeBanner";
import {
  getMode,
  parseCount,
  parseLimit,
  parseRuleset,
  type GameType,
} from "../data/modes";

export default function Game({ type }: { type: GameType }) {
  const mode = getMode(useParams().mode);
  const [params] = useSearchParams();

  if (!mode) return <Navigate to="/" replace />;

  const seconds = parseLimit(params.get("limit"));
  const limitMs = seconds === null ? null : seconds * 1000;
  const ruleset = parseRuleset(params.get("rules"));
  const count = parseCount(params.get("count"));
  const props = { mode, limitMs, ruleset, count };

  // Only "Name it" works the other way round: click a country, type its name.
  return (
    <>
      {type === "name" ? <GlobeGame {...props} /> : <FindGame {...props} type={type} />}
      {/* Opened from a friend's challenge: what to beat, over the game. */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-3 lg:top-4">
        <ChallengeBanner />
      </div>
    </>
  );
}
