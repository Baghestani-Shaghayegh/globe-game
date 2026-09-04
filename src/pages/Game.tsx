import { Navigate, useParams } from "react-router-dom";
import GlobeGame from "../features/globe-guess/GlobeGame";
import type { Difficulty } from "../data/countries";

export default function Game() {
  const { difficulty } = useParams();

  if (difficulty !== "easy" && difficulty !== "hard") {
    return <Navigate to="/" replace />;
  }

  return <GlobeGame difficulty={difficulty as Difficulty} />;
}
