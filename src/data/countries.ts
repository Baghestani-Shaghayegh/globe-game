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

  // The short forms people actually type. Only the unambiguous ones: "sa" is
  // South Africa to some and Saudi Arabia to others, so neither gets it.
  "Central African Republic": { aliases: ["car", "central africa"] },
  "Bosnia and Herzegovina": { aliases: ["bosnia", "bih"] },
  "Papua New Guinea": { aliases: ["png"] },
  "New Zealand": { aliases: ["nz"] },
  "South Korea": { aliases: ["republic of korea", "rok"] },
  "North Korea": { aliases: ["dprk"] },
  "Dominican Republic": { aliases: ["dominican rep"] },
  "Trinidad and Tobago": { aliases: ["trinidad", "tt"] },
  "Antigua and Barbuda": { aliases: ["antigua"] },
  "Saint Kitts and Nevis": { aliases: ["st kitts", "st kitts and nevis"] },
  "Saint Lucia": { aliases: ["st lucia"] },
  "Saint Vincent and the Grenadines": { aliases: ["st vincent", "svg"] },
  "Sao Tome and Principe": { aliases: ["sao tome"] },
  "Vatican City": { aliases: ["vatican", "holy see"] },
  "Cabo Verde": { aliases: ["cape verde"] },
  Kyrgyzstan: { aliases: ["kyrgyz republic"] },
  Laos: { aliases: ["lao"] },
  Vietnam: { aliases: ["viet nam"] },
  "Solomon Islands": { aliases: ["solomons"] },
  "Marshall Islands": { aliases: ["marshalls"] },
};

// Territories, dependencies, and disputed regions — hard mode only.
/**
 * Not sovereign states: dependencies, overseas parts of other countries, and
 * the disputed places this game has always counted separately.
 *
 * This is exactly what "Full map" adds to "Countries only", and it has to
 * agree with scripts/map-names.mjs — the map is built from that list, and a
 * place classified one way there and another way here would be counted twice
 * or not at all. A test compares the two.
 */
const TERRITORIES = new Set([
  "American Samoa",
  "Anguilla",
  "Antarctica",
  "Aruba",
  "Bermuda",
  "British Indian Ocean Territory",
  "British Virgin Islands",
  "Cayman Islands",
  "Cook Islands",
  "Curaçao",
  "Falkland Islands",
  "Faroe Islands",
  "French Polynesia",
  "French Southern and Antarctic Lands",
  "Gibraltar",
  "Greenland",
  "Guam",
  "Guernsey",
  "Heard Island and McDonald Islands",
  "Hong Kong",
  "Isle of Man",
  "Jersey",
  "Kosovo",
  "Macao",
  "Montserrat",
  "New Caledonia",
  "Niue",
  "Norfolk Island",
  "Northern Cyprus",
  "Northern Mariana Islands",
  "Pitcairn Islands",
  "Puerto Rico",
  "Saint Barthelemy",
  "Saint Helena",
  "Saint Martin",
  "Saint Pierre and Miquelon",
  "Sint Maarten",
  "Somaliland",
  "South Georgia and the South Sandwich Islands",
  "Turks and Caicos Islands",
  "United States Virgin Islands",
  "Wallis and Futuna",
  "Western Sahara",
  "Åland",
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
