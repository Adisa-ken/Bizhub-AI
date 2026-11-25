import type {
  AiPromptIdeaItem,
  BulkKeywordRow,
  ContentIdeaItem,
  KeywordIdeaCategory,
  KeywordIdeaItem,
  SerpResultItem,
  UbersuggestOverviewPayload,
} from '../types';
import {
  ALL_STATES_LABEL,
  formatGeoLabel,
  GLOBAL_COUNTRY_LABEL,
  parseSelectedStates,
} from './geoAndEngines';
import { hashSeed, normalizeDomain } from './intelligence';

export interface LanguageOption {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'tr', name: 'Turkish' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'ur', name: 'Urdu' },
  { code: 'sw', name: 'Swahili' },
  { code: 'zh', name: 'Chinese' },
];

export function getLanguageCode(languageName: string): string {
  const clean = languageName.trim().toLowerCase();
  const matched = SUPPORTED_LANGUAGES.find(
    (l) => l.name.toLowerCase() === clean || l.code.toLowerCase() === clean
  );
  return matched?.code || 'en';
}

export function getCurrencyForCountry(countryName: string): {
  code: string;
  symbol: string;
  rateFromUsd: number;
} {
  const c = countryName.trim().toLowerCase();
  if (c === 'saudi arabia') return { code: 'SAR', symbol: 'SAR ', rateFromUsd: 3.75 };
  if (c === 'united arab emirates') return { code: 'AED', symbol: 'AED ', rateFromUsd: 3.67 };
  if (c === 'qatar') return { code: 'QAR', symbol: 'QAR ', rateFromUsd: 3.64 };
  if (c === 'united kingdom') return { code: 'GBP', symbol: '£', rateFromUsd: 0.79 };
  if (c === 'nigeria') return { code: 'NGN', symbol: '₦', rateFromUsd: 1550 };
  if (c === 'kenya') return { code: 'KES', symbol: 'KSh ', rateFromUsd: 129 };
  if (c === 'south africa') return { code: 'ZAR', symbol: 'R', rateFromUsd: 18.2 };
  if (c === 'ghana') return { code: 'GHS', symbol: '₵', rateFromUsd: 15.5 };
  if (c === 'india') return { code: 'INR', symbol: '₹', rateFromUsd: 84 };
  if (c === 'japan') return { code: 'JPY', symbol: '¥', rateFromUsd: 152 };
  if (c === 'brazil') return { code: 'BRL', symbol: 'R$', rateFromUsd: 5.7 };
  if (c === 'canada') return { code: 'CAD', symbol: 'CA$', rateFromUsd: 1.38 };
  if (c === 'australia') return { code: 'AUD', symbol: 'A$', rateFromUsd: 1.52 };
  if (
    ['germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'austria', 'ireland', 'portugal', 'finland'].includes(
      c
    )
  ) {
    return { code: 'EUR', symbol: '€', rateFromUsd: 0.92 };
  }
  return { code: 'USD', symbol: '$', rateFromUsd: 1 };
}

