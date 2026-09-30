import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildLessons,
  directionFrom,
  edgeOf,
  gapKm,
  groupIntoLessons,
  landBordersOf,
  LESSON_SIZE,
  learnedCountries,
  lessonContinent,
  lessonDone,
  markLearned,
  nextLesson,
  type Lesson,
  type Place,
} from "./lessons";
import { featureCentre, type Geometry } from "./geo";
import { neighboursOf } from "../data/borders";

beforeEach(() => localStorage.clear());

/** The real map, with a point per country, as the lessons page builds it. */
const world: Place[] = (
  JSON.parse(readFileSync("public/data/world.geojson", "utf8")) as {
    features: { properties: { name: string }; geometry: Geometry }[];
  }
).features.map((f) => {
  const { lat, lng } = featureCentre(f.geometry);
  return { name: f.properties.name, lat, lng, edge: edgeOf(f.geometry) };
});

const lessons = buildLessons(world);

describe("the lessons, cut from the real map", () => {
  it("teaches every country exactly once, and no territory", () => {
    const taught = lessons.flatMap((l) => l.countries);
    expect(new Set(taught).size).toBe(taught.length);
    const countries = world.filter((p) => lessonContinent(p.name) !== null);
    expect(taught.sort()).toEqual(countries.map((p) => p.name).sort());
  });

  it("keeps lessons short: three to seven, and mostly five", () => {
    for (const lesson of lessons) {
      expect(lesson.countries.length).toBeGreaterThanOrEqual(3);
      expect(lesson.countries.length).toBeLessThanOrEqual(LESSON_SIZE + 2);
    }
    const fives = lessons.filter((l) => l.countries.length === LESSON_SIZE);
    expect(fives.length / lessons.length).toBeGreaterThan(0.75);
  });

  // The point of grouping by neighbours: what's taught together is close
  // together. Measured border to border: every country with a land border has
  // a classmate within 1,000 km, and an island out in the ocean — Seychelles,
  // Mauritius — one within 2,000, outside the scattered islands of Oceania.
  it("groups countries that are near each other", () => {
    const at = new Map(world.map((p) => [p.name, p]));
    for (const lesson of lessons.filter((l) => l.continent !== "oceania")) {
      for (const name of lesson.countries) {
        const nearest = Math.min(
          ...lesson.countries
            .filter((n) => n !== name)
            .map((n) => gapKm(at.get(name)!, at.get(n)!))
        );
        const limit = neighboursOf(name).length > 0 ? 1000 : 2000;
        expect(nearest, `${name} in ${lesson.id}`).toBeLessThan(limit);
      }
    }
  });

  it("puts Russia with countries it borders", () => {
    const withRussia = lessons.find((l) => l.countries.includes("Russia"))!;
    const touching = ["Finland", "Estonia", "Latvia", "Lithuania", "Belarus", "Ukraine", "Georgia", "Azerbaijan", "Poland"];
    expect(withRussia.countries.some((n) => touching.includes(n))).toBe(true);
  });

  it("keeps the Vatican and San Marino with Italy", () => {
    const withItaly = lessons.find((l) => l.countries.includes("Italy"))!;
    expect(withItaly.countries).toContain("Vatican City");
    expect(withItaly.countries).toContain("San Marino");
  });

  it("puts Spain and Portugal in the same lesson", () => {
    const withSpain = lessons.find((l) => l.countries.includes("Spain"));
    expect(withSpain?.countries).toContain("Portugal");
  });

  it("numbers lessons from 1 within each continent", () => {
    const europe = lessons.filter((l) => l.continent === "europe");
    expect(europe.map((l) => l.number)).toEqual(europe.map((_, i) => i + 1));
    expect(europe[0].id).toBe("europe-1");
  });
});

describe("grouping", () => {
  const line: Place[] = Array.from({ length: 11 }, (_, i) => ({
    name: `P${i}`,
    lat: 0,
    lng: i * 5,
  }));

  it("takes neighbours in fives and shares a stub out rather than leaving it", () => {
    const groups = groupIntoLessons(line, 5, () => []);
    expect(groups.map((g) => g.length).sort()).toEqual([5, 6]);
    // Each lesson is a run of neighbours along the line, not a scatter.
    for (const group of groups) {
      const at = group.map((n) => Number(n.slice(1))).sort((a, b) => a - b);
      expect(at[at.length - 1] - at[0]).toBe(at.length - 1);
    }
    // And the westernmost comes first.
    expect(groups[0]).toContain("P0");
  });

  it("counts countries that share a border as touching, enclaves included", () => {
    const places: Place[] = [
      { name: "Big", lat: 0, lng: 0 },
      { name: "Inside", lat: 0, lng: 0.1 },
      { name: "Far", lat: 30, lng: 30 },
      { name: "Near", lat: 0, lng: 3 },
    ];
    const borders = (n: string) => (n === "Big" ? ["Inside"] : n === "Inside" ? ["Big"] : []);
    const groups = groupIntoLessons(places, 2, borders);
    expect(groups.find((g) => g.includes("Big"))).toContain("Inside");
  });

  it("measures border to border, so a touching giant counts as next door", () => {
    const at = new Map(world.map((p) => [p.name, p]));
    expect(gapKm(at.get("Russia")!, at.get("Belarus")!)).toBe(0);
    // Centre to centre they are thousands of km apart.
    expect(gapKm({ ...at.get("Russia")!, edge: undefined }, at.get("Belarus")!)).toBeGreaterThan(2000);
  });
});

