import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { voiceSlug, voiceTexts } from "./voices";

const world: string[] = (
  JSON.parse(readFileSync("public/data/world.geojson", "utf8")) as {
    features: { properties: { name: string } }[];
  }
).features.map((f) => f.properties.name);

const lexicon = readFileSync("scripts/voice/lexicon.tsv", "utf8")
  .split("\n")
  .filter((line) => line.trim() && !line.startsWith("#"))
  .map((line) => line.split("\t"));

describe("the names that get a recorded clip", () => {
  const names = voiceTexts(world);

  it("are every country a lesson teaches and its capital", () => {
    expect(names).toContain("Portugal");
    expect(names).toContain("Lisbon");
    expect(names).toContain("Ouagadougou");
    // Territories aren't taught, so aren't said.
    expect(names).not.toContain("Greenland");
    expect(names.length).toBeGreaterThan(350);
  });

  it("each save to a different file", () => {
    const slugs = names.map(voiceSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(voiceSlug("São Tomé")).toBe("sao-tome");
    expect(voiceSlug("St. George's")).toBe("st-george-s");
  });
});

describe("the pronunciation list", () => {
  it("only names names the game says, each once", () => {
    const names = new Set(voiceTexts(world));
    const listed = lexicon.map(([name]) => name);
    for (const name of listed) expect(names).toContain(name);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("is IPA with the stress marked", () => {
    for (const [name, ipa] of lexicon) {
      expect(ipa, name).toMatch(/^[a-zæɑɒɔəɛɜɪʊʌŋʃʒθðɹɡːˈˌ ]+$/u);
      // One-syllable names (Laos) need no mark; every other one has its stress.
      const syllables = ipa.match(/[aeiouæɑɒɔəɛɜɪʊʌ]+/gu) ?? [];
      if (syllables.length > 1) expect(ipa, name).toMatch(/ˈ/u);
    }
  });
});

describe("playing a name", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock("./voices");
  });

  it("plays the recorded clip when there is one", async () => {
    vi.doMock("./voices", () => ({
      voiceManifestNow: () => ({ voice: "v", clips: { Kiribati: { file: "kiribati.mp3", v: "ab12" } } }),
      clipUrl: (c: { file: string; v?: string }) => `/voice/${c.file}?v=${c.v}`,
    }));
    const played: string[] = [];
    vi.stubGlobal(
      "Audio",
      class {
        src: string;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(src: string) {
          this.src = src;
        }
        play() {
          played.push(this.src);
          return Promise.resolve();
        }
        pause() {}
      }
    );
    const said: string[] = [];
    vi.stubGlobal("speechSynthesis", {
      cancel: () => {},
      getVoices: () => [],
      speak: (u: { text: string }) => said.push(u.text),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      }
    );
    const { speak } = await import("./speech");
    speak("Kiribati");
    speak("Madrid");
    expect(played).toEqual(["/voice/kiribati.mp3?v=ab12"]);
    // No clip for Madrid: the device says it.
    expect(said).toEqual(["Madrid"]);
  });
});
