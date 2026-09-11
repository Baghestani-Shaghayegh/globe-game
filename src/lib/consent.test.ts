import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearConsent,
  readConsent,
  setConsent,
  subscribeToConsent,
} from "./consent";

describe("consent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts unanswered", () => {
    expect(readConsent()).toBe(null);
  });

  it("remembers both answers", () => {
    setConsent("granted");
    expect(readConsent()).toBe("granted");
    setConsent("denied");
    expect(readConsent()).toBe("denied");
  });

  // The reason the store has three states rather than a boolean: a "no" has to
  // be told apart from "not asked", or the banner would come back every visit.
  it("tells a refusal apart from an unanswered question", () => {
    setConsent("denied");
    expect(readConsent()).not.toBe(null);
    clearConsent();
    expect(readConsent()).toBe(null);
  });

  it("treats a corrupt value as unanswered", () => {
    localStorage.setItem("worldguess.consent.v1", "yes please");
    expect(readConsent()).toBe(null);
  });

  it("reads as unanswered when storage is gone", () => {
    const storage = globalThis.localStorage;
    // @ts-expect-error — deleting it is the point: this is the private-window case.
    delete globalThis.localStorage;
    expect(readConsent()).toBe(null);
    expect(() => setConsent("granted")).not.toThrow();
    globalThis.localStorage = storage;
  });

  it("tells subscribers when the answer changes", () => {
    const listener = vi.fn();
    const stop = subscribeToConsent(listener);
    setConsent("granted");
    expect(listener).toHaveBeenCalledTimes(1);
    clearConsent();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    setConsent("denied");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