describe("the hint after a miss", () => {
  it("says which way to go", () => {
    expect(directionFrom({ lat: 40, lng: -4 }, { lat: 39.5, lng: -8 })).toBe("west");
    expect(directionFrom({ lat: 0, lng: 0 }, { lat: 10, lng: 0 })).toBe("north");
    expect(directionFrom({ lat: 0, lng: 0 }, { lat: -10, lng: -10 })).toBe("south-west");
  });
});

describe("what has been learned", () => {
  it("remembers a lesson's countries", () => {
    markLearned(["Spain", "Portugal"], new Date("2026-09-30T10:00:00Z"));
    expect(learnedCountries()).toEqual({
      Spain: "2026-09-30T10:00:00.000Z",
      Portugal: "2026-09-30T10:00:00.000Z",
    });
  });

  it("keeps the first date a country was learned", () => {
    markLearned(["Spain"], new Date("2026-09-01T00:00:00Z"));
    markLearned(["Spain"], new Date("2026-09-30T00:00:00Z"));
    expect(learnedCountries().Spain).toBe("2026-09-01T00:00:00.000Z");
  });

  it("calls a lesson done only when all of it is learned", () => {
    const lesson = { id: "x-1", continent: "europe" as const, number: 1, countries: ["Spain", "Portugal"] };
    markLearned(["Spain"]);
    expect(lessonDone(lesson, learnedCountries())).toBe(false);
    markLearned(["Portugal"]);
    expect(lessonDone(lesson, learnedCountries())).toBe(true);
  });

  it("starts fresh on a corrupt value", () => {
    localStorage.setItem("worldguess.learn.v1", "{nope");
    expect(learnedCountries()).toEqual({});
    localStorage.setItem("worldguess.learn.v1", JSON.stringify({ Spain: 7 }));
    expect(learnedCountries()).toEqual({});
  });
});

describe("the next lesson", () => {
  const lessons: Lesson[] = [1, 2, 3, 4].map((n) => ({
    id: `europe-${n}`,
    continent: "europe" as const,
    number: n,
    countries: [`A${n}`, `B${n}`],
  }));
  const at = (iso: string) => new Date(iso);

  it("is the first lesson before anything is learned", () => {
    expect(nextLesson(lessons, {})?.id).toBe("europe-1");
  });

  it("follows the lesson finished last, not the first one skipped", () => {
    markLearned(["A3", "B3"], at("2026-09-30T10:00:00Z"));
    expect(nextLesson(lessons, learnedCountries())?.id).toBe("europe-4");
  });

  it("goes round to the start once the end is done", () => {
    markLearned(["A1", "B1"], at("2026-09-01T00:00:00Z"));
    markLearned(["A4", "B4"], at("2026-09-30T00:00:00Z"));
    expect(nextLesson(lessons, learnedCountries())?.id).toBe("europe-2");
  });

  it("is none once every lesson is done", () => {
    markLearned(lessons.flatMap((l) => l.countries));
    expect(nextLesson(lessons, learnedCountries())).toBeNull();
  });
});

describe("land borders shown in a lesson", () => {
  it("has the microstates the generated list is missing, both ways round", () => {
    expect(landBordersOf("Andorra").sort()).toEqual(["France", "Spain"]);
    expect(landBordersOf("Italy")).toEqual(
      expect.arrayContaining(["San Marino", "Vatican City", "France"])
    );
    expect(landBordersOf("Switzerland")).toContain("Liechtenstein");
  });

  it("gives islands nothing", () => {
    expect(landBordersOf("Iceland")).toEqual([]);
  });

  it("names only countries that are on the map", () => {
    const onMap = new Set(world.map((p) => p.name));
    for (const name of onMap) {
      for (const other of landBordersOf(name)) expect(onMap).toContain(other);
    }
  });
});
