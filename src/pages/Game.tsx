import { Navigate, useParams, useSearchParams } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import FindGame from "../features/globe-guess/FindGame";
import {
  getMode,
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

  return type === "find" ? (
    <FindGame mode={mode} limitMs={limitMs} ruleset={ruleset} />
  ) : (
    <GlobeGame mode={mode} limitMs={limitMs} ruleset={ruleset} />
  );
}
