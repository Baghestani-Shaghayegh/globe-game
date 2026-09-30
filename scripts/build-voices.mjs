// Makes the recorded names a lesson plays: one MP3 per country and capital,
// saved to public/voice with a manifest the game reads.
//
//   GOOGLE_TTS_API_KEY=… npm run voices             make any that are missing
//   GOOGLE_TTS_API_KEY=… npm run voices -- --force  remake them all
//   GOOGLE_TTS_API_KEY=… npm run voices -- --only "Kiribati" --only "Lome"
//
// Uses Google Cloud Text-to-Speech. Names in scripts/voice/lexicon.tsv are
// made from their IPA pronunciation; the rest from the spelling. A clip is
// remade only when its pronunciation or the voice changed, so fixing one line
// of the lexicon costs one request. All ~385 names are about 5,000
// characters, well inside the free monthly allowance.

import { createHash } from "node:crypto";
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "voice");
const manifestPath = join(outDir, "manifest.json");

// A British neural voice, since the game spells the British way. Override
// with VOICE_NAME to try another; changing it remakes every clip.
const VOICE = process.env.VOICE_NAME ?? "en-GB-Neural2-C";
const RATE = 0.9;

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.flatMap((a, i) => (a === "--only" ? [args[i + 1]] : []));

const key = process.env.GOOGLE_TTS_API_KEY;
if (!key) {
  console.error(
    "GOOGLE_TTS_API_KEY is not set. Make a key for the Cloud Text-to-Speech API\n" +
      "in Google Cloud (APIs & Services → Credentials) and run again with it set."
  );
  process.exit(1);
}

// The names come from the game's own data, so the clips can't drift from
// what a lesson shows. The TypeScript is bundled on the fly to read it.
async function gameNames() {
  const { outputFiles } = await build({
    stdin: {
      contents: `
        import { voiceTexts, voiceSlug } from "./src/lib/voices";
        export { voiceTexts, voiceSlug };
      `,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  const url = `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`;
  const { voiceTexts, voiceSlug } = await import(url);
  const geo = JSON.parse(readFileSync(join(root, "public", "data", "world.geojson"), "utf8"));
  const names = voiceTexts(geo.features.map((f) => f.properties.name));
  return { names, voiceSlug };
}

function readLexicon() {
  const lexicon = new Map();
  const text = readFileSync(join(root, "scripts", "voice", "lexicon.tsv"), "utf8");
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [name, ipa] = line.split("\t");
    if (name && ipa) lexicon.set(name, ipa.trim());
  }
  return lexicon;
}

const escapeXml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function synthesize(name, ipa) {
  const ssml = ipa
    ? `<speak><phoneme alphabet="ipa" ph="${escapeXml(ipa)}">${escapeXml(name)}</phoneme></speak>`
    : `<speak>${escapeXml(name)}</speak>`;
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { ssml },
        voice: { languageCode: VOICE.slice(0, 5), name: VOICE },
        audioConfig: { audioEncoding: "MP3", speakingRate: RATE },
      }),
    }
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const { audioContent } = await res.json();
  return Buffer.from(audioContent, "base64");
}

const { names, voiceSlug } = await gameNames();
const lexicon = readLexicon();
for (const name of lexicon.keys()) {
  if (!names.includes(name)) console.warn(`lexicon: "${name}" is not a name the game uses`);
}

mkdirSync(outDir, { recursive: true });
const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
const clips = {};
const failed = [];
let made = 0;

for (const name of names) {
  const file = `${voiceSlug(name)}.mp3`;
  const ipa = lexicon.get(name);
  const before = old?.voice === VOICE ? old.clips?.[name] : undefined;
  const unchanged =
    before && before.ipa === ipa && existsSync(join(outDir, file)) && !force;
  if ((unchanged && !only.length) || (only.length && !only.includes(name))) {
    if (before) clips[name] = before;
    continue;
  }
  try {
    const audio = await synthesize(name, ipa);
    writeFileSync(join(outDir, file), audio);
    // A version from the audio itself, so a remade clip gets a new URL and
    // players' caches fetch it rather than keep the old one.
    const v = createHash("sha1").update(audio).digest("hex").slice(0, 8);
    clips[name] = ipa ? { file, v, ipa } : { file, v };
    made += 1;
    process.stdout.write(`✓ ${name}${ipa ? `  /${ipa}/` : ""}\n`);
  } catch (error) {
    failed.push(`${name}: ${error.message.slice(0, 200)}`);
    if (before) clips[name] = before;
  }
}

writeFileSync(manifestPath, JSON.stringify({ voice: VOICE, clips }, null, 1) + "\n");
console.log(`\n${made} made, ${Object.keys(clips).length} of ${names.length} names have a clip.`);
if (failed.length) {
  console.log(`\n${failed.length} failed:\n  ${failed.join("\n  ")}`);
  process.exitCode = 1;
}
