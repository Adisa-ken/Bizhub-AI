import type {
  AudienceIntelligencePayload,
  CompetitorSnapshot,
  DemographicBreakdown,
  KeywordRecord,
  MediaConsumptionItem,
  PlanConfig,
  RedditCommunityEntry,
  SearchAiPlatformMetric,
  SeoToolId,
  SeoToolResult,
  SocialAccountFollowed,
  SocialNetworkMetric,
  TopicOfInterest,
  WebsiteVisitationEntry,
} from '../types';
import {
  ALL_STATES_LABEL,
  formatGeoLabel,
  getStatesForCountry,
  GLOBAL_COUNTRY_LABEL,
  parseSelectedStates,
} from './geoAndEngines';

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function seededUnit(seed: number, step: number): number {
  const x = Math.sin(seed + step * 97.13) * 10000;
  return x - Math.floor(x);
}

export function normalizeDomain(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return cleaned || 'example.com';
}

export function validateSafeUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatExportCsv(columns: string[], rows: Record<string, string | number>[]): string {
  const header = columns.map(escapeCsvCell).join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCsvCell(row[col])).join(','));
  return [header, ...lines].join('\n');
}

export function computePlanUsage(usedCredits: number, plan: PlanConfig): {
  remaining: number;
  pctUsed: number;
  isNearLimit: boolean;
  isExhausted: boolean;
} {
  const limit = Math.max(1, plan.monthlyCredits);
  const remaining = Math.max(0, limit - usedCredits);
  const pctUsed = Math.min(100, Math.round((usedCredits / limit) * 100));
  return {
    remaining,
    pctUsed,
    isNearLimit: pctUsed >= 80 && remaining > 0,
    isExhausted: remaining <= 0,
  };
}

