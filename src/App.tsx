import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Records from "./pages/Records";
import Stats from "./pages/Stats";
import Account from "./pages/Account";
import Leaderboard from "./pages/Leaderboard";
import PlayTogether from "./pages/PlayTogether";
import Achievements from "./pages/Achievements";
import Levels from "./pages/Levels";
import { AuthProvider } from "./features/account/AuthProvider";
import Daily from "./pages/Daily";

// The game page pulls in three.js (~2 MB) — load it only when a game starts.
const Game = lazy(() => import("./pages/Game"));
const Room = lazy(() => import("./pages/Room"));
// Practice runs a real globe round, so it carries the same weight as the game.
const Practice = lazy(() => import("./pages/Practice"));

function App() {
  return (
    <AuthProvider>
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
            <Route path="/daily" element={<Daily />} />
            <Route path="/records" element={<Records />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/account" element={<Account />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/levels" element={<Levels />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/play-together" element={<PlayTogether />} />
            <Route path="/room/:code" element={<Room />} />
            <Route path="/play/:mode" element={<Game type="name" />} />
            <Route path="/find/:mode" element={<Game type="find" />} />
            <Route path="/flags/:mode" element={<Game type="flag" />} />
            <Route path="/famous/:mode" element={<Game type="famous" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
