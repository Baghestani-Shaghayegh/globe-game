import { useEffect, useState } from "react";
import { featureCentre, type Geometry } from "../../lib/geo";
import { buildLessons, edgeOf, type Lesson, type Place } from "../../lib/lessons";

export type CountryFeature = {
  properties: { name: string; tiny?: boolean };
  geometry: Geometry;
};

export type LessonMap = {
  /** Every country on the map, for drawing the world round a lesson. */
  features: CountryFeature[];
  lessons: Lesson[];
};

/**
 * Cut once per visit and kept. Cutting the map takes about a third of a
 * second, and the list and the lesson both need it — going back and forth
 * between them shouldn't pay it every time.
 */
let pending: Promise<LessonMap> | null = null;

function loadLessons(): Promise<LessonMap> {
  pending ??= fetch("/data/world.geojson")
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data: { features: CountryFeature[] }) => {
      const places: Place[] = data.features.map((feature) => {
        const { lat, lng } = featureCentre(feature.geometry);
        return {
          name: feature.properties.name,
          lat,
          lng,
          edge: edgeOf(feature.geometry),
        };
      });
      return { features: data.features, lessons: buildLessons(places) };
    })
    .catch((error: unknown) => {
      // Not kept: a failed fetch should be tried again next time.
      pending = null;
      throw error;
    });
  return pending;
}

/** The lessons, or null while they load, or "error" if the map didn't. */
export function useLessons(): LessonMap | "error" | null {
  const [map, setMap] = useState<LessonMap | "error" | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadLessons()
      .then((loaded) => {
        if (!cancelled) setMap(loaded);
      })
      .catch(() => {
        if (!cancelled) setMap("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return map;
}

