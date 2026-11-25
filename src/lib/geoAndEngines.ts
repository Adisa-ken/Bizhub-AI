export const GLOBAL_COUNTRY_LABEL = 'Global (All Countries)';
export const ALL_STATES_LABEL = 'All States / National';

export interface CountryOption {
  code: string;
  name: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: '', name: GLOBAL_COUNTRY_LABEL },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo (DRC)' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macao' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KP', name: 'North Korea' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

export const STATES_BY_COUNTRY: Record<string, string[]> = {
  'United States': [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
    'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
    'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
    'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  Nigeria: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
    'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
    'Taraba', 'Yobe', 'Zamfara',
  ],
  'United Kingdom': [
    'England', 'Scotland', 'Wales', 'Northern Ireland', 'Greater London',
    'Greater Manchester', 'West Midlands', 'West Yorkshire', 'Merseyside',
    'South East England', 'South West England', 'East of England', 'East Midlands',
  ],
  Canada: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Yukon',
  ],
  India: [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Chandigarh',
    'Puducherry', 'Ladakh',
  ],
  Australia: [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland',
    'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
  ],
  Germany: [
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hesse',
    'Lower Saxony', 'Mecklenburg-Vorpommern', 'North Rhine-Westphalia', 'Rhineland-Palatinate',
    'Saarland', 'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
  ],
  France: [
    'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Brittany', 'Centre-Val de Loire',
    'Corsica', 'Grand Est', 'Hauts-de-France', 'Île-de-France (Paris)', 'Normandy',
    'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', "Provence-Alpes-Côte d'Azur",
  ],
  Brazil: [
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal',
    'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul',
    'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí',
    'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima',
    'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins',
  ],
  'South Africa': [
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga',
    'North West', 'Northern Cape', 'Western Cape',
  ],
  Kenya: [
    'Nairobi', 'Mombasa', 'Kiambu', 'Nakuru', 'Kisumu', 'Uasin Gishu', 'Machakos',
    'Kajiado', 'Kilifi', 'Nyeri', 'Meru', 'Kakamega',
  ],
  Ghana: [
    'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra',
    'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West',
    'Volta', 'Western', 'Western North',
  ],
  'United Arab Emirates': [
    'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah',
  ],
  'Saudi Arabia': [
    'Riyadh', 'Makkah', 'Eastern Province', 'Madinah', 'Asir', 'Qassim', 'Tabuk', 'Jazan',
  ],
  Spain: [
    'Andalusia', 'Aragon', 'Asturias', 'Balearic Islands', 'Basque Country', 'Canary Islands',
    'Cantabria', 'Castile and León', 'Castilla-La Mancha', 'Catalonia', 'Community of Madrid',
    'Extremadura', 'Galicia', 'Murcia', 'Navarre', 'Valencian Community',
  ],
  Italy: [
    'Abruzzo', 'Apulia', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
    'Lazio', 'Liguria', 'Lombardy', 'Marche', 'Piedmont', 'Sardinia', 'Sicily', 'Tuscany',
    'Trentino-South Tyrol', 'Umbria', 'Veneto',
  ],
  Japan: [
    'Tokyo', 'Osaka', 'Kanagawa', 'Aichi', 'Saitama', 'Chiba', 'Hyogo', 'Hokkaido',
    'Fukuoka', 'Kyoto', 'Shizuoka', 'Hiroshima',
  ],
  'South Korea': [
    'Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan', 'Gyeonggi',
    'Gangwon', 'Jeju',
  ],
  Mexico: [
    'Aguascalientes', 'Baja California', 'Chihuahua', 'Ciudad de México', 'Coahuila',
    'Estado de México', 'Guanajuato', 'Jalisco', 'Nuevo León', 'Oaxaca', 'Puebla',
    'Querétaro', 'Quintana Roo', 'Sinaloa', 'Sonora', 'Veracruz', 'Yucatán',
  ],
  Indonesia: [
    'Jakarta', 'West Java', 'East Java', 'Central Java', 'Banten', 'Bali', 'North Sumatra',
    'South Sulawesi', 'Yogyakarta', 'Riau',
  ],
  Philippines: [
    'Metro Manila (NCR)', 'Calabarzon', 'Central Luzon', 'Central Visayas (Cebu)',
    'Davao Region', 'Western Visayas', 'Ilocos Region', 'Northern Mindanao',
  ],
  Egypt: [
    'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Sharqia', 'Dakahlia', 'Beheira', 'Red Sea',
  ],
  Pakistan: [
    'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory',
    'Gilgit-Baltistan', 'Azad Kashmir',
  ],
  Bangladesh: [
    'Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Sylhet', 'Rangpur', 'Barishal', 'Mymensingh',
  ],
  Vietnam: [
    'Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong', 'Can Tho', 'Binh Duong', 'Dong Nai',
  ],
  Thailand: [
    'Bangkok', 'Chiang Mai', 'Phuket', 'Chonburi', 'Nonthaburi', 'Pathum Thani', 'Khon Kaen',
  ],
  Malaysia: [
    'Kuala Lumpur', 'Selangor', 'Penang', 'Johor', 'Sabah', 'Sarawak', 'Perak', 'Pahang',
  ],
  Singapore: [
    'Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region',
  ],
  Netherlands: [
    'North Holland', 'South Holland', 'Utrecht', 'North Brabant', 'Gelderland', 'Limburg', 'Overijssel',
  ],
  Sweden: ['Stockholm', 'Västra Götaland', 'Skåne', 'Uppsala', 'Östergötland'],
  Switzerland: ['Zurich', 'Geneva', 'Vaud', 'Bern', 'Basel-Stadt', 'Aargau', 'Ticino'],
  Poland: ['Masovia (Warsaw)', 'Lesser Poland (Kraków)', 'Silesia', 'Greater Poland', 'Lower Silesia', 'Pomerania'],
  Turkey: ['Istanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Kocaeli'],
  Argentina: ['Buenos Aires', 'CABA', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán'],
  Colombia: ['Bogotá D.C.', 'Antioquia (Medellín)', 'Valle del Cauca (Cali)', 'Atlántico', 'Santander'],
  Chile: ['Santiago Metropolitan', 'Valparaíso', 'Biobío', 'Antofagasta', 'Los Lagos'],
  'New Zealand': ['Auckland', 'Wellington', 'Canterbury', 'Waikato', 'Bay of Plenty', 'Otago'],
  Ireland: ['Dublin', 'Cork', 'Galway', 'Limerick', 'Kildare', 'Meath'],
  Portugal: ['Lisbon', 'Porto', 'Braga', 'Setúbal', 'Faro (Algarve)', 'Coimbra'],
  Belgium: ['Brussels-Capital', 'Flanders', 'Wallonia', 'Antwerp', 'East Flanders'],
  Austria: ['Vienna', 'Lower Austria', 'Upper Austria', 'Styria', 'Tyrol', 'Salzburg'],
  Norway: ['Oslo', 'Vestland', 'Viken', 'Rogaland', 'Trøndelag'],
  Denmark: ['Capital Region (Copenhagen)', 'Central Denmark', 'Southern Denmark', 'Zealand', 'North Denmark'],
  Finland: ['Uusimaa (Helsinki)', 'Pirkanmaa (Tampere)', 'Southwest Finland', 'North Ostrobothnia'],
  Israel: ['Tel Aviv District', 'Central District', 'Jerusalem District', 'Haifa District', 'Northern District', 'Southern District'],
  Morocco: ['Casablanca-Settat', 'Rabat-Salé-Kénitra', 'Marrakesh-Safi', 'Tanger-Tetouan-Al Hoceïma', 'Fès-Meknès'],
  Ethiopia: ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'Sidama', 'Somali'],
  Tanzania: ['Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma', 'Kilimanjaro', 'Zanzibar'],
  Uganda: ['Central (Kampala)', 'Eastern', 'Northern', 'Western'],
  Rwanda: ['Kigali', 'Eastern', 'Northern', 'Southern', 'Western'],
  China: ['Beijing', 'Shanghai', 'Guangdong', 'Shenzhen', 'Zhejiang', 'Jiangsu', 'Sichuan', 'Hubei', 'Fujian'],
};

