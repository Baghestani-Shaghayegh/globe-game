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
  // The short forms people type. Only the full names were accepted, so
  // "South Georgia" read as wrong while "South Georgia and the South Sandwich
  // Islands" was right.
  "South Georgia and the South Sandwich Islands": {
    aliases: ["south georgia", "south sandwich islands", "south georgia and south sandwich islands"],
  },
  "Saint Helena": { aliases: ["st helena"] },
  "Saint Martin": { aliases: ["st martin"] },
  "Sint Maarten": { aliases: ["st maarten", "saint maarten"] },
  "Saint Barthelemy": { aliases: ["st barthelemy", "st barts", "saint barts", "st barths"] },
  "Saint Pierre and Miquelon": { aliases: ["st pierre and miquelon", "st pierre", "saint pierre"] },
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

/**
 * The country each territory is part of, for the rounds that don't ask about
 * territories. Left out, Hong Kong was a grey speck on China's coast that
 * couldn't be clicked, and read as something the player had missed. Now it
 * takes China's colour and a click on it is a click on China.
 *
 * Only where nobody disputes it. Kosovo, Northern Cyprus, Somaliland, Western
 * Sahara, the Falklands, South Georgia, Gibraltar and the Chagos Islands stay
 * grey, as do the Cook Islands and Niue, which run their own affairs.
 * Map names: "USA" and "England" are the United States and United Kingdom.
 */
export const BELONGS_TO: Record<string, string> = {
  "American Samoa": "USA",
  Guam: "USA",
  "Northern Mariana Islands": "USA",
  "Puerto Rico": "USA",
  "United States Virgin Islands": "USA",
  Anguilla: "England",
  Bermuda: "England",
  "British Virgin Islands": "England",
  "Cayman Islands": "England",
  Guernsey: "England",
  "Isle of Man": "England",
  Jersey: "England",
  Montserrat: "England",
  "Pitcairn Islands": "England",
  "Saint Helena": "England",
  "Turks and Caicos Islands": "England",
  "French Polynesia": "France",
  "French Southern and Antarctic Lands": "France",
  "New Caledonia": "France",
  "Saint Barthelemy": "France",
  "Saint Martin": "France",
  "Saint Pierre and Miquelon": "France",
  "Wallis and Futuna": "France",
  Aruba: "Netherlands",
  "Curaçao": "Netherlands",
  "Sint Maarten": "Netherlands",
  "Faroe Islands": "Denmark",
  Greenland: "Denmark",
  "Heard Island and McDonald Islands": "Australia",
  "Norfolk Island": "Australia",
  "Hong Kong": "China",
  Macao: "China",
  "Åland": "Finland",
};

/**
 * Which country a click on `name` is about: the place itself when the round
 * asks about it, else the country it belongs to when that one is asked.
 * Null for scenery the round has nothing to do with.
 */
export function standsFor(name: string, inPlay: ReadonlySet<string>): string | null {
  if (inPlay.has(name)) return name;
  const owner = BELONGS_TO[name];
  return owner && inPlay.has(owner) ? owner : null;
}

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
