/**
 * Current spendable ISO 4217 currencies from SIX List One, published 2026-09-17.
 * Fund, metal, testing, no-currency, and special-purpose units are excluded.
 * This checked-in catalog keeps onboarding and capture validation available offline.
 */
export type CurrencyDefinition = {
  readonly code: string;
  readonly name: string;
  readonly minorDigits: number;
  readonly entities: readonly string[];
};

export const CURRENCY_CATALOG = [
  {
    code: "AFN",
    name: "Afghani",
    minorDigits: 2,
    entities: ["AFGHANISTAN"],
  },
  {
    code: "DZD",
    name: "Algerian Dinar",
    minorDigits: 2,
    entities: ["ALGERIA"],
  },
  {
    code: "ARS",
    name: "Argentine Peso",
    minorDigits: 2,
    entities: ["ARGENTINA"],
  },
  {
    code: "AMD",
    name: "Armenian Dram",
    minorDigits: 2,
    entities: ["ARMENIA"],
  },
  {
    code: "AWG",
    name: "Aruban Florin",
    minorDigits: 2,
    entities: ["ARUBA"],
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    minorDigits: 2,
    entities: ["AUSTRALIA","CHRISTMAS ISLAND","COCOS (KEELING) ISLANDS (THE)","HEARD ISLAND AND McDONALD ISLANDS","KIRIBATI","NAURU","NORFOLK ISLAND","TUVALU"],
  },
  {
    code: "AZN",
    name: "Azerbaijan Manat",
    minorDigits: 2,
    entities: ["AZERBAIJAN"],
  },
  {
    code: "BSD",
    name: "Bahamian Dollar",
    minorDigits: 2,
    entities: ["BAHAMAS (THE)"],
  },
  {
    code: "BHD",
    name: "Bahraini Dinar",
    minorDigits: 3,
    entities: ["BAHRAIN"],
  },
  {
    code: "THB",
    name: "Baht",
    minorDigits: 2,
    entities: ["THAILAND"],
  },
  {
    code: "PAB",
    name: "Balboa",
    minorDigits: 2,
    entities: ["PANAMA"],
  },
  {
    code: "BBD",
    name: "Barbados Dollar",
    minorDigits: 2,
    entities: ["BARBADOS"],
  },
  {
    code: "BYN",
    name: "Belarusian Ruble",
    minorDigits: 2,
    entities: ["BELARUS"],
  },
  {
    code: "BZD",
    name: "Belize Dollar",
    minorDigits: 2,
    entities: ["BELIZE"],
  },
  {
    code: "BMD",
    name: "Bermudian Dollar",
    minorDigits: 2,
    entities: ["BERMUDA"],
  },
  {
    code: "VED",
    name: "Bolívar Soberano",
    minorDigits: 2,
    entities: ["VENEZUELA (BOLIVARIAN REPUBLIC OF)"],
  },
  {
    code: "VES",
    name: "Bolívar Soberano",
    minorDigits: 2,
    entities: ["VENEZUELA (BOLIVARIAN REPUBLIC OF)"],
  },
  {
    code: "BOB",
    name: "Boliviano",
    minorDigits: 2,
    entities: ["BOLIVIA (PLURINATIONAL STATE OF)"],
  },
  {
    code: "BRL",
    name: "Brazilian Real",
    minorDigits: 2,
    entities: ["BRAZIL"],
  },
  {
    code: "BND",
    name: "Brunei Dollar",
    minorDigits: 2,
    entities: ["BRUNEI DARUSSALAM"],
  },
  {
    code: "BIF",
    name: "Burundi Franc",
    minorDigits: 0,
    entities: ["BURUNDI"],
  },
  {
    code: "CVE",
    name: "Cabo Verde Escudo",
    minorDigits: 2,
    entities: ["CABO VERDE"],
  },
  {
    code: "CAD",
    name: "Canadian Dollar",
    minorDigits: 2,
    entities: ["CANADA"],
  },
  {
    code: "XCG",
    name: "Caribbean Guilder",
    minorDigits: 2,
    entities: ["CURAÇAO","SINT MAARTEN (DUTCH PART)"],
  },
  {
    code: "KYD",
    name: "Cayman Islands Dollar",
    minorDigits: 2,
    entities: ["CAYMAN ISLANDS (THE)"],
  },
  {
    code: "XOF",
    name: "CFA Franc BCEAO",
    minorDigits: 0,
    entities: ["BENIN","BURKINA FASO","CÔTE D'IVOIRE","GUINEA-BISSAU","MALI","NIGER (THE)","SENEGAL","TOGO"],
  },
  {
    code: "XAF",
    name: "CFA Franc BEAC",
    minorDigits: 0,
    entities: ["CAMEROON","CENTRAL AFRICAN REPUBLIC (THE)","CHAD","CONGO (THE)","EQUATORIAL GUINEA","GABON"],
  },
  {
    code: "XPF",
    name: "CFP Franc",
    minorDigits: 0,
    entities: ["FRENCH POLYNESIA","NEW CALEDONIA","WALLIS AND FUTUNA"],
  },
  {
    code: "CLP",
    name: "Chilean Peso",
    minorDigits: 0,
    entities: ["CHILE"],
  },
  {
    code: "COP",
    name: "Colombian Peso",
    minorDigits: 2,
    entities: ["COLOMBIA"],
  },
  {
    code: "KMF",
    name: "Comorian Franc",
    minorDigits: 0,
    entities: ["COMOROS (THE)"],
  },
  {
    code: "CDF",
    name: "Congolese Franc",
    minorDigits: 2,
    entities: ["CONGO (THE DEMOCRATIC REPUBLIC OF THE)"],
  },
  {
    code: "BAM",
    name: "Convertible Mark",
    minorDigits: 2,
    entities: ["BOSNIA AND HERZEGOVINA"],
  },
  {
    code: "NIO",
    name: "Cordoba Oro",
    minorDigits: 2,
    entities: ["NICARAGUA"],
  },
  {
    code: "CRC",
    name: "Costa Rican Colon",
    minorDigits: 2,
    entities: ["COSTA RICA"],
  },
  {
    code: "CUP",
    name: "Cuban Peso",
    minorDigits: 2,
    entities: ["CUBA"],
  },
  {
    code: "CZK",
    name: "Czech Koruna",
    minorDigits: 2,
    entities: ["CZECHIA"],
  },
  {
    code: "GMD",
    name: "Dalasi",
    minorDigits: 2,
    entities: ["GAMBIA (THE)"],
  },
  {
    code: "DKK",
    name: "Danish Krone",
    minorDigits: 2,
    entities: ["DENMARK","FAROE ISLANDS (THE)","GREENLAND"],
  },
  {
    code: "MKD",
    name: "Denar",
    minorDigits: 2,
    entities: ["NORTH MACEDONIA"],
  },
  {
    code: "DJF",
    name: "Djibouti Franc",
    minorDigits: 0,
    entities: ["DJIBOUTI"],
  },
  {
    code: "STN",
    name: "Dobra",
    minorDigits: 2,
    entities: ["SAO TOME AND PRINCIPE"],
  },
  {
    code: "DOP",
    name: "Dominican Peso",
    minorDigits: 2,
    entities: ["DOMINICAN REPUBLIC (THE)"],
  },
  {
    code: "VND",
    name: "Dong",
    minorDigits: 0,
    entities: ["VIET NAM"],
  },
  {
    code: "XCD",
    name: "East Caribbean Dollar",
    minorDigits: 2,
    entities: ["ANGUILLA","ANTIGUA AND BARBUDA","DOMINICA","GRENADA","MONTSERRAT","SAINT KITTS AND NEVIS","SAINT LUCIA","SAINT VINCENT AND THE GRENADINES"],
  },
  {
    code: "EGP",
    name: "Egyptian Pound",
    minorDigits: 2,
    entities: ["EGYPT"],
  },
  {
    code: "SVC",
    name: "El Salvador Colon",
    minorDigits: 2,
    entities: ["EL SALVADOR"],
  },
  {
    code: "ETB",
    name: "Ethiopian Birr",
    minorDigits: 2,
    entities: ["ETHIOPIA"],
  },
  {
    code: "EUR",
    name: "Euro",
    minorDigits: 2,
    entities: ["ÅLAND ISLANDS","ANDORRA","AUSTRIA","BELGIUM","BULGARIA","CROATIA","CYPRUS","ESTONIA","EUROPEAN UNION","FINLAND","FRANCE","FRENCH GUIANA","FRENCH SOUTHERN TERRITORIES (THE)","GERMANY","GREECE","GUADELOUPE","HOLY SEE (THE)","IRELAND","ITALY","LATVIA","LITHUANIA","LUXEMBOURG","MALTA","MARTINIQUE","MAYOTTE","MONACO","MONTENEGRO","NETHERLANDS (THE)","PORTUGAL","RÉUNION","SAINT BARTHÉLEMY","SAINT MARTIN (FRENCH PART)","SAINT PIERRE AND MIQUELON","SAN MARINO","SLOVAKIA","SLOVENIA","SPAIN"],
  },
  {
    code: "FKP",
    name: "Falkland Islands Pound",
    minorDigits: 2,
    entities: ["FALKLAND ISLANDS (THE) [MALVINAS]"],
  },
  {
    code: "FJD",
    name: "Fiji Dollar",
    minorDigits: 2,
    entities: ["FIJI"],
  },
  {
    code: "HUF",
    name: "Forint",
    minorDigits: 2,
    entities: ["HUNGARY"],
  },
  {
    code: "GHS",
    name: "Ghana Cedi",
    minorDigits: 2,
    entities: ["GHANA"],
  },
  {
    code: "GIP",
    name: "Gibraltar Pound",
    minorDigits: 2,
    entities: ["GIBRALTAR"],
  },
  {
    code: "HTG",
    name: "Gourde",
    minorDigits: 2,
    entities: ["HAITI"],
  },
  {
    code: "PYG",
    name: "Guarani",
    minorDigits: 0,
    entities: ["PARAGUAY"],
  },
  {
    code: "GNF",
    name: "Guinean Franc",
    minorDigits: 0,
    entities: ["GUINEA"],
  },
  {
    code: "GYD",
    name: "Guyana Dollar",
    minorDigits: 2,
    entities: ["GUYANA"],
  },
  {
    code: "HKD",
    name: "Hong Kong Dollar",
    minorDigits: 2,
    entities: ["HONG KONG"],
  },
  {
    code: "UAH",
    name: "Hryvnia",
    minorDigits: 2,
    entities: ["UKRAINE"],
  },
  {
    code: "ISK",
    name: "Iceland Krona",
    minorDigits: 0,
    entities: ["ICELAND"],
  },
  {
    code: "INR",
    name: "Indian Rupee",
    minorDigits: 2,
    entities: ["BHUTAN","INDIA"],
  },
  {
    code: "IRR",
    name: "Iranian Rial",
    minorDigits: 2,
    entities: ["IRAN (ISLAMIC REPUBLIC OF)"],
  },
  {
    code: "IQD",
    name: "Iraqi Dinar",
    minorDigits: 3,
    entities: ["IRAQ"],
  },
  {
    code: "JMD",
    name: "Jamaican Dollar",
    minorDigits: 2,
    entities: ["JAMAICA"],
  },
  {
    code: "JOD",
    name: "Jordanian Dinar",
    minorDigits: 3,
    entities: ["JORDAN"],
  },
  {
    code: "KES",
    name: "Kenyan Shilling",
    minorDigits: 2,
    entities: ["KENYA"],
  },
  {
    code: "PGK",
    name: "Kina",
    minorDigits: 2,
    entities: ["PAPUA NEW GUINEA"],
  },
  {
    code: "KWD",
    name: "Kuwaiti Dinar",
    minorDigits: 3,
    entities: ["KUWAIT"],
  },
  {
    code: "AOA",
    name: "Kwanza",
    minorDigits: 2,
    entities: ["ANGOLA"],
  },
  {
    code: "MMK",
    name: "Kyat",
    minorDigits: 2,
    entities: ["MYANMAR"],
  },
  {
    code: "LAK",
    name: "Lao Kip",
    minorDigits: 2,
    entities: ["LAO PEOPLE’S DEMOCRATIC REPUBLIC (THE)"],
  },
  {
    code: "GEL",
    name: "Lari",
    minorDigits: 2,
    entities: ["GEORGIA"],
  },
  {
    code: "LBP",
    name: "Lebanese Pound",
    minorDigits: 2,
    entities: ["LEBANON"],
  },
  {
    code: "ALL",
    name: "Lek",
    minorDigits: 2,
    entities: ["ALBANIA"],
  },
  {
    code: "HNL",
    name: "Lempira",
    minorDigits: 2,
    entities: ["HONDURAS"],
  },
  {
    code: "SLE",
    name: "Leone",
    minorDigits: 2,
    entities: ["SIERRA LEONE"],
  },
  {
    code: "LRD",
    name: "Liberian Dollar",
    minorDigits: 2,
    entities: ["LIBERIA"],
  },
  {
    code: "LYD",
    name: "Libyan Dinar",
    minorDigits: 3,
    entities: ["LIBYA"],
  },
  {
    code: "SZL",
    name: "Lilangeni",
    minorDigits: 2,
    entities: ["ESWATINI"],
  },
  {
    code: "LSL",
    name: "Loti",
    minorDigits: 2,
    entities: ["LESOTHO"],
  },
  {
    code: "MGA",
    name: "Malagasy Ariary",
    minorDigits: 2,
    entities: ["MADAGASCAR"],
  },
  {
    code: "MWK",
    name: "Malawi Kwacha",
    minorDigits: 2,
    entities: ["MALAWI"],
  },
  {
    code: "MYR",
    name: "Malaysian Ringgit",
    minorDigits: 2,
    entities: ["MALAYSIA"],
  },
  {
    code: "MUR",
    name: "Mauritius Rupee",
    minorDigits: 2,
    entities: ["MAURITIUS"],
  },
  {
    code: "MXN",
    name: "Mexican Peso",
    minorDigits: 2,
    entities: ["MEXICO"],
  },
  {
    code: "MDL",
    name: "Moldovan Leu",
    minorDigits: 2,
    entities: ["MOLDOVA (THE REPUBLIC OF)"],
  },
  {
    code: "MAD",
    name: "Moroccan Dirham",
    minorDigits: 2,
    entities: ["MOROCCO","WESTERN SAHARA"],
  },
  {
    code: "MZN",
    name: "Mozambique Metical",
    minorDigits: 2,
    entities: ["MOZAMBIQUE"],
  },
  {
    code: "NGN",
    name: "Naira",
    minorDigits: 2,
    entities: ["NIGERIA"],
  },
  {
    code: "ERN",
    name: "Nakfa",
    minorDigits: 2,
    entities: ["ERITREA"],
  },
  {
    code: "NAD",
    name: "Namibia Dollar",
    minorDigits: 2,
    entities: ["NAMIBIA"],
  },
  {
    code: "NPR",
    name: "Nepalese Rupee",
    minorDigits: 2,
    entities: ["NEPAL"],
  },
  {
    code: "ILS",
    name: "New Israeli Sheqel",
    minorDigits: 2,
    entities: ["ISRAEL"],
  },
  {
    code: "TWD",
    name: "New Taiwan Dollar",
    minorDigits: 2,
    entities: ["TAIWAN (PROVINCE OF CHINA)"],
  },
  {
    code: "NZD",
    name: "New Zealand Dollar",
    minorDigits: 2,
    entities: ["COOK ISLANDS (THE)","NEW ZEALAND","NIUE","PITCAIRN","TOKELAU"],
  },
  {
    code: "BTN",
    name: "Ngultrum",
    minorDigits: 2,
    entities: ["BHUTAN"],
  },
  {
    code: "KPW",
    name: "North Korean Won",
    minorDigits: 2,
    entities: ["KOREA (THE DEMOCRATIC PEOPLE’S REPUBLIC OF)"],
  },
  {
    code: "NOK",
    name: "Norwegian Krone",
    minorDigits: 2,
    entities: ["BOUVET ISLAND","NORWAY","SVALBARD AND JAN MAYEN"],
  },
  {
    code: "MRU",
    name: "Ouguiya",
    minorDigits: 2,
    entities: ["MAURITANIA"],
  },
  {
    code: "TOP",
    name: "Pa’anga",
    minorDigits: 2,
    entities: ["TONGA"],
  },
  {
    code: "PKR",
    name: "Pakistan Rupee",
    minorDigits: 2,
    entities: ["PAKISTAN"],
  },
  {
    code: "MOP",
    name: "Pataca",
    minorDigits: 2,
    entities: ["MACAO"],
  },
  {
    code: "UYU",
    name: "Peso Uruguayo",
    minorDigits: 2,
    entities: ["URUGUAY"],
  },
  {
    code: "PHP",
    name: "Philippine Peso",
    minorDigits: 2,
    entities: ["PHILIPPINES (THE)"],
  },
  {
    code: "GBP",
    name: "Pound Sterling",
    minorDigits: 2,
    entities: ["GUERNSEY","ISLE OF MAN","JERSEY","UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND (THE)"],
  },
  {
    code: "BWP",
    name: "Pula",
    minorDigits: 2,
    entities: ["BOTSWANA"],
  },
  {
    code: "QAR",
    name: "Qatari Rial",
    minorDigits: 2,
    entities: ["QATAR"],
  },
  {
    code: "GTQ",
    name: "Quetzal",
    minorDigits: 2,
    entities: ["GUATEMALA"],
  },
  {
    code: "ZAR",
    name: "Rand",
    minorDigits: 2,
    entities: ["LESOTHO","NAMIBIA","SOUTH AFRICA"],
  },
  {
    code: "OMR",
    name: "Rial Omani",
    minorDigits: 3,
    entities: ["OMAN"],
  },
  {
    code: "KHR",
    name: "Riel",
    minorDigits: 2,
    entities: ["CAMBODIA"],
  },
  {
    code: "RON",
    name: "Romanian Leu",
    minorDigits: 2,
    entities: ["ROMANIA"],
  },
  {
    code: "MVR",
    name: "Rufiyaa",
    minorDigits: 2,
    entities: ["MALDIVES"],
  },
  {
    code: "IDR",
    name: "Rupiah",
    minorDigits: 2,
    entities: ["INDONESIA"],
  },
  {
    code: "RUB",
    name: "Russian Ruble",
    minorDigits: 2,
    entities: ["RUSSIAN FEDERATION (THE)"],
  },
  {
    code: "RWF",
    name: "Rwanda Franc",
    minorDigits: 0,
    entities: ["RWANDA"],
  },
  {
    code: "SHP",
    name: "Saint Helena Pound",
    minorDigits: 2,
    entities: ["SAINT HELENA, ASCENSION AND TRISTAN DA CUNHA"],
  },
  {
    code: "SAR",
    name: "Saudi Riyal",
    minorDigits: 2,
    entities: ["SAUDI ARABIA"],
  },
  {
    code: "RSD",
    name: "Serbian Dinar",
    minorDigits: 2,
    entities: ["SERBIA"],
  },
  {
    code: "SCR",
    name: "Seychelles Rupee",
    minorDigits: 2,
    entities: ["SEYCHELLES"],
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    minorDigits: 2,
    entities: ["SINGAPORE"],
  },
  {
    code: "PEN",
    name: "Sol",
    minorDigits: 2,
    entities: ["PERU"],
  },
  {
    code: "SBD",
    name: "Solomon Islands Dollar",
    minorDigits: 2,
    entities: ["SOLOMON ISLANDS"],
  },
  {
    code: "KGS",
    name: "Som",
    minorDigits: 2,
    entities: ["KYRGYZSTAN"],
  },
  {
    code: "SOS",
    name: "Somali Shilling",
    minorDigits: 2,
    entities: ["SOMALIA"],
  },
  {
    code: "TJS",
    name: "Somoni",
    minorDigits: 2,
    entities: ["TAJIKISTAN"],
  },
  {
    code: "SSP",
    name: "South Sudanese Pound",
    minorDigits: 2,
    entities: ["SOUTH SUDAN"],
  },
  {
    code: "LKR",
    name: "Sri Lanka Rupee",
    minorDigits: 2,
    entities: ["SRI LANKA"],
  },
  {
    code: "SDG",
    name: "Sudanese Pound",
    minorDigits: 2,
    entities: ["SUDAN (THE)"],
  },
  {
    code: "SRD",
    name: "Surinam Dollar",
    minorDigits: 2,
    entities: ["SURINAME"],
  },
  {
    code: "SEK",
    name: "Swedish Krona",
    minorDigits: 2,
    entities: ["SWEDEN"],
  },
  {
    code: "CHF",
    name: "Swiss Franc",
    minorDigits: 2,
    entities: ["LIECHTENSTEIN","SWITZERLAND"],
  },
  {
    code: "SYP",
    name: "Syrian Pound",
    minorDigits: 2,
    entities: ["SYRIAN ARAB REPUBLIC"],
  },
  {
    code: "BDT",
    name: "Taka",
    minorDigits: 2,
    entities: ["BANGLADESH"],
  },
  {
    code: "WST",
    name: "Tala",
    minorDigits: 2,
    entities: ["SAMOA"],
  },
  {
    code: "TZS",
    name: "Tanzanian Shilling",
    minorDigits: 2,
    entities: ["TANZANIA, UNITED REPUBLIC OF"],
  },
  {
    code: "KZT",
    name: "Tenge",
    minorDigits: 2,
    entities: ["KAZAKHSTAN"],
  },
  {
    code: "TTD",
    name: "Trinidad and Tobago Dollar",
    minorDigits: 2,
    entities: ["TRINIDAD AND TOBAGO"],
  },
  {
    code: "MNT",
    name: "Tugrik",
    minorDigits: 2,
    entities: ["MONGOLIA"],
  },
  {
    code: "TND",
    name: "Tunisian Dinar",
    minorDigits: 3,
    entities: ["TUNISIA"],
  },
  {
    code: "TRY",
    name: "Turkish Lira",
    minorDigits: 2,
    entities: ["TÜRKİYE"],
  },
  {
    code: "TMT",
    name: "Turkmenistan New Manat",
    minorDigits: 2,
    entities: ["TURKMENISTAN"],
  },
  {
    code: "AED",
    name: "UAE Dirham",
    minorDigits: 2,
    entities: ["UNITED ARAB EMIRATES (THE)"],
  },
  {
    code: "UGX",
    name: "Uganda Shilling",
    minorDigits: 0,
    entities: ["UGANDA"],
  },
  {
    code: "USD",
    name: "US Dollar",
    minorDigits: 2,
    entities: ["AMERICAN SAMOA","BONAIRE, SINT EUSTATIUS AND SABA","BRITISH INDIAN OCEAN TERRITORY (THE)","ECUADOR","EL SALVADOR","GUAM","HAITI","MARSHALL ISLANDS (THE)","MICRONESIA (FEDERATED STATES OF)","NORTHERN MARIANA ISLANDS (THE)","PALAU","PANAMA","PUERTO RICO","TIMOR-LESTE","TURKS AND CAICOS ISLANDS (THE)","UNITED STATES MINOR OUTLYING ISLANDS (THE)","UNITED STATES OF AMERICA (THE)","VIRGIN ISLANDS (BRITISH)","VIRGIN ISLANDS (U.S.)"],
  },
  {
    code: "UZS",
    name: "Uzbekistan Sum",
    minorDigits: 2,
    entities: ["UZBEKISTAN"],
  },
  {
    code: "VUV",
    name: "Vatu",
    minorDigits: 0,
    entities: ["VANUATU"],
  },
  {
    code: "KRW",
    name: "Won",
    minorDigits: 0,
    entities: ["KOREA (THE REPUBLIC OF)"],
  },
  {
    code: "YER",
    name: "Yemeni Rial",
    minorDigits: 2,
    entities: ["YEMEN"],
  },
  {
    code: "JPY",
    name: "Yen",
    minorDigits: 0,
    entities: ["JAPAN"],
  },
  {
    code: "CNY",
    name: "Yuan Renminbi",
    minorDigits: 2,
    entities: ["CHINA"],
  },
  {
    code: "ZMW",
    name: "Zambian Kwacha",
    minorDigits: 2,
    entities: ["ZAMBIA"],
  },
  {
    code: "ZWG",
    name: "Zimbabwe Gold",
    minorDigits: 2,
    entities: ["ZIMBABWE"],
  },
  {
    code: "PLN",
    name: "Zloty",
    minorDigits: 2,
    entities: ["POLAND"],
  },
] as const satisfies readonly CurrencyDefinition[];

export type CurrencyCode = (typeof CURRENCY_CATALOG)[number]["code"];

export const CURRENCIES: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    CURRENCY_CATALOG.map(({ code, minorDigits }) => [code, minorDigits]),
  ),
);

const CURRENCY_BY_CODE = new Map<string, CurrencyDefinition>(
  CURRENCY_CATALOG.map((currency) => [currency.code, currency]),
);

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCY_BY_CODE.has(value);
}

export function getCurrency(code: string | undefined) {
  return code ? CURRENCY_BY_CODE.get(code) : undefined;
}

function normalizeCurrencySearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .trim();
}

export function searchCurrencies(query: string): readonly CurrencyDefinition[] {
  const normalized = normalizeCurrencySearch(query);
  if (!normalized) return CURRENCY_CATALOG;
  return CURRENCY_CATALOG.filter(({ code, name, entities }) =>
    [code, name, ...entities].some((value) =>
      normalizeCurrencySearch(value).includes(normalized),
    ),
  );
}
