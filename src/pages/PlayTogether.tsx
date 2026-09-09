import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/account/AuthProvider";
import { accountsEnabled } from "../lib/supabase";
import {
  CODE_LENGTH,
  createRoom,
  describeRoomError,
  isCompleteCode,
  joinRoom,
  normalizeCode,
} from "../lib/rooms";
import { GAME_TYPES, MODES, type GameType, type ModeId } from "../data/modes";

const pillRow =
  "flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/5 p-1";

function pill(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
    active ? "bg-white/15 text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
  }`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07111c] px-5 py-10">
      <main className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          ← Modes
        </Link>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Play together
        </h1>
        {children}
      </main>
    </div>
  );
}

export default function PlayTogether() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [type, setType] = useState<GameType>("find");
  const [modeId, setModeId] = useState<ModeId>("easy");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!accountsEnabled) {
    return (
      <Shell>
        <p className="mt-4 text-zinc-400">
          This copy of the game is running without accounts configured, so there
          is nobody to play against.
        </p>
      </Shell>
    );
  }

  // A room shows names and scores, so it needs both halves of an account.
  if (!session || !profile) {
    return (
      <Shell>
        <p className="mt-4 text-zinc-400">
          Matches show everyone's name, so you'll need one before you can open
          or join a room.
        </p>
        <Link
          to="/account"
          className="mt-6 block w-full rounded-lg bg-sky-500/20 py-2.5 text-center text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30"
        >
          {session ? "Pick a player name" : "Sign in"}
        </Link>
      </Shell>
    );
  }

  const host = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      navigate(`/room/${await createRoom(type, modeId)}`);
    } catch (caught) {
      setError(describeRoomError(caught));
      setBusy(false);
    }
  };

  const join = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !isCompleteCode(code)) return;
    setBusy(true);
    setError(null);
    try {
      await joinRoom(code);
      navigate(`/room/${normalizeCode(code)}`);
    } catch (caught) {
      setError(describeRoomError(caught));
      setBusy(false);
    }
  };

  return (
    <Shell>
      <p className="mt-2 text-sm text-zinc-500">
        Ten countries, both of you at once. Whoever finds each one first scores
        most.
      </p>

      <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="font-medium text-zinc-100">Open a room</h2>

        <div className="mt-4 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="w-10 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
              Game
            </span>
            <div className={pillRow}>
              {GAME_TYPES.filter((t) => t.id !== "name").map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  aria-pressed={type === t.id}
                  className={pill(type === t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="w-10 shrink-0 text-xs uppercase tracking-wider text-zinc-500">
              Map
            </span>
            <div className={pillRow}>
              {MODES.filter((m) => m.id !== "hard").map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setModeId(mode.id)}
                  aria-pressed={modeId === mode.id}
                  className={pill(modeId === mode.id)}
                >
                  {mode.regional ? mode.name : mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={host}
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-sky-500/20 py-2.5 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30 disabled:opacity-50"
        >
          {busy ? "Opening…" : "Open a room"}
        </button>
        <p className="mt-2.5 text-xs text-zinc-600">
          You'll get a six-letter code to send your friend.
        </p>
      </section>

      <form
        onSubmit={join}
        className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      >
        <h2 className="font-medium text-zinc-100">Join with a code</h2>
        <label htmlFor="code" className="sr-only">
          Room code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="ABC123"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={CODE_LENGTH}
          className="mt-4 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-2xl font-medium tracking-[0.3em] text-zinc-100 outline-none placeholder:tracking-[0.3em] placeholder:text-zinc-600 focus:border-white/40"
        />
        <button
          type="submit"
          disabled={busy || !isCompleteCode(code)}
          className="mt-4 w-full rounded-lg bg-white/10 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/15 disabled:opacity-40"
        >
          Join
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
    </Shell>
  );
}
