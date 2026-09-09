import { describe, expect, it } from "vitest";
import { dayStart, untilWeekEnd, weekStart } from "./leaderboard";

const iso = (date: Date) => date.toISOString();

describe("weekStart", () => {
  it("holds still through the week it belongs to", () => {
    // 2026-09-09 is a Wednesday; its week began Monday the 7th.
    const monday = "2026-09-07T00:00:00.000Z";
    for (const day of ["07", "08", "09", "10", "11", "12", "13"]) {
      expect(iso(weekStart(new Date(`2026-09-${day}T12:00:00Z`)))).toBe(monday);
    }
  });

  it("keeps Sunday in the week that began six days earlier", () => {
    expect(iso(weekStart(new Date("2026-09-13T23:59:59Z")))).toBe(
      "2026-09-07T00:00:00.000Z"
    );
  });

  it("rolls over at Monday midnight UTC, not a minute before", () => {
    expect(iso(weekStart(new Date("2026-09-13T23:59:59Z")))).toBe(
      "2026-09-07T00:00:00.000Z"
    );
    expect(iso(weekStart(new Date("2026-09-14T00:00:00Z")))).toBe(
      "2026-09-14T00:00:00.000Z"
    );
  });

  it("crosses a month boundary", () => {
    // Tuesday 2026-09-01 belongs to the week that began Monday, 31 August.
    expect(iso(weekStart(new Date("2026-09-01T08:00:00Z")))).toBe(
      "2026-08-31T00:00:00.000Z"
    );
  });

  it("crosses a year boundary", () => {
    // Friday 2027-01-01 belongs to the week that began Monday, 28 December.
    expect(iso(weekStart(new Date("2027-01-01T08:00:00Z")))).toBe(
      "2026-12-28T00:00:00.000Z"
    );
  });

  it("lands on a Monday, whatever day it is given", () => {
    for (let i = 0; i < 400; i += 1) {
      const at = new Date(Date.UTC(2026, 0, 1 + i, 13, 37));
      expect(weekStart(at).getUTCDay()).toBe(1);
      expect(weekStart(at).getTime()).toBeLessThanOrEqual(at.getTime());
    }
  });
});

describe("dayStart", () => {
  it("strips the time, in UTC", () => {
    expect(iso(dayStart(new Date("2026-09-09T23:59:59Z")))).toBe(
      "2026-09-09T00:00:00.000Z"
    );
  });
});

describe("untilWeekEnd", () => {
  it.each([
    // A week that has just turned over has all seven days left.
    ["2026-09-07T00:00:00Z", "7 days"],
    ["2026-09-12T00:00:00Z", "2 days"],
    ["2026-09-13T00:00:00Z", "1 day"],
    ["2026-09-13T13:00:00Z", "11 hours"],
    ["2026-09-13T23:00:00Z", "1 hour"],
    ["2026-09-13T23:59:00Z", "0 hours"],
  ])("reads %s as %s left", (at, expected) => {
    expect(untilWeekEnd(new Date(at))).toBe(expected);
  });
});