export function generateAudienceProfile(
  rawQuery: string,
  country = 'United States',
  language = 'English',
  industry = 'B2B SaaS & Marketing',
  state = ALL_STATES_LABEL,
  searchEngine = 'Google'
): AudienceIntelligencePayload {
  const query = rawQuery.trim() || 'B2B SaaS Growth Leaders';
  const parsedStates = parseSelectedStates(state);
  const cleanState = parsedStates.length > 0 ? parsedStates.join(', ') : ALL_STATES_LABEL;
  const cleanEngine = searchEngine.trim() || 'Google';
  const seedInput =
    cleanState === ALL_STATES_LABEL && cleanEngine === 'Google'
      ? `${query}|${country}|${language}|${industry}`
      : `${query}|${country}|${cleanState}|${cleanEngine}|${language}|${industry}`;
  const seed = hashSeed(seedInput);
  const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

  const platformConfigs = [
    { platform: 'YouTube', baseAvg: 74, bias: 11 },
    { platform: 'LinkedIn', baseAvg: 31, bias: 34 },
    { platform: 'Reddit', baseAvg: 24, bias: 26 },
    { platform: 'Instagram', baseAvg: 58, bias: -4 },
    { platform: 'X (Twitter)', baseAvg: 22, bias: 23 },
    { platform: 'Facebook', baseAvg: 63, bias: -17 },
    { platform: 'TikTok', baseAvg: 42, bias: 4 },
    { platform: 'Pinterest', baseAvg: 27, bias: -8 },
    { platform: 'Snapchat', baseAvg: 21, bias: -11 },
    { platform: 'Threads', baseAvg: 14, bias: 9 },
  ];

  const socialNetworks: SocialNetworkMetric[] = platformConfigs
    .map((cfg, idx) => {
      const jitter = Math.round((seededUnit(seed, idx + 1) - 0.45) * 14);
      const audiencePct = Math.max(6, Math.min(94, cfg.baseAvg + cfg.bias + jitter));
      const marketAvgPct = Math.max(8, Math.min(88, cfg.baseAvg + Math.round((seededUnit(seed, idx + 40) - 0.5) * 6)));
      const indexMultiplier = Number((audiencePct / marketAvgPct).toFixed(2));
      const delta30d = Number(((seededUnit(seed, idx + 80) - 0.38) * 8).toFixed(1));
      const historicalSeries = months.map((month, mIdx) => ({
        month,
        audiencePct: Math.max(5, Math.min(96, Math.round(audiencePct - (5 - mIdx) * (delta30d / 4)))),
        avgPct: marketAvgPct,
      }));
      return {
        platform: cfg.platform,
        audiencePct,
        marketAvgPct,
        indexMultiplier,
        rank: 0,
        delta30d,
        recommended: indexMultiplier >= 1.15 || audiencePct >= 55,
        historicalSeries,
        provenance: 'Demo Dataset' as const,
      };
    })
    .sort((a, b) => b.audiencePct - a.audiencePct)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const demographics: DemographicBreakdown[] = [
    { label: '25–34 years', audiencePct: 36, marketAvgPct: 24, category: 'age', provenance: 'Demo Dataset' },
    { label: '35–44 years', audiencePct: 31, marketAvgPct: 22, category: 'age', provenance: 'Demo Dataset' },
    { label: '18–24 years', audiencePct: 14, marketAvgPct: 21, category: 'age', provenance: 'Demo Dataset' },
    { label: '45–54 years', audiencePct: 13, marketAvgPct: 18, category: 'age', provenance: 'Demo Dataset' },
    { label: '55+ years', audiencePct: 6, marketAvgPct: 15, category: 'age', provenance: 'Demo Dataset' },
    { label: 'Female', audiencePct: 47, marketAvgPct: 50, category: 'gender', provenance: 'Demo Dataset' },
    { label: 'Male', audiencePct: 51, marketAvgPct: 49, category: 'gender', provenance: 'Demo Dataset' },
    { label: 'Non-binary / Undisclosed', audiencePct: 2, marketAvgPct: 1, category: 'gender', provenance: 'Demo Dataset' },
    ...(country === GLOBAL_COUNTRY_LABEL
      ? [
          { label: 'United States', audiencePct: 38, marketAvgPct: 24, category: 'country' as const, provenance: 'Demo Dataset' as const },
          { label: 'United Kingdom', audiencePct: 16, marketAvgPct: 9, category: 'country' as const, provenance: 'Demo Dataset' as const },
          { label: 'Canada', audiencePct: 12, marketAvgPct: 7, category: 'country' as const, provenance: 'Demo Dataset' as const },
          { label: 'Germany & EU', audiencePct: 15, marketAvgPct: 14, category: 'country' as const, provenance: 'Demo Dataset' as const },
          { label: 'Nigeria & Africa', audiencePct: 10, marketAvgPct: 8, category: 'country' as const, provenance: 'Estimated' as const },
          { label: 'India & APAC', audiencePct: 9, marketAvgPct: 18, category: 'country' as const, provenance: 'Estimated' as const },
        ]
      : [
          { label: country, audiencePct: 58, marketAvgPct: 35, category: 'country' as const, provenance: 'Demo Dataset' as const },
          { label: 'United Kingdom', audiencePct: 14, marketAvgPct: 9, category: 'country' as const, provenance: 'Demo Dataset' as const },
          { label: 'Canada', audiencePct: 11, marketAvgPct: 7, category: 'country' as const, provenance: 'Demo Dataset' as const },
          { label: 'Germany & EU', audiencePct: 10, marketAvgPct: 12, category: 'country' as const, provenance: 'Demo Dataset' as const },
        ]),
    ...(parsedStates.length > 0
      ? parsedStates.slice(0, 4).map((st, idx) => ({
          label: `${st} (${country})`,
          audiencePct: Math.max(12, 42 - idx * 7),
          marketAvgPct: Math.max(6, 20 - idx * 3),
          category: 'state' as const,
          provenance: 'Estimated' as const,
        }))
      : (country === GLOBAL_COUNTRY_LABEL
          ? ['California (US)', 'Greater London (UK)', 'Ontario (CA)', 'Lagos (NG)']
          : getStatesForCountry(country).slice(0, 3).map((st) => `${st} (${country})`)
        ).map((label, idx) => ({
          label,
          audiencePct: Math.max(14, 34 - idx * 6),
          marketAvgPct: Math.max(8, 19 - idx * 3),
          category: 'state' as const,
          provenance: 'Estimated' as const,
        }))),
    { label: 'Austin, TX · London · Toronto', audiencePct: 34, marketAvgPct: 16, category: 'city', provenance: 'Estimated' },
    { label: language, audiencePct: 84, marketAvgPct: 68, category: 'language', provenance: 'Demo Dataset' },
    { label: 'Bachelor’s Degree or Higher', audiencePct: 71, marketAvgPct: 39, category: 'education', provenance: 'Estimated' },
    { label: 'Marketing, Product & Founders', audiencePct: 54, marketAvgPct: 14, category: 'occupation', provenance: 'Estimated' },
    { label: '$85k–$160k Household Income Indicator', audiencePct: 49, marketAvgPct: 26, category: 'income', provenance: 'Estimated' },
    { label: 'Dual-income urban households', audiencePct: 53, marketAvgPct: 38, category: 'household', provenance: 'Estimated' },
  ];

  const topicStem = query.split(/\s+/).slice(0, 3).join(' ');
  const searchAndAi: SearchAiPlatformMetric[] = [
    {
      platform: 'Google Search',
      type: 'Traditional Search',
      audienceAdoptionPct: 91,
      visibilityScore: 68,
      brandMentionsEst: 1420,
      competitorMentionsEst: 2380,
      topQuestions: [
        `Best tools for ${topicStem} workflows`,
        `How to measure ROI for ${topicStem}`,
      ],
      citationOpportunities: ['Publish benchmark comparison tables', 'Add schema FAQ markup on buying guides'],
      history: months.map((month, i) => ({ month, visibility: 56 + i * 2 + (seed % 5) })),
      provenance: 'Estimated',
    },
    {
      platform: 'ChatGPT',
      type: 'AI Search',
      audienceAdoptionPct: 64,
      visibilityScore: 44,
      brandMentionsEst: 310,
      competitorMentionsEst: 590,
      topQuestions: [
        `Compare top ${topicStem} platforms by budget`,
        `Build a 90-day playbook for ${topicStem}`,
      ],
      citationOpportunities: ['Get cited in G2/Reddit comparison threads', 'Publish transparent pricing pages'],
      history: months.map((month, i) => ({ month, visibility: 31 + i * 3 })),
      provenance: 'AI-Inferred',
    },
    {
      platform: 'Gemini',
      type: 'AI Search',
      audienceAdoptionPct: 52,
      visibilityScore: 49,
      brandMentionsEst: 280,
      competitorMentionsEst: 410,
      topQuestions: [
        `What metrics matter most for ${topicStem}?`,
        `Step-by-step audit checklist for ${industry}`,
      ],
      citationOpportunities: ['Publish original research reports with clear data attribution', 'Optimize YouTube transcripts'],
      history: months.map((month, i) => ({ month, visibility: 35 + i * 3 })),
      provenance: 'AI-Inferred',
    },
    {
      platform: 'Perplexity',
      type: 'AI Search',
      audienceAdoptionPct: 39,
      visibilityScore: 38,
      brandMentionsEst: 195,
      competitorMentionsEst: 440,
      topQuestions: [
        `${topicStem} market size and benchmark statistics`,
        `Alternatives to legacy ${topicStem} software`,
      ],
      citationOpportunities: ['Create cite-worthy statistics glossary pages', 'Contribute guest studies to trade journals'],
      history: months.map((month, i) => ({ month, visibility: 25 + i * 3 })),
      provenance: 'AI-Inferred',
    },
    {
      platform: 'Claude',
      type: 'AI Search',
      audienceAdoptionPct: 34,
      visibilityScore: 33,
      brandMentionsEst: 140,
      competitorMentionsEst: 290,
      topQuestions: [
        `Draft positioning brief for ${topicStem}`,
        `Evaluate vendor risks in ${industry}`,
      ],
      citationOpportunities: ['Publish technical architecture docs and API security FAQs'],
      history: months.map((month, i) => ({ month, visibility: 22 + i * 2 })),
      provenance: 'AI-Inferred',
    },
    {
      platform: 'Bing',
      type: 'Traditional Search',
      audienceAdoptionPct: 28,
      visibilityScore: 54,
      brandMentionsEst: 460,
      competitorMentionsEst: 610,
      topQuestions: [
        `Enterprise ${topicStem} pricing comparison`,
      ],
      citationOpportunities: ['Submit clean XML sitemaps via Bing Webmaster Tools'],
      history: months.map((month, i) => ({ month, visibility: 49 + i })),
      provenance: 'Estimated',
    },
  ];

  const websiteVisitation: WebsiteVisitationEntry[] = [
    { domain: 'linkedin.com', category: 'Professional Network', monthlyVisitsEst: 1850000000, overlapPct: 68, primarySource: 'Direct', topCountry: country, isCompetitor: false, provenance: 'Demo Dataset' },
    { domain: 'reddit.com', category: 'Community Forum', monthlyVisitsEst: 1620000000, overlapPct: 54, primarySource: 'Organic Search', topCountry: country, isCompetitor: false, provenance: 'Demo Dataset' },
    { domain: 'g2.com', category: 'Software Reviews', monthlyVisitsEst: 21400000, overlapPct: 41, primarySource: 'Organic Search', topCountry: country, isCompetitor: false, provenance: 'Estimated' },
    { domain: 'substack.com', category: 'Newsletters & Media', monthlyVisitsEst: 78500000, overlapPct: 37, primarySource: 'Referral', topCountry: country, isCompetitor: false, provenance: 'Estimated' },
    { domain: 'semrush.com', category: 'Marketing Intelligence', monthlyVisitsEst: 19200000, overlapPct: 33, primarySource: 'Organic Search', topCountry: country, isCompetitor: true, provenance: 'Estimated' },
    { domain: 'ahrefs.com', category: 'SEO Platform', monthlyVisitsEst: 16800000, overlapPct: 31, primarySource: 'Organic Search', topCountry: country, isCompetitor: true, provenance: 'Estimated' },
    { domain: 'sparktoro.com', category: 'Audience Research', monthlyVisitsEst: 1450000, overlapPct: 28, primarySource: 'Direct', topCountry: country, isCompetitor: true, provenance: 'Estimated' },
    { domain: 'producthunt.com', category: 'Product Discovery', monthlyVisitsEst: 8900000, overlapPct: 26, primarySource: 'Social', topCountry: country, isCompetitor: false, provenance: 'Demo Dataset' },
  ];

  const keywordTemplates: Array<Omit<KeywordRecord, 'country' | 'language' | 'searchEngine' | 'provenance' | 'trend12m'>> = [
    {
      keyword: `${topicStem.toLowerCase()} audience research tools`,
      searchVolume: 14800 + (seed % 2500),
      difficulty: 42,
      cpcUsd: 6.4,
      competition: 'Medium',
      intent: 'Commercial',
      cluster: 'Tool Discovery',
      isQuestion: false,
      isTrending: true,
      gapOpportunityScore: 86,
    },
    {
      keyword: `how to find where ${topicStem.toLowerCase()} hang out online`,
      searchVolume: 5400 + (seed % 900),
      difficulty: 24,
      cpcUsd: 3.1,
      competition: 'Low',
      intent: 'Informational',
      cluster: 'Audience Discovery',
      isQuestion: true,
      isTrending: true,
      gapOpportunityScore: 91,
    },
    {
      keyword: `best ${topicStem.toLowerCase()} competitor analysis software`,
      searchVolume: 9900 + (seed % 1800),
      difficulty: 56,
      cpcUsd: 9.2,
      competition: 'High',
      intent: 'Commercial',
      cluster: 'Competitor Intelligence',
      isQuestion: false,
      isTrending: false,
      gapOpportunityScore: 74,
    },
    {
      keyword: `ai search visibility tracker for ${industry.toLowerCase()}`,
      searchVolume: 4100 + (seed % 1100),
      difficulty: 19,
      cpcUsd: 5.8,
      competition: 'Low',
      intent: 'Commercial',
      cluster: 'AI Search GEO',
      isQuestion: false,
      isTrending: true,
      gapOpportunityScore: 94,
    },
    {
      keyword: `what keywords do ${topicStem.toLowerCase()} search most`,
      searchVolume: 2900 + (seed % 600),
      difficulty: 21,
      cpcUsd: 2.8,
      competition: 'Low',
      intent: 'Informational',
      cluster: 'Keyword Strategy',
      isQuestion: true,
      isTrending: true,
      gapOpportunityScore: 88,
    },
    {
      keyword: `${topicStem.toLowerCase()} pricing benchmark template`,
      searchVolume: 3600 + (seed % 700),
      difficulty: 29,
      cpcUsd: 4.5,
      competition: 'Medium',
      intent: 'Transactional',
      cluster: 'Conversion Assets',
      isQuestion: false,
      isTrending: false,
      gapOpportunityScore: 82,
    },
    {
      keyword: `reddit communities for ${topicStem.toLowerCase()}`,
      searchVolume: 2100 + (seed % 500),
      difficulty: 16,
      cpcUsd: 1.9,
      competition: 'Low',
      intent: 'Informational',
      cluster: 'Community Channels',
      isQuestion: false,
      isTrending: true,
      gapOpportunityScore: 90,
    },
    {
      keyword: `${topicStem.toLowerCase()} content gap checklist`,
      searchVolume: 1850 + (seed % 400),
      difficulty: 18,
      cpcUsd: 3.4,
      competition: 'Low',
      intent: 'Informational',
      cluster: 'Content Strategy',
      isQuestion: false,
      isTrending: false,
      gapOpportunityScore: 85,
    },
  ];

  const keywords: KeywordRecord[] = keywordTemplates.map((kw, idx) => ({
    ...kw,
    keyword:
      parsedStates.length > 0 && idx === 0
        ? `${kw.keyword} in ${parsedStates[0].toLowerCase()}`
        : kw.keyword,
    trend12m: Array.from({ length: 12 }, (_, m) => Math.max(400, Math.round(kw.searchVolume * (0.76 + m * 0.025 + seededUnit(seed, idx + m) * 0.1)))),
    country,
    language,
    searchEngine: cleanEngine,
    provenance: 'Demo Dataset',
  }));

  const mediaConsumption: MediaConsumptionItem[] = [
    {
      title: 'Marketing Against the Grain',
      mediaType: 'Podcast',
      url: 'https://www.youtube.com/@marketingagainstthegrain',
      audienceAffinityPct: 44,
      topicFocus: 'AI growth playbooks & demand generation',
      frequency: '3x weekly',
      provenance: 'Demo Dataset',
    },
    {
      title: 'Lenny’s Newsletter & Podcast',
      mediaType: 'Blog',
      url: 'https://www.lennysnewsletter.com',
      audienceAffinityPct: 48,
      topicFocus: 'Product-led growth & customer retention',
      frequency: 'Weekly',
      provenance: 'Demo Dataset',
    },
    {
      title: 'Search Engine Journal',
      mediaType: 'Industry Publication',
      url: 'https://www.searchenginejournal.com',
      audienceAffinityPct: 39,
      topicFocus: 'Technical SEO, SERP shifts & AI Overviews',
      frequency: 'Daily',
      provenance: 'Demo Dataset',
    },
    {
      title: 'Ahrefs TV',
      mediaType: 'YouTube Channel',
      url: 'https://www.youtube.com/@AhrefsCom',
      audienceAffinityPct: 42,
      topicFocus: 'Keyword research & link acquisition tutorials',
      frequency: 'Weekly',
      provenance: 'Demo Dataset',
    },
    {
      title: 'The Information',
      mediaType: 'News Publication',
      url: 'https://www.theinformation.com',
      audienceAffinityPct: 29,
      topicFocus: 'Tech strategy & market shifts',
      frequency: 'Daily',
      provenance: 'Estimated',
    },
    {
      title: 'Demand Curve Growth Guide',
      mediaType: 'Online Magazine',
      url: 'https://www.demandcurve.com',
      audienceAffinityPct: 35,
      topicFocus: 'Landing page conversion & paid acquisition',
      frequency: 'Bi-weekly',
      provenance: 'Demo Dataset',
    },
  ];

  const redditCommunities: RedditCommunityEntry[] = [
    {
      subreddit: 'r/marketing',
      subscribersEst: '1.6M',
      audienceMatchPct: 67,
      coreTopics: ['Attribution', 'AI content workflows', 'Channel saturation'],
      popularDiscussion: `How teams validate ${topicStem} messaging before scaling paid spend`,
      faqQuestion: 'Which free/low-cost tools show real audience overlap without enterprise contracts?',
      customerComplaint: 'Too many analytics tools return generic traffic numbers without buyer context.',
      trendDirection: 'Rising',
      provenance: 'Demo Dataset',
    },
    {
      subreddit: 'r/SEO',
      subscribersEst: '410K',
      audienceMatchPct: 61,
      coreTopics: ['Zero-click SERPs', 'AI citations', 'Technical audits'],
      popularDiscussion: 'Tracking brand citations in Gemini, ChatGPT, and Perplexity alongside Google rank',
      faqQuestion: 'How do you identify low-KD commercial keywords that AI Overviews do not completely absorb?',
      customerComplaint: 'Keyword tools over-report search volume on informational terms with declining clicks.',
      trendDirection: 'Rising',
      provenance: 'Demo Dataset',
    },
    {
      subreddit: 'r/SaaS',
      subscribersEst: '320K',
      audienceMatchPct: 56,
      coreTopics: ['ICP discovery', 'Churn reduction', 'Pricing tiers'],
      popularDiscussion: `Finding first 100 customers in ${industry} using niche community listening`,
      faqQuestion: 'Should early teams invest in SEO or creator partnerships first?',
      customerComplaint: 'Agencies pitch broad content calendars instead of high-intent customer pain points.',
      trendDirection: 'Steady',
      provenance: 'Demo Dataset',
    },
    {
      subreddit: 'r/PPC',
      subscribersEst: '190K',
      audienceMatchPct: 43,
      coreTopics: ['CPC inflation', 'Landing page match', 'Negative keyword mining'],
      popularDiscussion: 'Reducing wasted ad spend by mining Reddit objections for ad copy',
      faqQuestion: 'What CPC threshold makes organic content a better ROI than Google Ads?',
      customerComplaint: 'Rising CPCs force smaller teams to combine organic audience intelligence with paid.',
      trendDirection: 'Peak',
      provenance: 'Estimated',
    },
  ];

  const socialAccounts: SocialAccountFollowed[] = [
    {
      name: 'Rand Fishkin',
      handle: '@randfish',
      platform: 'LinkedIn',
      profileUrl: 'https://www.linkedin.com/in/randfishkin/',
      industry: 'Audience Research & Zero-Click Marketing',
      relevanceScore: 94,
      followersPublic: '245K',
      engagementRatePct: 3.4,
      collaborationIdea: 'Co-author zero-click distribution benchmark study',
      observationKind: 'Observed Public Profile',
    },
    {
      name: 'Lily Ray',
      handle: '@lilyraynyc',
      platform: 'X',
      profileUrl: 'https://x.com/lilyraynyc',
      industry: 'SEO & AI Search Visibility',
      relevanceScore: 91,
      followersPublic: '118K',
      engagementRatePct: 2.9,
      collaborationIdea: 'Invite for AI Search Visibility teardown webinar',
      observationKind: 'Observed Public Profile',
    },
    {
      name: 'Sam Kuehnle',
      handle: '@samkuehnle',
      platform: 'LinkedIn',
      profileUrl: 'https://www.linkedin.com',
      industry: 'B2B Demand Generation',
      relevanceScore: 86,
      followersPublic: '42K',
      engagementRatePct: 4.1,
      collaborationIdea: 'Podcast interview on customer dark-social attribution',
      observationKind: 'AI-Inferred Recommendation',
    },
    {
      name: 'Aleyda Solis',
      handle: '@aleyda',
      platform: 'YouTube',
      profileUrl: 'https://www.youtube.com/@CrawlingMondays',
      industry: 'Technical & International SEO',
      relevanceScore: 89,
      followersPublic: '68K',
      engagementRatePct: 4.6,
      collaborationIdea: 'Sponsor Crawling Mondays technical audit episode',
      observationKind: 'Observed Public Profile',
    },
    {
      name: 'Katelyn Bourgoin',
      handle: '@KateBourgoin',
      platform: 'Substack',
      profileUrl: 'https://customercamp.co',
      industry: 'Buyer Psychology & Positioning',
      relevanceScore: 88,
      followersPublic: '95K',
      engagementRatePct: 5.2,
      collaborationIdea: 'Newsletter feature on buyer trigger research',
      observationKind: 'AI-Inferred Recommendation',
    },
  ];

  const topicsOfInterest: TopicOfInterest[] = [
    {
      topic: 'AI Search & Answer Engine Visibility',
      category: 'Trending Subject',
      cluster: 'Search Evolution',
      interestPct: 78,
      growthPct: 64,
      relatedQuestion: 'How do brands earn citations inside AI answers?',
      contentOpportunity: 'Publish primary-source benchmark datasets and structured comparison matrices.',
      provenance: 'AI-Inferred',
    },
    {
      topic: 'Tool Consolidation & Budget Efficiency',
      category: 'Buying Interest',
      cluster: 'Procurement',
      interestPct: 72,
      growthPct: 38,
      relatedQuestion: `Can one platform replace separate SEO and audience tools for ${industry}?`,
      contentOpportunity: 'Interactive ROI calculator comparing stacked subscriptions vs unified workflows.',
      provenance: 'Demo Dataset',
    },
    {
      topic: 'Unreliable Traffic & Attribution Blind Spots',
      category: 'Pain Point',
      cluster: 'Measurement',
      interestPct: 69,
      growthPct: 29,
      relatedQuestion: 'Why do reported keyword volumes fail to convert into pipeline?',
      contentOpportunity: 'Guide on pairing buyer-intent Reddit objections with low-KD search keywords.',
      provenance: 'Demo Dataset',
    },
    {
      topic: 'Creator-Led & Community Distribution',
      category: 'Industry Discussion',
      cluster: 'Go-To-Market',
      interestPct: 61,
      growthPct: 41,
      relatedQuestion: `Which niche podcasts and newsletters influence ${topicStem} buyers?`,
      contentOpportunity: 'Outreach shortlist template for 20 mid-tier industry creators.',
      provenance: 'Estimated',
    },
    {
      topic: 'Weekend Productivity & Workflow Systems',
      category: 'Hobby',
      cluster: 'Lifestyle Overlap',
      interestPct: 44,
      growthPct: 12,
      relatedQuestion: 'What lightweight automation habits do growth operators use?',
      contentOpportunity: 'Human-interest founder workflow teardown on YouTube Shorts & LinkedIn.',
      provenance: 'AI-Inferred',
    },
  ];

  const topSocial = socialNetworks[0];
  const avgOpp = Math.round(keywords.reduce((acc, k) => acc + k.gapOpportunityScore, 0) / keywords.length);
  const aiPlatforms = searchAndAi.filter((p) => p.type === 'AI Search');
  const aiVisAvg = Math.round(aiPlatforms.reduce((acc, p) => acc + p.visibilityScore, 0) / aiPlatforms.length);

  return {
    query,
    country,
    state: cleanState,
    searchEngine: cleanEngine,
    language,
    industry,
    generatedAt: new Date().toISOString(),
    sampleModeNotice:
      'Free live public adapters + demonstration model active. Manage zero-cost and optional free-tier sources in API & Settings.',
    summary: {
      estimatedAudienceSize: `${(140 + (seed % 420)).toLocaleString()}K – ${(620 + (seed % 380)).toLocaleString()}K`,
      topPlatform: topSocial.platform,
      topPlatformAffinity: topSocial.audiencePct,
      avgKeywordOpportunity: avgOpp,
      aiVisibilityIndex: aiVisAvg,
    },
    socialNetworks,
    demographics,
    searchAndAi,
    websiteVisitation,
    keywords,
    mediaConsumption,
    redditCommunities,
    socialAccounts,
    topicsOfInterest,
  };
}

