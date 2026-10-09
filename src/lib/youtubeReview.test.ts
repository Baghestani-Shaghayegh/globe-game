import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reviewMode, youtubeDirect } from "./youtube";

/** A tab: its address and its session storage. */
function tab(search: string) {
  const store = new Map<string, string>();
  vi.stubGlobal("location", { search });
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  return (next: string) => vi.stubGlobal("location", { search: next });
}

describe("review mode for Google's reviewers", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("is off for everyone else", () => {
    tab("");
    expect(reviewMode()).toBe(false);
  });

  it("turns on from ?review=youtube and stays on for the tab", () => {
    const go = tab("?review=youtube");
    expect(reviewMode()).toBe(true);
    go("");
    expect(reviewMode()).toBe(true);
    expect(youtubeDirect()).toBe(true);
  });

  it("ignores any other value", () => {
    tab("?review=yes");
    expect(reviewMode()).toBe(false);
  });

  it("stays off when storage is blocked", () => {
    vi.stubGlobal("location", { search: "" });
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(reviewMode()).toBe(false);
  });
});
