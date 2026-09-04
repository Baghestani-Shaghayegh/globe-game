import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Records from "./pages/Records";

// The game page pulls in three.js (~2 MB) — load it only when a game starts.
const Game = lazy(() => import("./pages/Game"));

function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-white text-lg text-gray-600">
            Loading the globe…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/records" element={<Records />} />
          <Route path="/play/:mode" element={<Game type="name" />} />
          <Route path="/find/:mode" element={<Game type="find" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
