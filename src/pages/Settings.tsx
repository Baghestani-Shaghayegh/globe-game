import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { choiceClass } from "../components/choice";
import {
  hintsEnabled,
  setHintsEnabled,
  setSoundEnabled,
  soundEnabled,
} from "../lib/prefs";
import { playCorrect } from "../lib/sound";
import { adsConfigured } from "../lib/ads";
import {
  clearConsent,
  readConsent,
  setConsent,
  subscribeToConsent,
} from "../lib/consent";
import { GLOBE_THEMES, activeThemeId } from "../lib/globeTheme";
import { PageShell } from "../components/SiteHeader";
import PaletteSwatch from "../components/PaletteSwatch";

/**
 * A lightbulb, struck through when hints are off. Drawn to the same weight as
 * the speaker beside it, so the two toggles read as one pair of controls.
 */
function BulbIcon({ off }: { off: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 17.5h5M10 20.5h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.3.3.5.7.5 1.1v.5h6v-.5c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3z" />
      {off && <path d="M4 20 20 4" />}
    </svg>
  );
}

/**
 * A speaker, crossed out when the sound is off.
 *
 * Drawn rather than an emoji: 🔊 and 🔇 are a different shape, weight and
 * colour on every platform, and the two of them next to each other on a
 * toggle read as two unrelated pictures.
 */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
      {muted ? (
        <path d="m16 9.5 4 5m0-5-4 5" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
      )}
    </svg>
  );
}

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
      {hint && (
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{hint}</p>
      )}
      <div className={hint ? "mt-3" : "mt-2.5"}>{children}</div>
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

export default function Settings() {
  const [hints, setHints] = useState(hintsEnabled);
  const [sound, setSound] = useState(soundEnabled);
  const palette = GLOBE_THEMES.find((t) => t.id === activeThemeId());

  return (
    <PageShell>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
        Settings
      </h1>

      <Panel>
        {/* One button each, not a pair. "On / Off" asks the player to work
            out which of the two words is the state and which is the choice on
            offer; the icon is the state, and the words beside it are what
            pressing it does. */}
        <Row
          title="Hints"
          hint="A nudge towards the answer."
        >
          <button
            onClick={() => {
              const next = !hints;
              setHints(next);
              setHintsEnabled(next);
            }}
            aria-pressed={hints}
            className={`flex items-center gap-2 ${choiceClass(hints)}`}
          >
            <BulbIcon off={!hints} />
            {hints ? "Turn hints off" : "Turn hints on"}
          </button>
        </Row>

        <Row title="Sound">
          <button
            onClick={() => {
              const next = !sound;
              setSound(next);
              setSoundEnabled(next);
              // Turning it on plays one, so the choice is audible rather
              // than a promise about the next round.
              if (next) playCorrect(3);
            }}
            aria-pressed={sound}
            className={`flex items-center gap-2 ${choiceClass(sound)}`}
          >
            <SpeakerIcon muted={!sound} />
            {sound ? "Mute sound" : "Enable sound"}
          </button>
        </Row>

        {/* The palettes are unlocked by levelling, so they are chosen where
            the levels are rather than duplicated here. */}
        {/* This was a link wearing `choiceClass(false)` — the same muted grey
            the page gives a disabled button, on the one control here that
            goes somewhere. It shows the palette in use and says what pressing
            it does. */}
        <Row title="Globe palette" hint="New palettes unlock as you level up.">
          <Link
            to="/levels"
            aria-label={`Change globe palette, currently ${palette?.name ?? "Meridian"}`}
            className="inline-flex items-center gap-2.5 rounded-lg border border-white/15 bg-white/[0.05] py-1.5 pl-2 pr-3 text-sm font-medium text-zinc-100 transition-colors hover:border-teal-300/50 hover:bg-white/[0.09]"
          >
            {palette && <PaletteSwatch theme={palette} className="h-6 w-6" />}
            {palette?.name ?? "Meridian"}
            <span className="text-zinc-500">Change</span>
            <span aria-hidden="true" className="text-zinc-500">
              ›
            </span>
          </Link>
        </Row>
      </Panel>

      {adsConfigured && (
        <Panel>
          <Cookies />
        </Panel>
      )}

    </PageShell>
  );
}
