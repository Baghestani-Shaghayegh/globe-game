import { CONTINENT_OF, type Continent } from "./continents";

export type CountryTier = "country" | "territory";

export type CountryMeta = {
  /** Name as it appears in public/data/world.geojson — the internal identifier */
  geoName: string;
  /** Name shown to the player and in suggestions */
  displayName: string;
  /** Extra accepted answers (compared after normalization) */
  aliases: string[];
  /** "territory" features only appear in hard mode */
  tier: CountryTier;
  /** Which continent modes this feature appears in — some sit in two */
  continents: Continent[];
};

// world.geojson uses some outdated or unofficial names. These overrides map
// them to the name players expect, plus common alternative answers.
const OVERRIDES: Record<string, { displayName?: string; aliases?: string[] }> = {
  USA: { displayName: "United States", aliases: ["usa", "us", "united states of america", "america"] },
  England: { displayName: "United Kingdom", aliases: ["england", "uk", "great britain", "britain"] },
  "Czech Republic": { displayName: "Czechia", aliases: ["czech republic"] },
  "Democratic Republic of the Congo": {
    aliases: ["drc", "dr congo", "congo kinshasa", "democratic republic of congo"],
  },
  "Republic of the Congo": { aliases: ["congo", "congo brazzaville"] },
  "East Timor": { displayName: "Timor-Leste", aliases: ["east timor"] },
  "Guinea Bissau": { displayName: "Guinea-Bissau" },
  Macedonia: { displayName: "North Macedonia", aliases: ["macedonia"] },
  "Republic of Serbia": { displayName: "Serbia" },
  Swaziland: { displayName: "Eswatini", aliases: ["swaziland"] },
  "The Bahamas": { displayName: "Bahamas" },
  "United Republic of Tanzania": { displayName: "Tanzania" },
  "West Bank": { displayName: "Palestine", aliases: ["west bank"] },
  "Ivory Coast": { aliases: ["cote d'ivoire"] },
  Myanmar: { aliases: ["burma"] },
  Netherlands: { aliases: ["holland"] },
  "United Arab Emirates": { aliases: ["uae"] },
  "Falkland Islands": { aliases: ["falklands", "malvinas"] },
  "Northern Cyprus": { aliases: ["north cyprus"] },
};

// Territories, dependencies, and disputed regions — hard mode only.
const TERRITORIES = new Set([
  "Antarctica",
  "Falkland Islands",
  "French Southern and Antarctic Lands",
  "Greenland",
  "Kosovo",
  "New Caledonia",
  "Northern Cyprus",
  "Puerto Rico",
  "Somaliland",
  "Western Sahara",
]);

export function getCountryMeta(geoName: string): CountryMeta {
  const override = OVERRIDES[geoName];
  return {
    geoName,
    displayName: override?.displayName ?? geoName,
    aliases: override?.aliases ?? [],
    tier: TERRITORIES.has(geoName) ? "territory" : "country",
    // Anything unmapped would be new map data; keep it out of continent modes.
    continents: CONTINENT_OF[geoName] ?? [],
  };
}
