import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { choiceClass } from "../components/choice";
import { hintsEnabled, setHintsEnabled } from "../lib/prefs";
import { adsConfigured } from "../lib/ads";
import {
  clearConsent,
  readConsent,
  setConsent,
  subscribeToConsent,
} from "../lib/consent";
import {
  LOCAL_SUMMARY,
  clearLocalData,
  storedCount,
} from "../lib/localData";
import { GLOBE_THEMES, activeThemeId } from "../lib/globeTheme";

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{hint}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {children}
    </div>
  );
}

/** The cookie answer, shown as what it is and changeable either way. */
function Cookies() {
  const consent = useSyncExternalStore(subscribeToConsent, readConsent);

  return (
    <Row
      title="Advertising cookies"
      hint={
        consent === "granted"
          ? "Allowed. Ads may use cookies to choose what to show you."
          : consent === "denied"
            ? "Refused. No ad script is loaded at all."
            : "Not answered yet. Nothing is loaded until you choose."
      }
    >
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setConsent("granted")}
          aria-pressed={consent === "granted"}
          className={choiceClass(consent === "granted")}
        >
          Allow
        </button>
        <button
          onClick={() => setConsent("denied")}
          aria-pressed={consent === "denied"}
          className={choiceClass(consent === "denied")}
        >
          Refuse
        </button>
        {consent !== null && (
          <button
            onClick={clearConsent}
            className="px-2 text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
          >
            Ask me again
          </button>
        )}
      </div>
    </Row>
  );
}

/** Erasing everything, behind a second press rather than a browser dialog. */
function ClearData() {
  const [asking, setAsking] = useState(false);
  const [cleared, setCleared] = useState(false);
  const count = storedCount();

  if (cleared) {
    return (
      <Row
        title="Your data"
        hint="Erased. Reload the page and the game starts over."
      >
        <button
          onClick={() => window.location.reload()}
          className={choiceClass(false)}
        >
          Reload
        </button>
      </Row>
    );
  }

  return (
    <Row
      title="Your data"
      hint={
        count === 0
          ? "Nothing saved on this device yet."
          : "Everything below lives in this browser and nowhere else. There is no copy to restore from."
      }
    >
      {count > 0 && (
        <ul className="mb-3 space-y-1 text-xs text-zinc-500">
          {LOCAL_SUMMARY.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}
      {asking ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-rose-300">
            Erase all of it? This can't be undone.
          </span>
          <button
            onClick={() => {
              clearLocalData();
              setCleared(true);
            }}
            className="rounded-lg border border-rose-400/40 bg-rose-400/15 px-3 py-1.5 text-sm font-medium text-rose-100 transition-colors hover:bg-rose-400/25"
          >
            Erase everything
          </button>
          <button
            onClick={() => setAsking(false)}
            className="px-2 text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAsking(true)}
          disabled={count === 0}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-zinc-400 transition-all hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-zinc-400"
        >
          Clear my data
        </button>
      )}
    </Row>
  );
}

export default function Settings() {
  const [hints, setHints] = useState(hintsEnabled);
  const palette = GLOBE_THEMES.find((t) => t.id === activeThemeId());

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
          Settings
        </h1>

        <Panel>
          <Row
            title="Hints"
            hint="A nudge towards the answer, paid for in points. Off means you can still be shown an answer to move on."
          >
            <div className="flex flex-wrap gap-1.5">
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  onClick={() => {
                    setHints(on);
                    setHintsEnabled(on);
                  }}
                  aria-pressed={hints === on}
                  className={choiceClass(hints === on)}
                >
                  {on ? "On" : "Off"}
                </button>
              ))}
            </div>
          </Row>

          {/* The palettes are unlocked by levelling, so they are chosen where
              the levels are rather than duplicated here. */}
          <Row
            title="Globe palette"
            hint={`Currently ${palette?.name ?? "Atlantic"}. New palettes unlock as you level up.`}
          >
            <Link to="/levels" className={`inline-block ${choiceClass(false)}`}>
              Choose a palette
            </Link>
          </Row>
        </Panel>

        {adsConfigured && (
          <Panel>
            <Cookies />
          </Panel>
        )}

        <Panel>
          <ClearData />
        </Panel>

        <p className="mt-6 text-sm text-zinc-500">
          Your account, if you have one, is managed on the{" "}
          <Link
            to="/account"
            className="text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
          >
            account page
          </Link>
          . What the game stores and why is set out in the{" "}
          <Link
            to="/privacy"
            className="text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
          >
            privacy policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