export function generateCompetitorComparison(rawDomains: string[], contextQuery: string): CompetitorSnapshot[] {
  const uniqueDomains = Array.from(new Set(rawDomains.map(normalizeDomain).filter(Boolean))).slice(0, 5);
  return uniqueDomains.map((domain, index) => {
    const seed = hashSeed(`${domain}|${contextQuery}`);
    const da = 42 + (seed % 48);
    const organicTrafficEst = 28000 + (seed % 480000);
    const paidTrafficEst = Math.round(organicTrafficEst * (0.08 + seededUnit(seed, 2) * 0.18));
    const backlinksEst = 12000 + (seed % 380000);
    const referringDomainsEst = Math.round(backlinksEst * 0.09);
    const overlapPct = Math.max(12, Math.min(78, 22 + ((seed + index * 13) % 52)));
    const stem = domain.split('.')[0];

    return {
      domain,
      organicTrafficEst,
      domainAuthority: da,
      paidTrafficEst,
      backlinksEst,
      referringDomainsEst,
      audienceOverlapPct: overlapPct,
      topKeywords: [
        { keyword: `${stem} alternative`, position: 1 + (index % 3), volume: 6400 + (seed % 2000), url: `https://${domain}/compare` },
        { keyword: `audience research ${stem}`, position: 2 + (index % 4), volume: 4200 + (seed % 1500), url: `https://${domain}/features` },
        { keyword: `${stem} pricing`, position: 1, volume: 8100 + (seed % 1900), url: `https://${domain}/pricing` },
      ],
      bestPages: [
        { path: '/blog/audience-research-guide', estTraffic: Math.round(organicTrafficEst * 0.19), backlinks: 420 + (seed % 300) },
        { path: '/tools/keyword-explorer', estTraffic: Math.round(organicTrafficEst * 0.14), backlinks: 310 + (seed % 200) },
        { path: '/benchmarks/2026-report', estTraffic: Math.round(organicTrafficEst * 0.11), backlinks: 580 + (seed % 400) },
      ],
      socialPresence: [
        { platform: 'LinkedIn', followersEst: `${24 + (seed % 90)}K`, activityLevel: '4 posts / week' },
        { platform: 'YouTube', followersEst: `${12 + (seed % 75)}K`, activityLevel: '2 videos / week' },
        { platform: 'X', followersEst: `${18 + (seed % 65)}K`, activityLevel: 'Daily' },
      ],
      marketOpportunities: [
        `Target "${stem} vs" comparison keywords (high commercial intent, lower KD)`,
        `Close content gap on AI Search visibility & Reddit community listening`,
        `Outperform ${domain} on YouTube tutorials and transparent free-tier onboarding`,
      ],
      provenance: 'Demo Dataset',
    };
  });
}