export interface SearchEngineGroup {
  group: string;
  engines: string[];
}

export const SEARCH_ENGINE_GROUPS: SearchEngineGroup[] = [
  {
    group: 'Web Search Engines',
    engines: [
      'Google',
      'Bing',
      'DuckDuckGo',
      'Yahoo',
      'Brave Search',
      'Ecosia',
      'Startpage',
      'Qwant',
      'Baidu',
      'Yandex',
      'Naver',
      'Seznam',
    ],
  },
  {
    group: 'Video & Social Search',
    engines: ['YouTube', 'Reddit', 'TikTok', 'Instagram', 'Pinterest', 'LinkedIn', 'X (Twitter)'],
  },
  {
    group: 'Marketplace & App Search',
    engines: ['Amazon', 'eBay', 'Etsy', 'Google Play', 'Apple App Store'],
  },
  {
    group: 'AI Answer & Discovery Engines',
    engines: ['ChatGPT Search', 'Gemini', 'Perplexity', 'Claude', 'Copilot (Bing AI)', 'Grok'],
  },
];

export const ALL_SEARCH_ENGINES: string[] = SEARCH_ENGINE_GROUPS.flatMap((g) => g.engines);

export function getCountryIsoCode(countryName: string): string {
  const clean = countryName.trim().toLowerCase();
  if (!clean || clean === GLOBAL_COUNTRY_LABEL.toLowerCase() || clean === 'global' || clean === 'all') {
    return '';
  }
  const exact = COUNTRIES.find((c) => c.name.toLowerCase() === clean || c.code.toLowerCase() === clean);
  return exact?.code || '';
}

export function getStatesForCountry(countryName: string): string[] {
  const clean = countryName.trim();
  if (!clean || clean === GLOBAL_COUNTRY_LABEL) return [];
  if (STATES_BY_COUNTRY[clean]) return STATES_BY_COUNTRY[clean];
  const matchedKey = Object.keys(STATES_BY_COUNTRY).find((k) => k.toLowerCase() === clean.toLowerCase());
  return matchedKey ? STATES_BY_COUNTRY[matchedKey] : [];
}

export function parseSelectedStates(stateValue?: string): string[] {
  if (!stateValue) return [];
  return Array.from(
    new Set(
      stateValue
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s !== ALL_STATES_LABEL)
    )
  );
}

export function formatSelectedStates(states: string[]): string {
  const cleaned = Array.from(
    new Set(
      states
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s !== ALL_STATES_LABEL)
    )
  );
  return cleaned.length > 0 ? cleaned.join(', ') : ALL_STATES_LABEL;
}

export function formatGeoLabel(country: string, state?: string): string {
  const cleanCountry = country?.trim() || GLOBAL_COUNTRY_LABEL;
  const parsedStates = parseSelectedStates(state);
  if (parsedStates.length === 0) return cleanCountry;
  return `${cleanCountry} · ${parsedStates.join(', ')}`;
}
