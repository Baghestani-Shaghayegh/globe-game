import { Navigate, useParams, useSearchParams } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import FindGame from "../features/globe-guess/FindGame";
import FlagGame from "../features/globe-guess/FlagGame";
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

  const props = { mode, limitMs, ruleset };
  if (type === "find") return <FindGame {...props} />;
  if (type === "flag") return <FlagGame {...props} />;
  return <GlobeGame {...props} />;
}