export function generateSeoToolData(
  toolId: SeoToolId,
  rawTarget: string,
  country = 'United States',
  searchEngine = 'Google',
  state = ALL_STATES_LABEL
): SeoToolResult {
  const target = rawTarget.trim() || 'bizhub.ai';
  const parsedStates = parseSelectedStates(state);
  const cleanState = parsedStates.length > 0 ? parsedStates.join(', ') : ALL_STATES_LABEL;
  const geoLabel = formatGeoLabel(country, cleanState);
  const stateSuffix = parsedStates.length > 0 ? ` in ${parsedStates[0]}` : '';
  const seed = hashSeed(`${toolId}|${target}|${country}|${cleanState}|${searchEngine}`);
  const now = new Date().toISOString();

  switch (toolId) {
    case 'keyword-explorer':
      return {
        toolId,
        target,
        country,
        state: cleanState,
        searchEngine,
        generatedAt: now,
        provenance: 'Demo Dataset',
        summaryMetrics: [
          { label: 'Monthly Volume', value: (12400 + (seed % 18000)).toLocaleString(), delta: '+14% YoY' },
          { label: 'Keyword Difficulty', value: `${28 + (seed % 44)} / 100` },
          { label: 'Est. CPC', value: `$${(3.2 + (seed % 7)).toFixed(2)}` },
          { label: `Market (${searchEngine})`, value: geoLabel },
        ],
        columns: ['Keyword', 'Volume', 'KD', 'CPC ($)', 'Intent', 'Opportunity'],
        rows: [
          { Keyword: `${target} platform${stateSuffix}`, Volume: 14800, KD: 38, 'CPC ($)': 6.4, Intent: 'Commercial', Opportunity: 'High' },
          { Keyword: `best ${target} alternatives${stateSuffix}`, Volume: 8200, KD: 31, 'CPC ($)': 7.1, Intent: 'Commercial', Opportunity: 'High' },
          { Keyword: `how to automate ${target}`, Volume: 4600, KD: 21, 'CPC ($)': 3.5, Intent: 'Informational', Opportunity: 'Very High' },
          { Keyword: `${target} pricing calculator`, Volume: 2900, KD: 18, 'CPC ($)': 4.9, Intent: 'Transactional', Opportunity: 'Very High' },
          { Keyword: `${target} benchmark report`, Volume: 3400, KD: 25, 'CPC ($)': 2.8, Intent: 'Informational', Opportunity: 'High' },
        ],
        recommendations: [
          `Prioritise "${target}" localizations on ${searchEngine} for ${geoLabel}.`,
          `Prioritise "how to automate ${target}" (KD 21) for fast organic traction.`,
          'Group commercial comparison terms into a dedicated pillar hub.',
        ],
      };

    case 'serp-analyzer':
      return {
        toolId,
        target,
        country,
        state: cleanState,
        searchEngine,
        generatedAt: now,
        provenance: 'Demo Dataset',
        summaryMetrics: [
          { label: `${searchEngine} Features`, value: 'AI Overview + PAA' },
          { label: 'Avg. Domain Rating', value: `${54 + (seed % 25)}` },
          { label: 'Avg. Word Count', value: `${1850 + (seed % 700)}` },
          { label: 'Target Geo', value: geoLabel },
        ],
        columns: ['Pos', 'Domain', 'Page Type', 'Est. Traffic', 'Ref. Domains', 'SERP Feature'],
        rows: [
          { Pos: 1, Domain: 'sparktoro.com', 'Page Type': 'Product Guide', 'Est. Traffic': 18400, 'Ref. Domains': 412, 'SERP Feature': 'AI Citation' },
          { Pos: 2, Domain: 'ahrefs.com', 'Page Type': 'Interactive Tool', 'Est. Traffic': 14200, 'Ref. Domains': 890, 'SERP Feature': 'Sitelinks' },
          { Pos: 3, Domain: 'semrush.com', 'Page Type': 'Comparison Hub', 'Est. Traffic': 11800, 'Ref. Domains': 640, 'SERP Feature': 'FAQ Rich' },
          { Pos: 4, Domain: 'g2.com', 'Page Type': 'Review Directory', 'Est. Traffic': 9600, 'Ref. Domains': 520, 'SERP Feature': 'Stars' },
          { Pos: 5, Domain: 'reddit.com', 'Page Type': 'Community Thread', 'Est. Traffic': 7400, 'Ref. Domains': 94, 'SERP Feature': 'Discussions' },
        ],
        recommendations: [
          'Position 5 is a Reddit thread—an authoritative guide with real data can break into Top 3.',
          'Include concise 40-word answer blocks to capture AI Overview citations.',
        ],
      };

    case 'website-explorer':
      return {
        toolId,
        target: normalizeDomain(target),
        country,
        state: cleanState,
        searchEngine,
        generatedAt: now,
        provenance: 'Estimated',
        summaryMetrics: [
          { label: 'Est. Monthly Organic', value: (42000 + (seed % 90000)).toLocaleString(), delta: '+9.4%' },
          { label: 'Authority Score', value: `${48 + (seed % 38)}` },
          { label: 'Ranking Keywords', value: (3800 + (seed % 9500)).toLocaleString() },
          { label: 'Target Geo Share', value: `${geoLabel} (58%)` },
        ],
        columns: ['Top Path', 'Primary Keyword', 'Pos', 'Monthly Visits', 'Traffic Share %'],
        rows: [
          { 'Top Path': '/features/audience-intelligence', 'Primary Keyword': 'audience intelligence software', Pos: 3, 'Monthly Visits': 14200, 'Traffic Share %': '24%' },
          { 'Top Path': '/tools/keyword-explorer', 'Primary Keyword': 'free keyword explorer', Pos: 5, 'Monthly Visits': 10800, 'Traffic Share %': '18%' },
          { 'Top Path': '/blog/reddit-market-research', 'Primary Keyword': 'reddit audience research', Pos: 2, 'Monthly Visits': 8900, 'Traffic Share %': '15%' },
          { 'Top Path': '/pricing', 'Primary Keyword': 'marketing intelligence pricing', Pos: 1, 'Monthly Visits': 6100, 'Traffic Share %': '10%' },
        ],
        recommendations: [
          'Double down on interactive free micro-tools—they drive 32% of high-converting organic entrances.',
        ],
      };

    case 'backlink-explorer':
      return {
        toolId,
        target: normalizeDomain(target),
        country,
        searchEngine,
        generatedAt: now,
        provenance: 'Estimated',
        summaryMetrics: [
          { label: 'Referring Domains', value: (1420 + (seed % 3200)).toLocaleString(), delta: '+48 / 30d' },
          { label: 'Total Backlinks', value: (28400 + (seed % 60000)).toLocaleString() },
          { label: 'Dofollow Ratio', value: '79%' },
          { label: 'Toxicity Risk', value: 'Low (2%)' },
        ],
        columns: ['Source Domain', 'DR', 'Anchor Text', 'Type', 'First Seen'],
        rows: [
          { 'Source Domain': 'searchenginejournal.com', DR: 91, 'Anchor Text': 'audience research study', Type: 'Dofollow', 'First Seen': '2026-09-14' },
          { 'Source Domain': 'lennysnewsletter.com', DR: 84, 'Anchor Text': 'growth intelligence workflow', Type: 'Dofollow', 'First Seen': '2026-10-02' },
          { 'Source Domain': 'producthunt.com', DR: 90, 'Anchor Text': 'AudiencePulse AI', Type: 'Nofollow', 'First Seen': '2026-10-19' },
          { 'Source Domain': 'demandcurve.com', DR: 78, 'Anchor Text': 'competitor gap guide', Type: 'Dofollow', 'First Seen': '2026-11-01' },
        ],
        recommendations: [
          'Original data studies earn 3.4x more DR 75+ editorial backlinks than standard blog posts.',
        ],
      };

    case 'competitor-research':
      return {
        toolId,
        target: normalizeDomain(target),
        country,
        searchEngine,
        generatedAt: now,
        provenance: 'Demo Dataset',
        summaryMetrics: [
          { label: 'Tracked Rivals', value: '5 Domains' },
          { label: 'Avg. Overlap', value: '34%' },
          { label: 'Shared Keywords', value: '1,240' },
          { label: 'Untapped Gaps', value: '318' },
        ],
        columns: ['Competitor', 'Authority', 'Est. Organic', 'Paid Keywords', 'Overlap %'],
        rows: [
          { Competitor: 'sparktoro.com', Authority: 76, 'Est. Organic': 185000, 'Paid Keywords': 42, 'Overlap %': '41%' },
          { Competitor: 'ahrefs.com', Authority: 91, 'Est. Organic': 2400000, 'Paid Keywords': 310, 'Overlap %': '33%' },
          { Competitor: 'semrush.com', Authority: 92, 'Est. Organic': 3100000, 'Paid Keywords': 890, 'Overlap %': '29%' },
          { Competitor: 'similarweb.com', Authority: 89, 'Est. Organic': 1950000, 'Paid Keywords': 240, 'Overlap %': '24%' },
        ],
        recommendations: [
          'Open the Competitor Intelligence module to run a full 5-domain matrix comparison.',
        ],
      };

    case 'keyword-gap':
      return {
        toolId,
        target: normalizeDomain(target),
        country,
        searchEngine,
        generatedAt: now,
        provenance: 'Demo Dataset',
        summaryMetrics: [
          { label: 'Missing Keywords', value: '412' },
          { label: 'Weak Keywords', value: '185' },
          { label: 'High-Intent Gaps', value: '94' },
          { label: 'Est. Traffic Upside', value: '+26,400 / mo' },
        ],
        columns: ['Keyword', 'Volume', 'KD', 'Your Pos', 'Top Competitor Pos', 'Gap Status'],
        rows: [
          { Keyword: 'audience research for b2b saas', Volume: 3200, KD: 24, 'Your Pos': 'Not Ranked', 'Top Competitor Pos': 2, 'Gap Status': 'Missing' },
          { Keyword: 'sparktoro vs semrush', Volume: 2800, KD: 19, 'Your Pos': 'Not Ranked', 'Top Competitor Pos': 1, 'Gap Status': 'Missing' },
          { Keyword: 'ai search visibility audit', Volume: 4100, KD: 22, 'Your Pos': 14, 'Top Competitor Pos': 3, 'Gap Status': 'Weak' },
          { Keyword: 'reddit customer pain point mining', Volume: 1900, KD: 15, 'Your Pos': 'Not Ranked', 'Top Competitor Pos': 4, 'Gap Status': 'Missing' },
        ],
        recommendations: [
          'Ship comparison pages for the 3 "Missing" commercial keywords rated KD <= 25.',
        ],
      };

    case 'rank-tracker':
      return {
        toolId,
        target: normalizeDomain(target),
        country,
        searchEngine,
        generatedAt: now,
        provenance: 'Demo Dataset',
        summaryMetrics: [
          { label: 'Tracked Keywords', value: '48' },
          { label: 'Top 3 Rankings', value: '11 (+3)' },
          { label: 'Top 10 Rankings', value: '29 (+6)' },
          { label: 'Share of Voice', value: '31.4%' },
        ],
        columns: ['Keyword', 'Current Pos', '7d Change', 'Volume', 'Target URL'],
        rows: [
          { Keyword: 'audience intelligence platform', 'Current Pos': 3, '7d Change': '+2', Volume: 6600, 'Target URL': '/platform' },
          { Keyword: 'ai keyword gap analyzer', 'Current Pos': 4, '7d Change': '+4', Volume: 4400, 'Target URL': '/seo/keyword-gap' },
          { Keyword: 'competitor traffic overlap', 'Current Pos': 7, '7d Change': '+1', Volume: 3100, 'Target URL': '/competitors' },
          { Keyword: 'chatgpt brand mention tracker', 'Current Pos': 2, '7d Change': '+5', Volume: 5200, 'Target URL': '/ai-visibility' },
        ],
        recommendations: [
          'Internal link from "/platform" to "/competitors" to push "competitor traffic overlap" into Top 3.',
        ],
      };

    case 'technical-audit':
      return {
        toolId,
        target: normalizeDomain(target),
        country,
        searchEngine,
        generatedAt: now,
        provenance: 'Estimated',
        summaryMetrics: [
          { label: 'Health Score', value: '88 / 100' },
          { label: 'Critical Errors', value: '2' },
          { label: 'Warnings', value: '11' },
          { label: 'Core Web Vitals', value: 'LCP 1.8s (Good)' },
        ],
        columns: ['Check', 'Severity', 'Affected URLs', 'Impact', 'Suggested Fix'],
        rows: [
          { Check: 'Missing canonical on filter query URLs', Severity: 'Error', 'Affected URLs': 14, Impact: 'Index bloat', 'Suggested Fix': 'Add self-referencing canonical tags' },
          { Check: 'Broken internal link (404)', Severity: 'Error', 'Affected URLs': 3, Impact: 'Crawl waste', 'Suggested Fix': 'Update anchor targets or 301 redirect' },
          { Check: 'Missing FAQPage JSON-LD schema', Severity: 'Warning', 'Affected URLs': 22, Impact: 'Lower AI/SERP citations', 'Suggested Fix': 'Inject structured JSON-LD blocks' },
          { Check: 'Uncompressed hero PNG > 400KB', Severity: 'Warning', 'Affected URLs': 6, Impact: 'LCP drag on mobile', 'Suggested Fix': 'Convert to WebP/AVIF with srcset' },
        ],
        recommendations: [
          'Resolve the 2 canonical and 404 errors first, then deploy FAQPage schema across solution pages.',
        ],
      };

    case 'content-explorer':
      return {
        toolId,
        target,
        country,
        searchEngine,
        generatedAt: now,
        provenance: 'Demo Dataset',
        summaryMetrics: [
          { label: 'Indexed Pages Found', value: '1,840' },
          { label: 'Avg. Referring Domains', value: '42' },
          { label: 'Top Format', value: 'Original Data Studies' },
          { label: 'Freshness Window', value: 'Last 90 Days' },
        ],
        columns: ['Article Title', 'Domain', 'Est. Traffic', 'Ref. Domains', 'Published'],
        rows: [
          { 'Article Title': `2026 State of ${target} Benchmarks`, Domain: 'sparktoro.com', 'Est. Traffic': 16400, 'Ref. Domains': 248, Published: '2026-09-12' },
          { 'Article Title': `Zero-Click Search Playbook for ${target}`, Domain: 'ahrefs.com', 'Est. Traffic': 12100, 'Ref. Domains': 190, Published: '2026-10-04' },
          { 'Article Title': `How Buyers Use Reddit Before Purchasing`, Domain: 'demandcurve.com', 'Est. Traffic': 8700, 'Ref. Domains': 112, Published: '2026-10-28' },
        ],
        recommendations: [
          'Pages containing original benchmark numbers earn 4.1x more backlinks than opinion pieces.',
        ],
      };

    case 'content-gap':
      return {
        toolId,
        target: normalizeDomain(target),
        country,
        searchEngine,
        generatedAt: now,
        provenance: 'Demo Dataset',
        summaryMetrics: [
          { label: 'Topic Gaps Identified', value: '18 Clusters' },
          { label: 'High-Priority Briefs', value: '6' },
          { label: 'Competitor Coverage', value: '82%' },
          { label: 'Your Coverage', value: '34%' },
        ],
        columns: ['Topic Cluster', 'Buyer Stage', 'Competitors Covering', 'Est. Monthly Demand', 'Priority'],
        rows: [
          { 'Topic Cluster': 'AI Search Citation Optimization', 'Buyer Stage': 'Consideration', 'Competitors Covering': '4 / 5', 'Est. Monthly Demand': 11400, Priority: 'P1' },
          { 'Topic Cluster': 'Audience Overlap vs Lookalike Ads', 'Buyer Stage': 'Decision', 'Competitors Covering': '3 / 5', 'Est. Monthly Demand': 6800, Priority: 'P1' },
          { 'Topic Cluster': 'Reddit Sentiment Extraction Guide', 'Buyer Stage': 'Awareness', 'Competitors Covering': '3 / 5', 'Est. Monthly Demand': 4900, Priority: 'P2' },
        ],
        recommendations: [
          'Publish P1 Decision-stage comparison assets before expanding Awareness tutorials.',
        ],
      };

    case 'search-intent':
      return {
        toolId,
        target,
        country,
        searchEngine,
        generatedAt: now,
        provenance: 'AI-Inferred',
        summaryMetrics: [
          { label: 'Commercial Intent', value: '44%' },
          { label: 'Informational Intent', value: '36%' },
          { label: 'Transactional Intent', value: '14%' },
          { label: 'Navigational Intent', value: '6%' },
        ],
        columns: ['Keyword Segment', 'Dominant Intent', 'Share %', 'Recommended Content Format', 'CTA Match'],
        rows: [
          { 'Keyword Segment': `${target} software / tools`, 'Dominant Intent': 'Commercial', 'Share %': '44%', 'Recommended Content Format': 'Comparison Matrix + Interactive Demo', 'CTA Match': 'Run Free Research' },
          { 'Keyword Segment': `how to / templates for ${target}`, 'Dominant Intent': 'Informational', 'Share %': '36%', 'Recommended Content Format': 'Step-by-Step Playbook + Checklist', 'CTA Match': 'Download Template' },
          { 'Keyword Segment': `${target} pricing / plans`, 'Dominant Intent': 'Transactional', 'Share %': '14%', 'Recommended Content Format': 'Transparent Pricing & ROI Calculator', 'CTA Match': 'Start Free Plan' },
        ],
        recommendations: [
          'Match page templates to SERP intent—do not push a pricing page on informational "how to" queries.',
        ],
      };

    case 'ai-visibility':
    default:
      return {
        toolId: 'ai-visibility',
        target: normalizeDomain(target),
        country,
        state: cleanState,
        searchEngine: searchEngine === 'Google' ? 'ChatGPT Search · Gemini · Perplexity · Claude' : searchEngine,
        generatedAt: now,
        provenance: 'AI-Inferred',
        summaryMetrics: [
          { label: 'AI Visibility Index', value: '46 / 100', delta: '+8 pts / 30d' },
          { label: 'Brand Citation Rate', value: '29%' },
          { label: 'Top Cited Rival', value: 'sparktoro.com (68%)' },
          { label: 'Open Citation Prompts', value: '14 High-Intent' },
        ],
        columns: ['AI Engine', 'Citation Share %', 'Sentiment', 'Top Prompt Gap', 'Recommended Action'],
        rows: [
          { 'AI Engine': 'Gemini', 'Citation Share %': '34%', Sentiment: 'Positive', 'Top Prompt Gap': 'Best SparkToro + Ahrefs hybrid tools', 'Recommended Action': 'Publish structured comparison schema' },
          { 'AI Engine': 'ChatGPT', 'Citation Share %': '28%', Sentiment: 'Neutral-Positive', 'Top Prompt Gap': 'Free audience research for B2B startups', 'Recommended Action': 'Earn mentions in G2 & Reddit threads' },
          { 'AI Engine': 'Perplexity', 'Citation Share %': '24%', Sentiment: 'Positive', 'Top Prompt Gap': '2026 social platform affinity benchmarks', 'Recommended Action': 'Release open CSV benchmark study' },
          { 'AI Engine': 'Claude', 'Citation Share %': '21%', Sentiment: 'Neutral', 'Top Prompt Gap': 'Privacy-compliant audience research tools', 'Recommended Action': 'Publish API compliance & methodology docs' },
        ],
        recommendations: [
          'AI answer engines heavily cite original benchmark studies, Reddit consensus threads, and transparent pricing tables.',
        ],
      };
  }
}
