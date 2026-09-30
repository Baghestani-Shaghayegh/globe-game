import { afterEach, describe, expect, it, vi } from "vitest";
import { pickVoice, speak } from "./speech";

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