export function parseBulkKeywordInput(raw: string): string[] {
  const lines = raw
    .split(/[\n\r,;]+/)
    .map((line) => line.replace(/^["'\s]+|["'\s]+$/g, '').trim())
    .filter((line) => line.length >= 2);
  return Array.from(new Set(lines)).slice(0, 25);
}

export function categorizeKeywordIdea(keyword: string, seedKeyword: string): KeywordIdeaCategory {
  const lower = keyword.toLowerCase().trim();
  const seedLower = seedKeyword.toLowerCase().trim();

  if (/\b(vs|versus|or|alternative|alternatives|compare|comparison)\b/.test(lower)) {
    return 'comparisons';
  }
  if (/^(who|what|where|when|why|how|can|is|are|do|does|should|which)\b/.test(lower)) {
    return 'questions';
  }
  if (
    /\b(for|near|with|without|to|in|on|by|from|under|over)\b/.test(
      lower.replace(seedLower, '').trim()
    )
  ) {
    return 'prepositions';
  }
  return 'autocomplete';
}

export function inferKeywordIntent(
  keyword: string
): 'Informational' | 'Commercial' | 'Transactional' | 'Navigational' {
  const lower = keyword.toLowerCase();
  if (/\b(buy|price|pricing|cost|quote|hire|book|near me|emergency|discount|coupon|order)\b/.test(lower)) {
    return 'Transactional';
  }
  if (/\b(best|top|review|reviews|vs|versus|alternative|compare|comparison|software|tool|agency|company|services)\b/.test(lower)) {
    return 'Commercial';
  }
  if (/^(who|what|where|when|why|how|can|guide|tutorial|checklist|template|meaning|examples)\b/.test(lower)) {
    return 'Informational';
  }
  if (/\.(com|org|io|ai|net)\b/.test(lower)) {
    return 'Navigational';
  }
  return 'Commercial';
}

export function formatCompactMonthlyVolume(volume: number): string {
  const safe = Math.max(0, Math.round(Number(volume) || 0));
  if (safe >= 1_000_000) {
    return `${(safe / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (safe >= 1_000) {
    return `${(safe / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return safe.toLocaleString();
}

export function computePaidDifficulty(
  seed: number,
  cpcUsd: number,
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational'
): number {
  const intentBoost =
    intent === 'Transactional' ? 22 : intent === 'Commercial' ? 14 : intent === 'Navigational' ? 8 : 2;
  const cpcBoost = Math.min(35, Math.round(cpcUsd * 6));
  const raw = 6 + intentBoost + cpcBoost + (seed % 32);
  return Math.max(1, Math.min(99, raw));
}

export function getIntentBadgeMeta(intent: string): {
  letter: 'I' | 'C' | 'T' | 'N';
  label: string;
  bgClass: string;
} {
  const norm = intent.trim().toLowerCase();
  if (norm.startsWith('trans')) {
    return {
      letter: 'T',
      label: 'Transactional',
      bgClass: 'bg-emerald-500 text-white',
    };
  }
  if (norm.startsWith('comm')) {
    return {
      letter: 'C',
      label: 'Commercial',
      bgClass: 'bg-[#FF704D] text-white',
    };
  }
  if (norm.startsWith('nav')) {
    return {
      letter: 'N',
      label: 'Navigational',
      bgClass: 'bg-slate-500 text-white',
    };
  }
  return {
    letter: 'I',
    label: 'Informational',
    bgClass: 'bg-[#565FEA] text-white',
  };
}

export function getSeoDifficultySignalMeta(sd: number): {
  bars: 1 | 2 | 3;
  label: 'Easy' | 'Low' | 'Medium' | 'High';
  fppLabel: 'High FPP' | 'Good FPP' | 'Moderate FPP' | 'Competitive';
  colorClass: string;
  badgeBgClass: string;
} {
  if (sd <= 20) {
    return {
      bars: 1,
      label: 'Easy',
      fppLabel: 'High FPP',
      colorClass: 'text-[#16A34A]',
      badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    };
  }
  if (sd <= 38) {
    return {
      bars: 2,
      label: 'Low',
      fppLabel: 'Good FPP',
      colorClass: 'text-[#16A34A]',
      badgeBgClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    };
  }
  if (sd <= 60) {
    return {
      bars: 2,
      label: 'Medium',
      fppLabel: 'Moderate FPP',
      colorClass: 'text-[#D97706]',
      badgeBgClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    };
  }
  return {
    bars: 3,
    label: 'High',
    fppLabel: 'Competitive',
    colorClass: 'text-[#DC2626]',
    badgeBgClass: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  };
}

function buildLocalizedAiPrompts(
  keyword: string,
  language: string,
  country: string,
  state: string
): AiPromptIdeaItem[] {
  const parsedStates = parseSelectedStates(state);
  const geoSuffix =
    parsedStates.length > 0
      ? `${parsedStates[0]}, ${country}`
      : country !== GLOBAL_COUNTRY_LABEL
        ? country
        : 'my area';
  const langLower = language.toLowerCase();

  if (langLower === 'arabic') {
    return [
      {
        id: 'p-1',
        prompt: `أبحث عن أفضل خدمات ${keyword} موثوقة في ${geoSuffix}`,
        platform: 'ChatGPT',
        language,
        intent: 'Transactional',
      },
      {
        id: 'p-2',
        prompt: `ما هي أفضل الخيارات المتاحة الآن لـ ${keyword} مع الأسعار التقديرية؟`,
        platform: 'Gemini',
        language,
        intent: 'Commercial',
      },
      {
        id: 'p-3',
        prompt: `كيف أختار مزود ${keyword} مناسب مع ضمان الجودة وتقييمات العملاء؟`,
        platform: 'ChatGPT',
        language,
        intent: 'Informational',
      },
      {
        id: 'p-4',
        prompt: `قارن بين أبرز الشركات والمنصات المتخصصة في ${keyword} في ${geoSuffix}`,
        platform: 'Gemini',
        language,
        intent: 'Commercial',
      },
      {
        id: 'p-5',
        prompt: `كم تكلفة ${keyword} عادة وما العوامل التي تؤثر على السعر؟`,
        platform: 'ChatGPT',
        language,
        intent: 'Informational',
      },
    ];
  }

  if (langLower === 'spanish') {
    return [
      {
        id: 'p-1',
        prompt: `¿Cuáles son las mejores opciones de ${keyword} disponibles en ${geoSuffix}?`,
        platform: 'ChatGPT',
        language,
        intent: 'Commercial',
      },
      {
        id: 'p-2',
        prompt: `¿Cuánto cuesta contratar ${keyword} y qué debo revisar antes de elegir?`,
        platform: 'Gemini',
        language,
        intent: 'Transactional',
      },
      {
        id: 'p-3',
        prompt: `Compara las principales marcas y alternativas para ${keyword}`,
        platform: 'ChatGPT',
        language,
        intent: 'Commercial',
      },
      {
        id: 'p-4',
        prompt: `Guía paso a paso para evaluar proveedores de ${keyword}`,
        platform: 'Gemini',
        language,
        intent: 'Informational',
      },
      {
        id: 'p-5',
        prompt: `¿Qué errores evitar al buscar ${keyword} en ${geoSuffix}?`,
        platform: 'ChatGPT',
        language,
        intent: 'Informational',
      },
    ];
  }

  if (langLower === 'french') {
    return [
      {
        id: 'p-1',
        prompt: `Quelles sont les meilleures solutions pour ${keyword} à ${geoSuffix} ?`,
        platform: 'ChatGPT',
        language,
        intent: 'Commercial',
      },
      {
        id: 'p-2',
        prompt: `Combien coûte ${keyword} et comment comparer les prestataires fiables ?`,
        platform: 'Gemini',
        language,
        intent: 'Transactional',
      },
      {
        id: 'p-3',
        prompt: `Comparatif des principales marques et alternatives pour ${keyword}`,
        platform: 'ChatGPT',
        language,
        intent: 'Commercial',
      },
      {
        id: 'p-4',
        prompt: `Comment démarrer efficacement avec ${keyword} étape par étape ?`,
        platform: 'Gemini',
        language,
        intent: 'Informational',
      },
      {
        id: 'p-5',
        prompt: `Quels critères privilégier avant de choisir ${keyword} ?`,
        platform: 'ChatGPT',
        language,
        intent: 'Informational',
      },
    ];
  }

  return [
    {
      id: 'p-1',
      prompt: `Find the most trusted ${keyword} options available right now in ${geoSuffix}`,
      platform: 'ChatGPT',
      language,
      intent: 'Transactional',
    },
    {
      id: 'p-2',
      prompt: `What is the average cost for ${keyword} in ${geoSuffix} and how are providers priced?`,
      platform: 'Gemini',
      language,
      intent: 'Commercial',
    },
    {
      id: 'p-3',
      prompt: `Compare top-rated brands and alternatives for ${keyword}`,
      platform: 'ChatGPT',
      language,
      intent: 'Commercial',
    },
    {
      id: 'p-4',
      prompt: `How do I evaluate quality and avoid common pitfalls when choosing ${keyword}?`,
      platform: 'Gemini',
      language,
      intent: 'Informational',
    },
    {
      id: 'p-5',
      prompt: `Which checklist or buyer guide should I follow before committing to ${keyword}?`,
      platform: 'ChatGPT',
      language,
      intent: 'Informational',
    },
  ];
}

export function buildUbersuggestOverviewBaseline(params: {
  keyword: string;
  country?: string;
  state?: string;
  language?: string;
  searchEngine?: string;
}): UbersuggestOverviewPayload {
  const keyword = params.keyword.trim() || 'audience intelligence';
  const country = params.country?.trim() || GLOBAL_COUNTRY_LABEL;
  const parsedStates = parseSelectedStates(params.state);
  const state = parsedStates.length > 0 ? parsedStates.join(', ') : ALL_STATES_LABEL;
  const language = params.language?.trim() || 'English';
  const searchEngine = params.searchEngine?.trim() || 'Google';
  const geoLabel = formatGeoLabel(country, state);

  const seed = hashSeed(`${keyword}|${country}|${state}|${language}|${searchEngine}`);
  const currency = getCurrencyForCountry(country);

  const seoDifficulty = 16 + (seed % 58);
  const seoDifficultyLabel =
    seoDifficulty <= 20 ? 'Easy' : seoDifficulty <= 38 ? 'Low' : seoDifficulty <= 60 ? 'Medium' : 'High';

  const searchIntent = inferKeywordIntent(keyword);
  const cpcUsd = Number((1.1 + ((seed % 65) * 0.12)).toFixed(2));
  const cpcValue = Number(
    (currency.code === 'JPY' || currency.code === 'NGN'
      ? Math.round(cpcUsd * currency.rateFromUsd)
      : cpcUsd * currency.rateFromUsd
    ).toFixed(currency.code === 'JPY' || currency.code === 'NGN' ? 0 : 2)
  );
  const cpcCompetitiveness = cpcUsd >= 4.2 ? 'High' : cpcUsd >= 2.1 ? 'Medium' : 'Low';

  const serpFeaturesList = [
    'AI Overview',
    'People Also Ask',
    ...(searchIntent === 'Transactional' ? ['Local Pack', 'Sponsored Ads'] : ['Featured Snippet', 'Video Carousel']),
    'Discussions & Forums',
  ];

  const monthlyVolumeTotal = 900 + ((seed % 48) * 300);
  const mobilePct = 52 + (seed % 22);
  const desktopPct = 100 - mobilePct;

  const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
  const volumeHistory = months.map((month, idx) => {
    const wave = 0.84 + idx * 0.03 + ((seed >> idx) % 7) * 0.018;
    const total = Math.max(100, Math.round(monthlyVolumeTotal * wave));
    const mobile = Math.round((total * mobilePct) / 100);
    return {
      month,
      total,
      desktop: total - mobile,
      mobile,
    };
  });

  const makeIdeaItem = (
    text: string,
    category: KeywordIdeaCategory,
    idx: number,
    source = 'Free Keyword Engine'
  ): KeywordIdeaItem => {
    const itemSeed = hashSeed(`${text}|${country}`);
    const itemUsd = Number((0.9 + (itemSeed % 45) * 0.11).toFixed(2));
    const intent = inferKeywordIntent(text);
    return {
      keyword: text,
      category,
      volume: 140 + ((itemSeed % 42) * 110),
      difficulty: 12 + ((itemSeed + idx * 5) % 44),
      paidDifficulty: computePaidDifficulty(itemSeed + idx, itemUsd, intent),
      cpc: Number((itemUsd * currency.rateFromUsd).toFixed(currency.code === 'JPY' || currency.code === 'NGN' ? 0 : 2)),
      intent,
      source,
      provenance: 'Estimated',
    };
  };

  const stateToken = parsedStates.length > 0 ? ` ${parsedStates[0].toLowerCase()}` : '';

  const keywordIdeas: Record<KeywordIdeaCategory, KeywordIdeaItem[]> = {
    autocomplete: [
      makeIdeaItem(`${keyword}${stateToken} services`, 'autocomplete', 0),
      makeIdeaItem(`${keyword}${stateToken} cost`, 'autocomplete', 1),
      makeIdeaItem(`${keyword} top rated`, 'autocomplete', 2),
      makeIdeaItem(`${keyword} 24/7`, 'autocomplete', 3),
      makeIdeaItem(`${keyword} reviews`, 'autocomplete', 4),
    ],
    questions: [
      makeIdeaItem(`how to choose ${keyword}`, 'questions', 0),
      makeIdeaItem(`what is the best ${keyword}${stateToken}`, 'questions', 1),
      makeIdeaItem(`why use ${keyword}`, 'questions', 2),
      makeIdeaItem(`how much does ${keyword} cost`, 'questions', 3),
      makeIdeaItem(`where to find ${keyword}${stateToken}`, 'questions', 4),
    ],
    prepositions: [
      makeIdeaItem(`${keyword} for small business`, 'prepositions', 0),
      makeIdeaItem(`${keyword} near ${parsedStates[0] || country}`, 'prepositions', 1),
      makeIdeaItem(`${keyword} with free quote`, 'prepositions', 2),
      makeIdeaItem(`${keyword} without hidden fees`, 'prepositions', 3),
      makeIdeaItem(`${keyword} in ${language}`, 'prepositions', 4),
    ],
    comparisons: [
      makeIdeaItem(`${keyword} vs diy`, 'comparisons', 0),
      makeIdeaItem(`${keyword} alternatives`, 'comparisons', 1),
      makeIdeaItem(`top ${keyword} or agency`, 'comparisons', 2),
      makeIdeaItem(`${keyword} vs competitors`, 'comparisons', 3),
    ],
  };

  const stemSlug = keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'guide';
  const defaultSearchResults: SerpResultItem[] = [
    {
      position: 1,
      title: `Top ${keyword} Providers & Guide (${geoLabel})`,
      url: `https://www.g2.com/categories/${stemSlug}`,
      domain: 'g2.com',
      backlinks: 340 + (seed % 420),
      visits: 1850 + (seed % 1400),
      authority: 84,
      shares: 190 + (seed % 140),
      provenance: 'Estimated',
    },
    {
      position: 2,
      title: `Complete ${keyword} Pricing & Benchmark Overview`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(keyword.replace(/\s+/g, '_'))}`,
      domain: 'wikipedia.org',
      backlinks: 920 + (seed % 500),
      visits: 1420 + (seed % 900),
      authority: 96,
      shares: 310 + (seed % 180),
      provenance: 'Estimated',
    },
    {
      position: 3,
      title: `Community Reviews: Real Experiences with ${keyword}`,
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(keyword)}`,
      domain: 'reddit.com',
      backlinks: 112 + (seed % 180),
      visits: 960 + (seed % 600),
      authority: 91,
      shares: 420 + (seed % 260),
      provenance: 'Estimated',
    },
    {
      position: 4,
      title: `How to Choose ${keyword} in ${geoLabel}`,
      url: `https://www.hubspot.com/resources/${stemSlug}`,
      domain: 'hubspot.com',
      backlinks: 265 + (seed % 320),
      visits: 740 + (seed % 520),
      authority: 89,
      shares: 154 + (seed % 90),
      provenance: 'Estimated',
    },
    {
      position: 5,
      title: `${keyword} Checklist & Cost Calculator`,
      url: `https://www.forbes.com/advisor/${stemSlug}`,
      domain: 'forbes.com',
      backlinks: 410 + (seed % 280),
      visits: 620 + (seed % 440),
      authority: 93,
      shares: 215 + (seed % 120),
      provenance: 'Estimated',
    },
  ];

  const defaultContentIdeas: ContentIdeaItem[] = [
    {
      title: `${keyword} Cost & Pricing Breakdown in ${geoLabel}`,
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(keyword)}`,
      domain: 'reddit.com',
      estVisits: 1480 + (seed % 900),
      backlinks: 34 + (seed % 80),
      socialShares: 210 + (seed % 160),
      source: 'Community Signal',
      provenance: 'Estimated',
    },
    {
      title: `Step-by-Step Guide to Evaluating ${keyword}`,
      url: `https://news.ycombinator.com/`,
      domain: 'news.ycombinator.com',
      estVisits: 920 + (seed % 600),
      backlinks: 28 + (seed % 45),
      socialShares: 145 + (seed % 95),
      source: 'Tech & Founder Discussion',
      provenance: 'Estimated',
    },
  ];

  const orgPct = Math.max(28, 62 - (seed % 18));
  const paidPct = Math.min(26, 8 + (seed % 14));
  const noClickPct = Math.max(10, 100 - orgPct - paidPct);

  return {
    keyword,
    country,
    state,
    language,
    searchEngine,
    generatedAt: new Date().toISOString(),
    provenanceSummary: `Combined zero-cost live endpoints + regional benchmark estimates for ${geoLabel}`,
    liveSourcesUsed: [],
    seoDifficulty,
    seoDifficultyLabel,
    paidDifficulty: computePaidDifficulty(seed, cpcUsd, searchIntent),
    searchIntent,
    cpcValue,
    cpcCurrencyCode: currency.code,
    cpcCurrencySymbol: currency.symbol,
    cpcCompetitiveness,
    serpFeaturesCount: serpFeaturesList.length,
    serpFeaturesList,
    topPagesAvgBacklinks: Math.round(
      defaultSearchResults.reduce((acc, r) => acc + r.backlinks, 0) / defaultSearchResults.length
    ),
    monthlyVolumeTotal,
    deviceSplit: { desktopPct, mobilePct },
    volumeHistory,
    aiSummary: `"${keyword}" in ${geoLabel} (${language}) shows ${seoDifficultyLabel.toLowerCase()} organic competition (SD ${seoDifficulty}/100) with strong ${searchIntent.toLowerCase()} demand. Pairing local landing pages with schema FAQ blocks and community proof improves both traditional ${searchEngine} rankings and AI citations.`,
    aiOverview: `Users searching for "${keyword}" in ${geoLabel} prioritize transparent pricing, verified local/regional availability, and fast turnaround. Authoritative comparison guides, clear service checklists, and verified customer reviews earn the highest share of AI answer citations.`,
    brandsMentioned: [
      { brand: 'G2', domain: 'g2.com', mentions: 4, sentiment: 'Positive' },
      { brand: 'Reddit Community', domain: 'reddit.com', mentions: 3, sentiment: 'Neutral' },
      { brand: 'Wikipedia', domain: 'wikipedia.org', mentions: 2, sentiment: 'Positive' },
      { brand: 'HubSpot', domain: 'hubspot.com', mentions: 2, sentiment: 'Positive' },
    ],
    topAiSources: defaultSearchResults.slice(0, 10).map((r, idx) => ({
      rank: idx + 1,
      domain: r.domain,
      title: r.title,
      url: r.url,
      snippet: `Cited authority source #${idx + 1} for ${keyword} in ${geoLabel}.`,
    })),
    promptsIntent: {
      informationalPct: 44,
      commercialPct: 34,
      transactionalPct: 16,
      navigationalPct: 6,
    },
    searchIntentBreakdown: {
      informationalPct: searchIntent === 'Informational' ? 52 : 34,
      commercialPct: searchIntent === 'Commercial' ? 46 : 32,
      transactionalPct: searchIntent === 'Transactional' ? 42 : 24,
      navigationalPct: 10,
    },
    clickBehavior: {
      organicClicksPct: orgPct,
      paidClicksPct: paidPct,
      noClickPct,
    },
    aiPromptIdeas: buildLocalizedAiPrompts(keyword, language, country, state),
    keywordIdeas,
    audienceAge: [
      { bracket: '18–24', pct: 15 },
      { bracket: '25–34', pct: 34 },
      { bracket: '35–44', pct: 27 },
      { bracket: '45–54', pct: 14 },
      { bracket: '55–64', pct: 7 },
      { bracket: '65+', pct: 3 },
    ],
    searchResults: defaultSearchResults,
    contentIdeas: defaultContentIdeas,
    faqJsonLdSnippet: buildFaqJsonLdSnippet(keyword, keywordIdeas.questions, geoLabel),
  };
}

export function buildBulkKeywordAnalysis(params: {
  keywords: string[];
  country?: string;
  state?: string;
  language?: string;
}): BulkKeywordRow[] {
  const country = params.country?.trim() || GLOBAL_COUNTRY_LABEL;
  const parsedStates = parseSelectedStates(params.state);
  const state = parsedStates.length > 0 ? parsedStates.join(', ') : ALL_STATES_LABEL;
  const currency = getCurrencyForCountry(country);

  return params.keywords.slice(0, 25).map((kw) => {
    const seed = hashSeed(`${kw}|${country}|${state}|${params.language || 'English'}`);
    const cpcUsd = Number((1.0 + (seed % 58) * 0.13).toFixed(2));
    const cpc = Number(
      (currency.code === 'JPY' || currency.code === 'NGN'
        ? Math.round(cpcUsd * currency.rateFromUsd)
        : cpcUsd * currency.rateFromUsd
      ).toFixed(currency.code === 'JPY' || currency.code === 'NGN' ? 0 : 2)
    );
    const intent = inferKeywordIntent(kw);
    return {
      keyword: kw,
      volume: 300 + ((seed % 60) * 250),
      difficulty: 12 + (seed % 64),
      paidDifficulty: computePaidDifficulty(seed, cpcUsd, intent),
      cpc,
      currencySymbol: currency.symbol,
      intent,
      serpFeatures: ['AI Overview', 'PAA', seed % 2 === 0 ? 'Local Pack' : 'Featured Snippet'],
      topPagesAvgBacklinks: 45 + (seed % 320),
      noClickPct: 18 + (seed % 26),
      provenance: 'Estimated',
    };
  });
}

export function extractDomainSafe(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return normalizeDomain(rawUrl);
  }
}

export function buildFaqJsonLdSnippet(
  keyword: string,
  questions: KeywordIdeaItem[],
  geoLabel = 'Global'
): string {
  const picked = (questions.length > 0
    ? questions
    : [
        { keyword: `What is ${keyword}?` },
        { keyword: `How much does ${keyword} cost in ${geoLabel}?` },
        { keyword: `How to choose the best ${keyword}?` },
      ]
  ).slice(0, 5);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: picked.map((q) => {
      const qText = q.keyword.trim().endsWith('?') ? q.keyword.trim() : `${q.keyword.trim()}?`;
      return {
        '@type': 'Question',
        name: qText.charAt(0).toUpperCase() + qText.slice(1),
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Compare verified providers, pricing benchmarks, and regional options for ${keyword} (${geoLabel}) before selecting a plan.`,
        },
      };
    }),
  };

  return JSON.stringify(schema, null, 2);
}

