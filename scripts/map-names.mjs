/**
 * How Natural Earth's names line up with the ones this game is keyed on.
 *
 * Every table in src/data — areas, borders, capitals, clues, flags,
 * continents — is keyed by the name in the map file, and so are the player's
 * own country statistics and practice deck, saved on their device. So the
 * names already in use are fixed points: the new map has to produce them
 * exactly, or a player's history quietly detaches from the countries it is
 * about. Where Natural Earth spells a country differently, it is renamed to
 * what we already call it, never the other way round.
 */
export const RENAME = {
  // Not renamed: Macedonia. The map file has always called it that and every
  // table is keyed on it; the printed name comes from OVERRIDES instead.
  "United States of America": "USA",
  "United Kingdom": "England",
  Czechia: "Czech Republic",
  Bahamas: "The Bahamas",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Central African Rep.": "Central African Republic",
  "Côte d'Ivoire": "Ivory Coast",
  "Dem. Rep. Congo": "Democratic Republic of the Congo",
  Congo: "Republic of the Congo",
  "N. Cyprus": "Northern Cyprus",
  "Dominican Rep.": "Dominican Republic",
  "Falkland Is.": "Falkland Islands",
  "Guinea-Bissau": "Guinea Bissau",
  "Eq. Guinea": "Equatorial Guinea",
  "W. Sahara": "Western Sahara",
  "S. Sudan": "South Sudan",
  "Solomon Is.": "Solomon Islands",
  Serbia: "Republic of Serbia",
  eSwatini: "Swaziland",
  "Timor-Leste": "East Timor",
  Tanzania: "United Republic of Tanzania",
  Palestine: "West Bank",
  "Fr. S. Antarctic Lands": "French Southern and Antarctic Lands",
  // Newly present, and spelled in the abbreviated style Natural Earth uses.
  "Antigua and Barb.": "Antigua and Barbuda",
  "Marshall Is.": "Marshall Islands",
  "St. Kitts and Nevis": "Saint Kitts and Nevis",
  "St. Vin. and Gren.": "Saint Vincent and the Grenadines",
  "São Tomé and Principe": "Sao Tome and Principe",
  "Faeroe Is.": "Faroe Islands",
  "Fr. Polynesia": "French Polynesia",
  "N. Mariana Is.": "Northern Mariana Islands",
  "Cayman Is.": "Cayman Islands",
  "Turks and Caicos Is.": "Turks and Caicos Islands",
  "British Virgin Is.": "British Virgin Islands",
  "U.S. Virgin Is.": "United States Virgin Islands",
  "Cook Is.": "Cook Islands",
  "Pitcairn Is.": "Pitcairn Islands",
  "St. Pierre and Miquelon": "Saint Pierre and Miquelon",
  "St-Martin": "Saint Martin",
  "St-Barthélemy": "Saint Barthelemy",
  "Wallis and Futuna Is.": "Wallis and Futuna",
  "S. Geo. and the Is.": "South Georgia and the South Sandwich Islands",
  "Br. Indian Ocean Ter.": "British Indian Ocean Territory",
  "Heard I. and McDonald Is.": "Heard Island and McDonald Islands",
  "Saint Helena": "Saint Helena",
  "Norfolk Island": "Norfolk Island",
  Vatican: "Vatican City",
};

/**
 * Places on the map that are not somewhere anyone is asked to name.
 *
 * Sovereign base areas, a buffer zone, a cosmodrome, a glacier nobody lives
 * on, and a handful of contested reefs. Natural Earth draws them because it is
 * a map; a geography quiz that asked for Serranilla Bank would be a quiz about
 * Natural Earth.
 */
export const NOT_A_PLACE = new Set([
  "Akrotiri",
  "Dhekelia",
  "Baikonur",
  "Siachen Glacier",
  "USNB Guantanamo Bay",
  "Cyprus U.N. Buffer Zone",
  "Bajo Nuevo Bank",
  "Serranilla Bank",
  "Scarborough Reef",
  "Spratly Is.",
  "Coral Sea Is.",
  "Ashmore and Cartier Is.",
  "Clipperton I.",
  "Indian Ocean Ter.",
  "U.S. Minor Outlying Is.",
]);

/**
 * Not sovereign states: dependencies, overseas parts of other countries, and
 * the disputed places this game already treated as territories.
 *
 * These are what "Full map" adds to "Countries only". The four the game
 * already called territories — Kosovo, Northern Cyprus, Somaliland, Western
 * Sahara — keep that classification rather than being promoted, so nobody's
 * existing records change meaning.
 */
export const TERRITORY = new Set([
  "Antarctica",
  "French Southern and Antarctic Lands",
  "Northern Cyprus",
  "Falkland Islands",
  "Greenland",
  "Kosovo",
  "New Caledonia",
  "Puerto Rico",
  "Western Sahara",
  "Somaliland",
  "Hong Kong",
  "Macao",
  "Gibraltar",
  "Bermuda",
  "Guam",
  "American Samoa",
  "Northern Mariana Islands",
  "Aruba",
  "Curaçao",
  "Sint Maarten",
  "Saint Martin",
  "Saint Barthelemy",
  "Anguilla",
  "Montserrat",
  "Cayman Islands",
  "Turks and Caicos Islands",
  "British Virgin Islands",
  "United States Virgin Islands",
  "Faroe Islands",
  "Isle of Man",
  "Jersey",
  "Guernsey",
  "Åland",
  "French Polynesia",
  "Wallis and Futuna",
  "Cook Islands",
  "Niue",
  "Norfolk Island",
  "Pitcairn Islands",
  "Saint Pierre and Miquelon",
  "Saint Helena",
  "South Georgia and the South Sandwich Islands",
  "British Indian Ocean Territory",
  "Heard Island and McDonald Islands",
]);

/**
 * Taiwan and West Bank are deliberately absent from that list.
 *
 * Both are already on this map and already counted as countries, so demoting
 * them would change what "Countries only" means for every player who has a
 * record in it. A classification argument is not worth rewriting somebody's
 * history over.
 */
