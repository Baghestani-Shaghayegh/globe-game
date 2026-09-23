import { describe, expect, it } from "vitest";
import {
  dayStart,
  describeBucket,
  isDailyBucket,
  monthPeriod,
  monthStart,
  untilWeekEnd,
  weekPeriod,
  weekStart,
} from "./leaderboard";

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

describe("describeBucket", () => {
  it.each([
    ["easy", "Name it · Countries only"],
    ["europe", "Name it · Europe"],
    ["find:europe", "Find it · Europe"],
    ["flag:easy@180", "Flags · Countries only · 3 min"],
    ["famous:asia", "Famous for · Asia"],
    ["sudden:find:europe@180", "Find it · Europe · 3 min · Sudden death"],
    ["blitz:hard", "Name it · Full map · Blitz"],
    ["flag:daily", "Flags · Daily"],
  ])("reads %s as %s", (bucket, expected) => {
    expect(describeBucket(bucket)).toBe(expected);
  });

  it("passes an unknown mode through rather than dropping it", () => {
    expect(describeBucket("find:atlantis")).toBe("Find it · atlantis");
  });

  it("survives a clock the game no longer offers", () => {
    expect(describeBucket("europe@42")).toBe("Name it · Europe · 42s");
  });
});

describe("isDailyBucket", () => {
  it.each(["daily", "flag:daily", "famous:daily", "find:daily"])(
    "recognises %s",
    (bucket) => {
      expect(isDailyBucket(bucket)).toBe(true);
    }
  );

  it.each(["easy", "europe", "flag:easy", "sudden:find:asia"])(
    "leaves %s alone",
    (bucket) => {
      expect(isDailyBucket(bucket)).toBe(false);
    }
  );
});

describe("weekPeriod", () => {
  it("measures last week against the seven days before this one", () => {
    // Wednesday 2026-09-23; its week began Monday the 21st.
    const period = weekPeriod(new Date("2026-09-23T12:00:00Z"));
    expect(iso(period.since)).toBe("2026-09-21T00:00:00.000Z");
    expect(iso(period.prevSince)).toBe("2026-09-14T00:00:00.000Z");
    expect(iso(period.prevUntil)).toBe("2026-09-21T00:00:00.000Z");
  });

  it("leaves no gap between the two windows", () => {
    const period = weekPeriod(new Date("2026-01-01T09:00:00Z"));
    expect(iso(period.prevUntil)).toBe(iso(period.since));
  });

  it("crosses a year boundary backwards", () => {
    // Monday 2026-01-05 -> the week before began Monday, 29 December 2025.
    const period = weekPeriod(new Date("2026-01-05T00:00:00Z"));
    expect(iso(period.since)).toBe("2026-01-05T00:00:00.000Z");
    expect(iso(period.prevSince)).toBe("2025-12-29T00:00:00.000Z");
  });
});

describe("monthStart", () => {
  it("holds still through the month it belongs to", () => {
    for (const day of ["01", "14", "30"]) {
      expect(iso(monthStart(new Date(`2026-09-${day}T18:00:00Z`)))).toBe(
        "2026-09-01T00:00:00.000Z"
      );
    }
  });
});

describe("monthPeriod", () => {
  it("measures last month against the calendar month before", () => {
    const period = monthPeriod(new Date("2026-09-23T12:00:00Z"));
    expect(iso(period.since)).toBe("2026-09-01T00:00:00.000Z");
    expect(iso(period.prevSince)).toBe("2026-08-01T00:00:00.000Z");
    expect(iso(period.prevUntil)).toBe("2026-09-01T00:00:00.000Z");
  });

  it("steps back into the previous year from January", () => {
    const period = monthPeriod(new Date("2026-01-17T12:00:00Z"));
    expect(iso(period.since)).toBe("2026-01-01T00:00:00.000Z");
    expect(iso(period.prevSince)).toBe("2025-12-01T00:00:00.000Z");
  });

  it("does not assume every month is the same length", () => {
    // February 2028 is a leap month; the window before March must still be
    // the whole of it rather than thirty days back from the first.
    const period = monthPeriod(new Date("2028-03-10T12:00:00Z"));
    expect(iso(period.prevSince)).toBe("2028-02-01T00:00:00.000Z");
    expect(iso(period.prevUntil)).toBe("2028-03-01T00:00:00.000Z");
  });
});
