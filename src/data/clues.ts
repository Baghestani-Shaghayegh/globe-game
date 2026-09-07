/**
 * Clues for the "Famous for" round: a hint about a country, and the player
 * finds it on the globe. Each country carries several, so a second clue can be
 * bought when the first one isn't enough.
 *
 * Every sovereign country on the map has clues. Territories do not — they are
 * only in Full map, and a round there simply skips them.
 */
export const CLUES: Record<string, string[]> = {
  Afghanistan: [
    "The Khyber Pass leads into it",
    "Landlocked at the crossroads of Asia",
    "Kabul is its capital",
  ],
  Albania: [
    "Home of thousands of Cold War bunkers",
    "Mother Teresa's family came from here",
    "Tirana is its capital",
  ],
  Algeria: [
    "The largest country in Africa",
    "Mostly covered by the Sahara",
    "Algiers is its capital",
  ],
  Angola: [
    "A former Portuguese colony rich in oil",
    "Luanda is its capital",
    "The Kalandula Falls drop here",
  ],
  Argentina: [
    "Home of tango and the pampas",
    "Patagonia stretches across its south",
    "Buenos Aires is its capital",
  ],
  Armenia: [
    "Mount Ararat looms over its capital",
    "The first country to adopt Christianity",
    "Yerevan is its capital",
  ],
  Australia: [
    "Home of the kangaroo and koala",
    "The Great Barrier Reef lies off its coast",
    "Uluru rises from its red centre",
  ],
  Austria: [
    "Mozart was born here",
    "Home of the Vienna Philharmonic",
    "The Sound of Music was set in Salzburg",
  ],
  Azerbaijan: [
    "The Land of Fire, on the Caspian Sea",
    "Baku's Flame Towers",
    "Oil has been drawn here for centuries",
  ],
  Bangladesh: [
    "The Sundarbans mangroves lie here",
    "One of the most densely populated countries",
    "Dhaka is its capital",
  ],
  Belarus: [
    "Landlocked between Poland and Russia",
    "Minsk is its capital",
    "Home of the Białowieża forest's bison",
  ],
  Belgium: [
    "Famous for waffles, chocolate and beer",
    "Brussels is its capital",
    "The Battle of Waterloo was fought here",
  ],
  Belize: [
    "The Great Blue Hole lies off its coast",
    "The only English-speaking country in Central America",
    "Belmopan is its capital",
  ],
  Benin: [
    "The Kingdom of Dahomey and its women warriors ruled here",
    "Voodoo was born on this stretch of the Gulf of Guinea",
    "Porto-Novo is its capital",
  ],
  Bhutan: [
    "Measures Gross National Happiness",
    "The Tiger's Nest monastery clings to its cliff",
    "A Himalayan kingdom of dragons",
  ],
  Bolivia: [
    "The Uyuni salt flat mirrors the sky here",
    "Landlocked, with two capitals",
    "Lake Titicaca lies on its border",
  ],
  "Bosnia and Herzegovina": [
    "The Old Bridge at Mostar spans its river",
    "Sarajevo hosted the 1984 Winter Olympics",
    "Balkan country of three peoples",
  ],
  Botswana: [
    "The Okavango Delta spreads across it",
    "The Kalahari covers much of it",
    "Famous for diamonds and elephants",
  ],
  Brazil: [
    "Christ the Redeemer overlooks Rio",
    "The Amazon rainforest covers much of it",
    "Five-time football world champions",
  ],
  Brunei: [
    "A tiny, oil-rich sultanate on Borneo",
    "Ruled by one of the world's last absolute monarchs",
    "Bandar Seri Begawan is its capital",
  ],
  Bulgaria: [
    "Famous for rose oil and yoghurt",
    "The Black Sea forms its eastern coast",
    "Sofia is its capital",
  ],
  "Burkina Faso": [
    "Its name means 'land of upright people'",
    "Thomas Sankara led its revolution in the 1980s",
    "Ouagadougou is its capital",
  ],
  Burundi: [
    "A tiny landlocked country on Lake Tanganyika",
    "Drummers of Gitega are its cultural emblem",
    "Shares its ethnic history with Rwanda",
  ],
  Cambodia: [
    "Angkor Wat rises from its jungle",
    "Phnom Penh is its capital",
    "Its flag shows a temple",
  ],
  Cameroon: [
    "Called Africa in miniature",
    "Its football team are the Indomitable Lions",
    "Yaoundé is its capital",
  ],
  Canada: [
    "The maple leaf is on its flag",
    "The second largest country on Earth",
    "Niagara Falls lies on its border",
  ],
  "Central African Republic": [
    "Landlocked at the very middle of the continent",
    "Bangui sits on the Ubangi River here",
    "Dzanga-Sangha's forest elephants gather in its clearings",
  ],
  Chad: [
    "A vast lake on its border has shrunk to a fraction of its size",
    "The Sahara covers its north, savannah its south",
    "N'Djamena is its capital",
  ],
  Chile: [
    "A long ribbon between the Andes and the Pacific",
    "The Atacama is the driest desert on Earth",
    "Easter Island belongs to it",
  ],
  China: [
    "The Great Wall runs across it",
    "Home of the giant panda",
    "The Forbidden City stands in its capital",
  ],
  Colombia: [
    "Famous for coffee and emeralds",
    "Gabriel García Márquez's homeland",
    "Bogotá is its capital",
  ],
  "Costa Rica": [
    "Abolished its army in 1948",
    "Famous for cloud forests and sloths",
    "San José is its capital",
  ],
  Croatia: [
    "Dubrovnik's walls stand on its coast",
    "The Dalmatian coast and Plitvice Lakes",
    "Shaped like a crescent along the Adriatic",
  ],
  Cuba: [
    "Famous for cigars and classic cars",
    "The largest island in the Caribbean",
    "Havana is its capital",
  ],
  Cyprus: [
    "Mediterranean island divided since 1974",
    "Aphrodite was said to be born on its shores",
    "Nicosia is its capital",
  ],
  "Czech Republic": [
    "Prague's astronomical clock is its landmark",
    "Pilsner beer was born here",
    "Bohemia and Moravia make up the country",
  ],
  "Democratic Republic of the Congo": [
    "The Congo rainforest covers much of it",
    "Africa's second largest country",
    "Kinshasa is its capital",
  ],
  Denmark: [
    "The Little Mermaid sits in its harbour",
    "Home of LEGO",
    "Hans Christian Andersen's country",
  ],
  Djibouti: [
    "Lake Assal is the lowest point in Africa",
    "Guards the strait at the mouth of the Red Sea",
    "Hosts foreign naval bases at the Horn of Africa",
  ],
  "Dominican Republic": [
    "Shares Hispaniola with Haiti",
    "Merengue and bachata were born here",
    "Santo Domingo is its capital",
  ],
  "East Timor": [
    "Gained independence in 2002 after Indonesian occupation",
    "Shares an island with Indonesia's West Timor",
    "Dili is its capital",
  ],
  Ecuador: [
    "The Galápagos Islands belong to it",
    "The equator gives it its name",
    "Quito is its capital",
  ],
  Egypt: [
    "The pyramids of Giza stand here",
    "The Nile runs its length",
    "The Sphinx and the Valley of the Kings",
  ],
  "El Salvador": [
    "The smallest country in Central America",
    "The first to make bitcoin legal tender",
    "San Salvador is its capital",
  ],
  England: [
    "Home of Big Ben and the Tower of London",
    "The Beatles came from Liverpool here",
    "Stonehenge stands on its plains",
  ],
  "Equatorial Guinea": [
    "The only African country with Spanish as an official language",
    "Its capital sits on an island, not the mainland",
    "Oil transformed it from one of the continent's poorest",
  ],
  Eritrea: [
    "Broke away from Ethiopia in 1993",
    "Asmara's art deco architecture is a World Heritage site",
    "Its independence left its neighbour landlocked",
  ],
  Estonia: [
    "Tallinn's medieval old town",
    "The most northerly of the Baltic states",
    "Skype was built here",
  ],
  Ethiopia: [
    "Never colonised by a European power",
    "Coffee is said to have originated here",
    "The rock churches of Lalibela",
  ],
  Fiji: [
    "Over three hundred Pacific islands",
    "Famous for its rugby sevens team",
    "Suva is its capital",
  ],
  Finland: [
    "Home of the sauna",
    "Land of a thousand lakes",
    "Lapland and the northern lights",
  ],
  France: [
    "Home of the Eiffel Tower",
    "Its capital is on the Seine",
    "Champagne, and the world's most famous cycling race",
  ],
  Gabon: [
    "Rainforest covers nearly nine tenths of it",
    "Libreville is its capital",
    "Surfing hippos have been filmed on its Atlantic beaches",
  ],
  Gambia: [
    "A thin country following a river, enclosed by Senegal",
    "The smallest country on mainland Africa",
    "Banjul is its capital",
  ],
  Georgia: [
    "Considered a birthplace of wine",
    "The Caucasus Mountains run along its north",
    "Tbilisi is its capital",
  ],
  Germany: [
    "Home of Oktoberfest",
    "The Brandenburg Gate stands in its capital",
    "The Autobahn and the Black Forest",
  ],
  Ghana: [
    "The first sub-Saharan country to gain independence",
    "Famous for cocoa and kente cloth",
    "Accra is its capital",
  ],
  Greece: [
    "Home of the Parthenon",
    "Birthplace of the Olympic Games",
    "Santorini's white houses and blue domes",
  ],
  Greenland: [
    "The world's largest island",
    "Mostly covered by an ice sheet",
    "Governed from Denmark",
  ],
  Guatemala: [
    "Tikal's Mayan temples rise from its jungle",
    "Lake Atitlán sits among volcanoes",
    "The heart of the Mayan world",
  ],
  Guinea: [
    "Holds much of the world's bauxite",
    "Mount Nimba rises on its south-eastern border",
    "Conakry is its capital",
  ],
  "Guinea Bissau": [
    "The Bijagós archipelago lies off its coast",
    "A former Portuguese colony in West Africa",
    "Bissau is its capital",
  ],
  Guyana: [
    "The only South American country where English is official",
    "Kaieteur Falls drops in its interior",
    "Georgetown is its capital",
  ],
  Haiti: [
    "Shares an island with the Dominican Republic",
    "The first black republic",
    "Port-au-Prince is its capital",
  ],
  Honduras: [
    "The Mayan ruins of Copán stand here",
    "Once called a banana republic",
    "Tegucigalpa is its capital",
  ],
  Hungary: [
    "Its capital straddles the Danube in two halves",
    "Famous for goulash and thermal baths",
    "Home of the Rubik's Cube",
  ],
  Iceland: [
    "Land of fire and ice",
    "Geysers, volcanoes and the Blue Lagoon",
    "Reykjavík is the world's northernmost capital",
  ],
  India: [
    "The Taj Mahal stands here",
    "Home of Bollywood",
    "The Ganges runs through it",
  ],
  Indonesia: [
    "The world's largest archipelago",
    "Bali is one of its islands",
    "Home to Komodo dragons",
  ],
  Iran: [
    "Persepolis lies in ruins here",
    "Formerly called Persia",
    "Famous for its carpets and pistachios",
  ],
  Iraq: [
    "Mesopotamia lay between its two rivers",
    "Babylon stood here",
    "Baghdad is its capital",
  ],
  Ireland: [
    "The Emerald Isle",
    "Home of Guinness and St Patrick's Day",
    "The Cliffs of Moher line its west coast",
  ],
  Israel: [
    "Jerusalem is its seat of government",
    "The Dead Sea lies on its border",
    "The Western Wall stands here",
  ],
  Italy: [
    "Home of the Colosseum",
    "Shaped like a boot",
    "Pizza, pasta and the leaning tower of Pisa",
  ],
  "Ivory Coast": [
    "The world's largest cocoa producer",
    "Yamoussoukro's vast basilica",
    "Abidjan is its largest city",
  ],
  Jamaica: [
    "Bob Marley's homeland",
    "Reggae was born here",
    "Kingston is its capital",
  ],
  Japan: [
    "Home of Mount Fuji",
    "Famous for sushi and cherry blossom",
    "Bullet trains and Tokyo",
  ],
  Jordan: [
    "Petra is carved into its rock",
    "Wadi Rum's red desert",
    "Amman is its capital",
  ],
  Kazakhstan: [
    "The world's largest landlocked country",
    "Rockets launch from Baikonur here",
    "The Aral Sea shrank on its border",
  ],
  Kenya: [
    "The Maasai Mara's great migration",
    "Famous for its long-distance runners",
    "Nairobi is its capital",
  ],
  Kuwait: [
    "Invaded by its northern neighbour in 1990",
    "A small Gulf state at the head of the Persian Gulf",
    "Its oil wells were set alight in 1991",
  ],
  Kyrgyzstan: [
    "Lake Issyk-Kul never freezes despite the mountains around it",
    "The Tian Shan range covers most of it",
    "Bishkek is its capital",
  ],
  Laos: [
    "The only landlocked country in Southeast Asia",
    "The Mekong runs along its border",
    "Luang Prabang's morning alms procession",
  ],
  Latvia: [
    "Riga's art nouveau architecture",
    "The middle Baltic state",
    "Famous for its song festivals",
  ],
  Lebanon: [
    "Its flag bears a cedar tree",
    "Beirut is its capital",
    "The ruins of Baalbek stand here",
  ],
  Lesotho: [
    "Entirely surrounded by one other country",
    "The only country lying wholly above 1,000 metres",
    "Maseru is its capital",
  ],
  Liberia: [
    "Founded by freed American slaves in the 1800s",
    "Africa's oldest republic",
    "Monrovia is named after an American president",
  ],
  Libya: [
    "The ruins of Leptis Magna stand on its coast",
    "Mostly Sahara, with a Mediterranean shore",
    "Tripoli is its capital",
  ],
  Lithuania: [
    "The Hill of Crosses stands here",
    "The southernmost Baltic state",
    "Vilnius is its capital",
  ],
  Luxembourg: [
    "A grand duchy between France, Germany and Belgium",
    "One of Europe's smallest and richest countries",
    "Its capital shares its name",
  ],
  Macedonia: [
    "Alexander the Great's homeland claims its name",
    "Lake Ohrid lies on its border",
    "Skopje is its capital",
  ],
  Madagascar: [
    "Home of lemurs and baobabs",
    "The world's fourth largest island",
    "Antananarivo is its capital",
  ],
  Malawi: [
    "A great lake full of colourful cichlids runs down its length",
    "Called the warm heart of Africa",
    "Lilongwe is its capital",
  ],
  Malaysia: [
    "The Petronas Towers rise in its capital",
    "Split between a peninsula and Borneo",
    "Famous for rainforests and orangutans",
  ],
  Mali: [
    "Timbuktu stands on the edge of its desert",
    "The Niger River bends through it",
    "Famous for its mud-brick mosques",
  ],
  Mauritania: [
    "The Richat Structure stares out of its desert like an eye",
    "Iron ore trains here are among the longest in the world",
    "Nouakchott is its capital",
  ],
  Mexico: [
    "Home of tacos and mariachi",
    "Chichén Itzá and the Day of the Dead",
    "The Yucatán Peninsula juts from it",
  ],
  Moldova: [
    "Famous for its vast wine cellars",
    "Landlocked between Romania and Ukraine",
    "Chișinău is its capital",
  ],
  Mongolia: [
    "Genghis Khan's homeland",
    "The Gobi Desert covers its south",
    "Famous for nomads and yurts",
  ],
  Montenegro: [
    "The Bay of Kotor cuts into its coast",
    "Its name means 'black mountain'",
    "Adriatic country of under a million people",
  ],
  Morocco: [
    "Marrakesh's souks and the Sahara's edge",
    "The Atlas Mountains cross it",
    "Casablanca is its largest city",
  ],
  Mozambique: [
    "A long Indian Ocean coastline",
    "Its flag carries a rifle",
    "Maputo is its capital",
  ],
  Myanmar: [
    "Thousands of temples stand at Bagan",
    "The Shwedagon Pagoda gleams in Yangon",
    "Formerly called Burma",
  ],
  Namibia: [
    "The Namib Desert meets the sea here",
    "The Skeleton Coast",
    "Sossusvlei's red dunes",
  ],
  Nepal: [
    "Mount Everest stands on its border",
    "Kathmandu is its capital",
    "The only country with a non-rectangular flag",
  ],
  Netherlands: [
    "Famous for tulips and windmills",
    "Its capital is threaded with canals",
    "Much of it lies below sea level",
  ],
  "New Zealand": [
    "The Lord of the Rings was filmed here",
    "Home of the kiwi bird and the haka",
    "Two main islands in the South Pacific",
  ],
  Nicaragua: [
    "The largest country in Central America",
    "Its great lake holds volcanic islands",
    "Managua is its capital",
  ],
  Niger: [
    "Named after the river that crosses its south-west",
    "Agadez is the desert gateway to its Saharan north",
    "Uranium mining drives its economy",
  ],
  Nigeria: [
    "Africa's most populous country",
    "Nollywood makes its films",
    "Lagos is its largest city",
  ],
  "North Korea": [
    "The most closed country on Earth",
    "Pyongyang is its capital",
    "Divided from its southern neighbour at the 38th parallel",
  ],
  Norway: [
    "Land of the fjords",
    "The midnight sun shines on its far north",
    "The Nobel Peace Prize is awarded in Oslo",
  ],
  Oman: [
    "Occupies the tip of the Arabian Peninsula",
    "Muscat is its capital",
    "Famous for frankincense",
  ],
  Pakistan: [
    "K2 stands on its northern border",
    "The Indus Valley civilisation began here",
    "Islamabad is its capital",
  ],
  Panama: [
    "A canal cuts it in two",
    "Joins North and South America",
    "Its hat is actually from Ecuador",
  ],
  "Papua New Guinea": [
    "Over eight hundred languages are spoken here",
    "Shares an island with Indonesia",
    "Port Moresby is its capital",
  ],
  Paraguay: [
    "Landlocked in the heart of South America",
    "Guaraní is an official language here",
    "Asunción is its capital",
  ],
  Peru: [
    "Machu Picchu sits in its mountains",
    "The Nazca Lines are drawn in its desert",
    "Heart of the Inca empire",
  ],
  Philippines: [
    "An archipelago of over seven thousand islands",
    "Manila is its capital",
    "Famous for the Chocolate Hills and jeepneys",
  ],
  Poland: [
    "Chopin was born here",
    "Home of pierogi",
    "Kraków and the Wieliczka salt mine",
  ],
  Portugal: [
    "Port wine takes its name from this country's second city",
    "Westernmost country on mainland Europe",
    "Fado music and pastéis de nata",
  ],
  Qatar: [
    "Hosted the 2022 World Cup",
    "Doha is its capital",
    "A small peninsula rich in natural gas",
  ],
  "Republic of Serbia": [
    "Belgrade sits where the Sava meets the Danube",
    "Nikola Tesla was born to a family from here",
    "Landlocked in the Balkans",
  ],
  "Republic of the Congo": [
    "Brazzaville faces Kinshasa across the river",
    "The smaller of the two countries sharing a river's name",
    "Odzala's forests shelter lowland gorillas",
  ],
  Romania: [
    "Transylvania and the Dracula legend",
    "The Carpathian Mountains curve through it",
    "Bucharest is its capital",
  ],
  Russia: [
    "Home of the Kremlin and Red Square",
    "The largest country on Earth",
    "The Trans-Siberian Railway crosses it",
  ],
  Rwanda: [
    "The land of a thousand hills",
    "Mountain gorillas live in its volcanoes",
    "Kigali is its capital",
  ],
  "Saudi Arabia": [
    "Mecca lies within it",
    "The world's largest sand desert crosses it",
    "Built its wealth on oil",
  ],
  Senegal: [
    "The westernmost country in mainland Africa",
    "Gorée Island lies off its capital",
    "Dakar is its capital",
  ],
  "Sierra Leone": [
    "Freetown was founded as a home for freed slaves",
    "Its diamonds funded a brutal civil war",
    "Its name means 'lion mountains'",
  ],
  Slovakia: [
    "The High Tatras rise along its north",
    "Bratislava sits on the Danube",
    "Split peacefully from its neighbour in 1993",
  ],
  Slovenia: [
    "Lake Bled and its island church",
    "The Julian Alps meet the Adriatic here",
    "Ljubljana is its capital",
  ],
  "Solomon Islands": [
    "Guadalcanal saw fierce fighting in 1942",
    "A Melanesian chain east of Papua New Guinea",
    "Honiara is its capital",
  ],
  Somalia: [
    "The Horn of Africa",
    "The longest coastline in mainland Africa",
    "Mogadishu is its capital",
  ],
  "South Africa": [
    "Table Mountain overlooks Cape Town",
    "Nelson Mandela led it out of apartheid",
    "It has three capital cities",
  ],
  "South Korea": [
    "Home of K-pop and kimchi",
    "Seoul is its capital",
    "Samsung and Hyundai come from here",
  ],
  "South Sudan": [
    "The world's newest country, independent in 2011",
    "The Sudd is one of the largest wetlands on Earth",
    "Juba is its capital",
  ],
  Spain: [
    "Home of flamenco and paella",
    "The Sagrada Família is still unfinished here",
    "Running of the bulls in Pamplona",
  ],
  "Sri Lanka": [
    "A teardrop island off India's coast",
    "Famous for Ceylon tea",
    "Colombo is its largest city",
  ],
  Sudan: [
    "More pyramids stand here than in Egypt",
    "The Blue and White Nile meet at Khartoum",
    "Split in two in 2011",
  ],
  Suriname: [
    "The smallest country in South America",
    "A former Dutch colony",
    "Paramaribo is its capital",
  ],
  Swaziland: [
    "A small kingdom between South Africa and Mozambique",
    "Renamed itself in 2018 to stop being confused with Switzerland",
    "One of the world's last absolute monarchies",
  ],
  Sweden: [
    "Home of ABBA and IKEA",
    "The Nobel Prizes are awarded in Stockholm",
    "Famous for meatballs and midsummer",
  ],
  Switzerland: [
    "Famous for watches, chocolate and banks",
    "The Matterhorn rises on its border",
    "Neutral through both world wars",
  ],
  Syria: [
    "Damascus is one of the world's oldest cities",
    "The ancient city of Palmyra lies in its desert",
    "Aleppo's covered souk",
  ],
  Taiwan: [
    "Taipei 101 rises above its capital",
    "An island off China's south-east coast",
    "Makes most of the world's advanced chips",
  ],
  Tajikistan: [
    "The Pamir Mountains cover most of it",
    "Ismoil Somoni Peak was once the Soviet Union's highest",
    "Dushanbe is its capital",
  ],
  Thailand: [
    "Land of smiles and golden temples",
    "Bangkok is its capital",
    "Famous for pad thai and tuk-tuks",
  ],
  "The Bahamas": [
    "An archipelago off Florida",
    "Famous for swimming pigs",
    "Nassau is its capital",
  ],
  Togo: [
    "A narrow strip running north from the Gulf of Guinea",
    "Lomé is its capital, right on the border",
    "Koutammakou's mud tower-houses are a World Heritage site",
  ],
  "Trinidad and Tobago": [
    "Steelpan music was born here",
    "Two islands off Venezuela's coast",
    "Famous for its carnival",
  ],
  Tunisia: [
    "Ancient Carthage stood here",
    "The Arab Spring began here",
    "Star Wars desert scenes were filmed in its south",
  ],
  Turkey: [
    "Istanbul spans two continents here",
    "Home of the Hagia Sophia",
    "Cappadocia's fairy chimneys and hot-air balloons",
  ],
  Turkmenistan: [
    "The Darvaza gas crater has burned for decades",
    "The Karakum Desert covers most of it",
    "Ashgabat is built almost entirely of white marble",
  ],
  USA: [
    "The Statue of Liberty stands in its harbour",
    "The Grand Canyon and Yellowstone",
    "Fifty states and Hollywood",
  ],
  Uganda: [
    "The source of the Nile lies at its lake",
    "Mountain gorillas live in its forests",
    "Kampala is its capital",
  ],
  Ukraine: [
    "Chernobyl lies within its borders",
    "Famous for its black-earth wheat fields",
    "Kyiv is its capital",
  ],
  "United Arab Emirates": [
    "The Burj Khalifa rises here",
    "A federation of seven emirates",
    "Dubai and Abu Dhabi",
  ],
  "United Republic of Tanzania": [
    "Mount Kilimanjaro rises here",
    "The Serengeti stretches across it",
    "Zanzibar lies off its coast",
  ],
  Uruguay: [
    "Won the first football World Cup",
    "Between Argentina and Brazil",
    "Montevideo is its capital",
  ],
  Uzbekistan: [
    "Samarkand stands on the Silk Road here",
    "One of only two doubly landlocked countries",
    "Tashkent is its capital",
  ],
  Vanuatu: [
    "A Pacific chain with active volcanoes",
    "Bungee jumping began with its land divers",
    "Port Vila is its capital",
  ],
  Venezuela: [
    "Angel Falls drops from its tepui",
    "Holds the world's largest oil reserves",
    "Caracas is its capital",
  ],
  Vietnam: [
    "Halong Bay's limestone islands",
    "Famous for pho and conical hats",
    "Hanoi and Ho Chi Minh City",
  ],
  "West Bank": [
    "Bethlehem and Jericho lie within it",
    "Ramallah is its administrative centre",
    "Occupied territory west of the river Jordan",
  ],
  Yemen: [
    "Socotra's dragon blood trees grow here",
    "The southern tip of the Arabian Peninsula",
    "Sana'a's tower houses",
  ],
  Zambia: [
    "Shares Victoria Falls with its neighbour",
    "The Zambezi runs along its border",
    "Lusaka is its capital",
  ],
  Zimbabwe: [
    "Victoria Falls thunders on its border",
    "Ancient stone ruins gave the country its name",
    "Harare is its capital",
  ],
};

/** The clues for a country, or an empty list when it has none. */
export function cluesFor(geoName: string): string[] {
  return CLUES[geoName] ?? [];
}
