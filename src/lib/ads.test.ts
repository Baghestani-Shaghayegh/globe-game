import { beforeEach, describe, expect, it } from "vitest";
import { adsAllowed, adsConfigured } from "./ads";
import { setConsent } from "./consent";

describe("ads", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // The tests run without VITE_ADSENSE_CLIENT, which is the same state a dev
  // machine and every pre-approval build is in.
  it("is off when no publisher id was configured", () => {
    expect(adsConfigured).toBe(false);
  });

  it("stays off even once consent is granted, with no publisher id", () => {
    setConsent("granted");
    expect(adsAllowed()).toBe(false);
  });

  it("is off while the question is unanswered", () => {
    expect(adsAllowed()).toBe(false);
  });

  it("is off after a refusal", () => {
    setConsent("denied");
    expect(adsAllowed()).toBe(false);
  });
});
