import { Navigate, useParams } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import { getMode } from "../data/modes";

export default function Game() {
  const mode = getMode(useParams().mode);

  if (!mode) return <Navigate to="/" replace />;

  return <GlobeGame mode={mode} />;
}
