import { Navigate, useParams } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import FindGame from "../features/globe-guess/FindGame";
import { getMode, type GameType } from "../data/modes";

export default function Game({ type }: { type: GameType }) {
  const mode = getMode(useParams().mode);

  if (!mode) return <Navigate to="/" replace />;

  return type === "find" ? <FindGame mode={mode} /> : <GlobeGame mode={mode} />;
}
