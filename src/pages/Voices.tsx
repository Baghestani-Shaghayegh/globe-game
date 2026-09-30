import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/SiteHeader";
import { speak } from "../lib/speech";
import { loadVoiceManifest, type VoiceManifest } from "../lib/voices";

/**
 * Every recorded name, to listen through before they go out: /voices, not
 * linked from anywhere. Mark the ones that sound wrong and copy the list —
 * each becomes a line in scripts/voice/lexicon.tsv, and `npm run voices`
 * remakes just those.
 */
export default function Voices() {
  const [manifest, setManifest] = useState<VoiceManifest | null | undefined>();
  const [filter, setFilter] = useState("");
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadVoiceManifest().then(setManifest);
  }, []);

  const names = useMemo(() => {
    const all = Object.keys(manifest?.clips ?? {}).sort((a, b) => a.localeCompare(b));
    const q = filter.trim().toLowerCase();
    return q ? all.filter((name) => name.toLowerCase().includes(q)) : all;
  }, [manifest, filter]);

  const toggle = (name: string) =>
    setWrong((old) => {
      const next = new Set(old);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText([...wrong].sort().join("\n"));
      setCopied(true);
    } catch {
      /* the list is on screen to copy by hand */
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50">
          Recorded names
        </h1>
        {manifest === undefined && <p className="mt-4 text-zinc-500">Loading…</p>}
        {manifest === null && (
          <p className="mt-4 text-zinc-400">
            No clips yet. Run <code className="text-zinc-200">npm run voices</code>{" "}
            with a Google text-to-speech key set, then reload.
          </p>
        )}
        {manifest && (
          <>
            <p className="mt-2 text-sm text-zinc-500">
              {Object.keys(manifest.clips).length} names · voice {manifest.voice}.
              “Checked” ones are made from the pronunciation list, the rest from
              the spelling. Mark any that sound wrong.
            </p>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter"
              className="mt-4 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/40"
            />
            <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/10">
              {names.map((name) => {
                const clip = manifest.clips[name];
                return (
                  <li key={name} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <button
                      onClick={() => {
                        setPlaying(name);
                        speak(name, () => setPlaying((p) => (p === name ? null : p)));
                      }}
                      aria-label={`Say ${name}`}
                      className={`h-8 w-8 shrink-0 rounded-full text-xs ${
                        playing === name
                          ? "bg-teal-300 text-teal-950"
                          : "bg-white/10 text-zinc-200 hover:bg-white/15"
                      }`}
                    >
                      ▶
                    </button>
                    <span className="min-w-0 flex-1 truncate text-zinc-100">{name}</span>
                    {clip.ipa && (
                      <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">
                        /{clip.ipa}/ · checked
                      </span>
                    )}
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={wrong.has(name)}
                        onChange={() => toggle(name)}
                      />
                      Sounds wrong
                    </label>
                  </li>
                );
              })}
            </ul>
            {wrong.size > 0 && (
              <div className="sticky bottom-4 mt-4 rounded-xl border border-amber-300/30 bg-raised p-4 text-sm">
                <p className="text-zinc-200">
                  {wrong.size} marked: {[...wrong].sort().join(", ")}
                </p>
                <button
                  onClick={copy}
                  className="mt-2 rounded-lg bg-amber-300 px-3 py-1.5 font-semibold text-amber-950"
                >
                  {copied ? "Copied" : "Copy the list"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
