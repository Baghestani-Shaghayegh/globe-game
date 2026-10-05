import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { DEVICE_SAY, pickVoice, speak } from "./speech";

const voice = (lang: string, localService = true) =>
  ({ lang, localService, name: lang }) as SpeechSynthesisVoice;

describe("which voice says the names", () => {
  it("prefers a British English voice on the device", () => {
    expect(
      pickVoice([voice("fr-FR"), voice("en-US"), voice("en-GB", false), voice("en-GB")])
    ).toEqual(voice("en-GB"));
  });

  it("falls back to any English, then to none", () => {
    expect(pickVoice([voice("de-DE"), voice("en-AU")])?.lang).toBe("en-AU");
    expect(pickVoice([voice("de-DE")])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
});

describe("saying a name", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("cuts off the last name rather than queueing behind it", () => {
    const said: string[] = [];
    const cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      cancel,
      getVoices: () => [voice("en-GB")],
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
    speak("Andorra");
    speak("Andorra la Vella");
    expect(said).toEqual(["Andorra", "Andorra la Vella"]);
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});

describe("names the device voice reads wrong", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("says the respelling, not the spelling", () => {
    const said: string[] = [];
    vi.stubGlobal("speechSynthesis", {
      cancel: () => {},
      getVoices: () => [voice("en-GB")],
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
    speak("Czechia");
    speak("Portugal");
    expect(said).toEqual(["Checkia", "Portugal"]);
  });

  it("only respells names the recorded voice has a pronunciation for", () => {
    const lexicon = new Set(
      readFileSync("scripts/voice/lexicon.tsv", "utf8")
        .split("\n")
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => line.split("\t")[0])
    );
    for (const name of Object.keys(DEVICE_SAY)) expect(lexicon.has(name), name).toBe(true);
  });
});
