import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateAudienceProfile } from '../src/lib/intelligence';
import { ALL_STATES_LABEL, GLOBAL_COUNTRY_LABEL } from '../src/lib/geoAndEngines';
import type {
  AppNotification,
  CopilotConversation,
  DataSourceProvider,
  PlanConfig,
  ResearchProject,
  SavedKeywordList,
  SavedReport,
  UserAccount,
  Workspace,
} from '../src/types';

export interface StoredUser extends UserAccount {
  passwordHash: string;
  verificationCode: string;
  resetToken: string | null;
}

export interface ApiUsageLog {
  id: string;
  userId: string;
  providerId: string;
  endpoint: string;
  status: 'ok' | 'error';
  latencyMs: number;
  message?: string;
  createdAt: string;
}

export interface StoreState {
  adminClaimed: boolean;
  adminPasscodeHash: string | null;
  users: StoredUser[];
  workspaces: Workspace[];
  projects: ResearchProject[];
  reports: SavedReport[];
  conversations: CopilotConversation[];
  competitorWatchlist: Record<string, string[]>;
  trackedKeywords: Record<string, { keyword: string; targetDomain: string; position: number; volume: number }[]>;
  keywordLists: SavedKeywordList[];
  providers: DataSourceProvider[];
  providerSecrets: Record<string, string>;
  plans: PlanConfig[];
  notifications: AppNotification[];
  apiUsageLogs: ApiUsageLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

export function sanitizeUser(user: StoredUser): UserAccount {
  const { passwordHash: _p, verificationCode: _v, resetToken: _r, ...safe } = user;
  return safe;
}

export function createDefaultFreeProviders(now = new Date().toISOString()): DataSourceProvider[] {
  return [
    {
      id: 'google-suggest-free',
      name: 'Google Suggest Autocomplete',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (public live endpoint)',
      usageCount: 18,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Live keyword expansions and long-tail autocomplete phrases directly from Google Suggest.',
    },
    {
      id: 'reddit-free',
      name: 'Reddit Public JSON Search',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (public JSON feed)',
      usageCount: 15,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Live public subreddit threads, community pain points, and audience discussions.',
    },
    {
      id: 'hn-algolia-free',
      name: 'Hacker News Algolia Search',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (open Algolia API)',
      usageCount: 12,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Live tech, SaaS, and founder community stories and comment engagement counts.',
    },
    {
      id: 'wikipedia-free',
      name: 'Wikimedia OpenSearch API',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (open Wikimedia API)',
      usageCount: 10,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Entity topics, reference URLs, and semantic knowledge graph expansions.',
    },
    {
      id: 'duckduckgo-free',
      name: 'DuckDuckGo Instant Answer API',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (public JSON endpoint)',
      usageCount: 7,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Zero-cost topic definitions and related search entity signals.',
    },
    {
      id: 'site-inspector-free',
      name: 'Built-in SSRF-Safe Site & Robots Inspector',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Runs natively on server (no key)',
      usageCount: 9,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Live HTTP status, TTFB latency, meta title/description, H1, canonical, JSON-LD, and robots.txt checks.',
    },
    {
      id: 'pagespeed-free',
      name: 'Google PageSpeed Insights v5 / Lighthouse',
      category: 'Free Official Quota',
      costLabel: 'Free Quota · Optional Key',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Optional free Google API Key',
      usageCount: 6,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Core Web Vitals, mobile performance, and Lighthouse SEO audit scores.',
    },
    {
      id: 'youtube-free',
      name: 'YouTube Data API v3 (Free Quota)',
      category: 'Free Official Quota',
      costLabel: 'Free Quota · Optional Key',
      requiresKey: true,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Free Google Cloud YouTube API Key',
      usageCount: 11,
      errorCount: 0,
      status: 'Ready (Free)',
      lastTestedAt: now,
      notes: '10,000 free units/day for live YouTube channels, videos, and creator discovery.',
    },
    {
      id: 'gsc-free',
      name: 'Google Search Console API',
      category: 'Free Official Quota',
      costLabel: '100% Free Google Sign-In',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Sign in with Google (read-only Search Console)',
      usageCount: 8,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Verified first-party impressions, clicks, CTR, and query positions via Google Sign-In.',
    },
    {
      id: 'searxng-free',
      name: 'SearXNG Metasearch Instance',
      category: 'Open-Source Self-Hosted',
      costLabel: 'Free · Self-Hosted',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Self-Hosted SearXNG URL (https://...)',
      usageCount: 5,
      errorCount: 0,
      status: 'Ready (Free)',
      lastTestedAt: now,
      notes: 'Privacy-preserving open-source SERP JSON execution with zero per-query fees.',
    },
    {
      id: 'librecrawl-free',
      name: 'Built-in Sitemap & Broken-Link Crawler',
      category: 'Open-Source Self-Hosted',
      costLabel: 'Free · Built-in SSRF-Safe',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Runs natively on server (optional custom worker URL)',
      usageCount: 4,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Live sitemap.xml discovery, internal link checks, and broken 4xx/5xx URL detection.',
    },
    {
      id: 'oss-analytics-free',
      name: 'Umami / PostHog Visitor Analytics',
      category: 'Open-Source Self-Hosted',
      costLabel: 'Free · Self-Hosted / Cloud Free',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'umami|https://host|siteId|token or posthog|https://us.posthog.com|projId|key',
      usageCount: 0,
      errorCount: 0,
      status: 'Ready (Free)',
      lastTestedAt: now,
      notes: 'Live 30-day visitors, pageviews, and referring domains for Audience Engine Website Visitation.',
    },
    {
      id: 'ddg-ac-free',
      name: 'DuckDuckGo Autocomplete Feed',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (public autocomplete JSON)',
      usageCount: 6,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Expands Questions, Prepositions, and Comparison keyword ideas at $0 cost.',
    },
    {
      id: 'openpagerank-free',
      name: 'Open PageRank API (Domain Authority)',
      category: 'Free Official Quota',
      costLabel: 'Free Quota · Official Free Key',
      requiresKey: true,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Free Open PageRank Key (10K req/hr)',
      usageCount: 3,
      errorCount: 0,
      status: 'Ready (Free)',
      lastTestedAt: now,
      notes: '10,000 free req/hr for real 0-100 Domain Authority scores on SERP & Backlink tables (Tranco fallback when blank).',
    },
    {
      id: 'brave-search-free',
      name: 'Brave Search Web API (Free Data Tier)',
      category: 'Free Official Quota',
      costLabel: 'Free Quota · 2,000 queries/mo',
      requiresKey: true,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Free Brave Search Subscription Token',
      usageCount: 2,
      errorCount: 0,
      status: 'Ready (Free)',
      lastTestedAt: now,
      notes: '2,000 free live SERP queries/month for independent organic web results and content ideas.',
    },
    {
      id: 'serper-free',
      name: 'Serper.dev Google SERP API (Free Starter)',
      category: 'Free Official Quota',
      costLabel: 'Free Starter · 2,500 queries',
      requiresKey: true,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Free Serper.dev API Key',
      usageCount: 2,
      errorCount: 0,
      status: 'Ready (Free)',
      lastTestedAt: now,
      notes: '2,500 free Google SERP queries including Organic Results, Answer Box, and People Also Ask.',
    },
    {
      id: 'firecrawl-oss',
      name: 'Firecrawl / Crawl4AI Self-Hosted',
      category: 'Open-Source Self-Hosted',
      costLabel: 'Free · Self-Hosted',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Self-Hosted Firecrawl URL (https://...)',
      usageCount: 1,
      errorCount: 0,
      status: 'Ready (Free)',
      lastTestedAt: now,
      notes: 'Open-source page markdown & content extraction worker with SSRF protection.',
    },
    {
      id: 'wikimedia-pageviews-free',
      name: 'Wikimedia Pageviews REST API',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (Wikimedia REST v1)',
      usageCount: 4,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Real 6-month Wikipedia monthly reader demand series to shape keyword trend curves.',
    },
    {
      id: 'google-trends-rss-free',
      name: 'Google Trends Public RSS Feed',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (Google Trends RSS)',
      usageCount: 5,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Live country-specific trending search spikes and breakout topics.',
    },
    {
      id: 'commoncrawl-free',
      name: 'Common Crawl Open Web Index (CDX)',
      category: 'Free No-Key Live API',
      costLabel: 'Free · Open Web Index',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (Common Crawl CDX)',
      usageCount: 3,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Real open-web indexed URLs and crawl footprints for Backlink Explorer & Competitor Matrix.',
    },
    {
      id: 'openalex-free',
      name: 'OpenAlex Open Research Citations API',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (OpenAlex Works API)',
      usageCount: 2,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Real peer-reviewed studies and citation counts for authoritative AI Overview & Content Ideas.',
    },
    {
      id: 'github-search-free',
      name: 'GitHub Public Repositories Search',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (GitHub REST Search)',
      usageCount: 2,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Live open-source software trends, star counts, and developer ecosystem signals.',
    },
    {
      id: 'ssl-crtsh-free',
      name: 'Certificate Transparency (crt.sh) & TLS Inspector',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (TLS + crt.sh JSON)',
      usageCount: 2,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Live SSL/TLS certificate expiry checks and crt.sh subdomain discovery for SEO Audits & Competitors.',
    },
    {
      id: 'wikidata-sparql-free',
      name: 'Wikipedia / Wikidata SPARQL Entity Graph',
      category: 'Free No-Key Live API',
      costLabel: 'Free · No Key Needed',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'No key required (Wikidata SPARQL API)',
      usageCount: 2,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Structured brand & topic knowledge graph entities, official websites, industries, and inception years.',
    },
    {
      id: 'rss-news-free',
      name: 'Industry News RSS / Atom & Feedly Aggregator',
      category: 'Free No-Key Live API',
      costLabel: 'Free · Optional Custom Feed URL',
      requiresKey: false,
      enabled: true,
      mode: 'live-free',
      hasCredential: false,
      credentialLabel: 'Optional custom RSS / Atom / Feedly public feed URL (https://...)',
      usageCount: 2,
      errorCount: 0,
      status: 'Active (Free Live)',
      lastTestedAt: now,
      notes: 'Real-time industry news headlines from public news RSS feeds plus optional custom RSS/Atom URLs.',
    },
  ];
}

function createInitialStore(): StoreState {
  const demoUserId = 'usr_demo_01';
  const demoWorkspaceId = 'ws_demo_01';
  const defaultQuery = 'B2B SaaS Growth Leaders';
  const defaultIntel = generateAudienceProfile(
    defaultQuery,
    GLOBAL_COUNTRY_LABEL,
    'English',
    'B2B SaaS & Marketing',
    ALL_STATES_LABEL,
    'All Engines'
  );
  const now = new Date().toISOString();

  const defaultPlans: PlanConfig[] = [
    {
      id: 'free',
      name: 'Free',
      audienceTag: 'For solo marketers & validation',
      monthlyPriceUsd: 0,
      monthlyCredits: 25,
      maxCompetitors: 2,
      maxWorkspaces: 1,
      aiMessagesPerMonth: 20,
      whiteLabelReports: false,
      highlights: ['25 research credits / mo', '9-module audience preview', '20 AI Copilot queries', 'CSV exports'],
    },
    {
      id: 'starter',
      name: 'Starter',
      audienceTag: 'For in-house growth teams',
      monthlyPriceUsd: 49,
      monthlyCredits: 150,
      maxCompetitors: 3,
      maxWorkspaces: 2,
      aiMessagesPerMonth: 150,
      whiteLabelReports: false,
      highlights: ['150 research credits / mo', 'Full Keyword & SERP suite', '3-competitor benchmarking', '150 AI Copilot queries'],
    },
    {
      id: 'pro',
      name: 'Pro',
      audienceTag: 'For scaling marketing leads',
      monthlyPriceUsd: 129,
      monthlyCredits: 600,
      maxCompetitors: 5,
      maxWorkspaces: 5,
      aiMessagesPerMonth: 600,
      whiteLabelReports: true,
      highlights: ['600 research credits / mo', '5-competitor deep matrix', 'AI Search Visibility tracking', 'PDF & Excel report exports'],
    },
    {
      id: 'agency',
      name: 'Agency',
      audienceTag: 'For multi-client agencies',
      monthlyPriceUsd: 299,
      monthlyCredits: 2500,
      maxCompetitors: 5,
      maxWorkspaces: 25,
      aiMessagesPerMonth: 2500,
      whiteLabelReports: true,
      highlights: ['2,500 research credits / mo', '25 client workspaces', 'Branded white-label reports', 'Custom provider limits'],
    },
  ];

  const defaultProviders: DataSourceProvider[] = createDefaultFreeProviders(now);

  const demoProjectId = 'proj_demo_01';

  return {
    adminClaimed: false,
    adminPasscodeHash: null,
    users: [
      {
        id: demoUserId,
        name: 'Maya Lin',
        email: 'maya@growthstudio.demo',
        role: 'user',
        emailVerified: true,
        subscriptionPlan: 'pro',
        creditsUsed: 42,
        workspaceId: demoWorkspaceId,
        brandName: 'AudiencePulse AI',
        passwordHash: '',
        verificationCode: '482910',
        resetToken: null,
        onboarding: {
          businessOrWebsite: 'https://growthstudio.demo',
          industry: 'B2B SaaS & Marketing',
          targetAudience: 'B2B SaaS Founders & Heads of Growth',
          targetCountries: ['United States', 'United Kingdom', 'Canada'],
          preferredLanguage: 'English',
          objectives: ['Discover Audience Channels', 'Find Low-KD Keywords', 'Improve AI Search Visibility'],
          completed: true,
        },
        createdAt: now,
      },
    ],
    workspaces: [
      {
        id: demoWorkspaceId,
        name: 'Growth Studio HQ',
        organisationName: 'Growth Studio',
        ownerId: demoUserId,
        industry: 'B2B SaaS & Marketing',
        createdAt: now,
      },
      {
        id: 'ws_demo_client_02',
        name: 'Northstar Fintech (Client)',
        organisationName: 'Growth Studio',
        ownerId: demoUserId,
        industry: 'Fintech & Payments',
        createdAt: now,
      },
    ],
    projects: [
      {
        id: demoProjectId,
        userId: demoUserId,
        workspaceId: demoWorkspaceId,
        title: 'B2B SaaS Growth Leaders (Global)',
        query: defaultQuery,
        country: GLOBAL_COUNTRY_LABEL,
        state: ALL_STATES_LABEL,
        searchEngine: 'All Engines',
        language: 'English',
        industry: 'B2B SaaS & Marketing',
        dataMode: 'Demonstration Dataset',
        intelligence: defaultIntel,
        createdAt: now,
        updatedAt: now,
      },
    ],
    reports: [
      {
        id: 'rep_demo_01',
        userId: demoUserId,
        workspaceId: demoWorkspaceId,
        projectId: demoProjectId,
        title: 'Q4 Audience & AI Search Intelligence Brief',
        brandName: 'AudiencePulse AI',
        whiteLabel: false,
        shareSlug: 'q4-audience-ai-brief',
        confidenceLabel: 'Demonstration Dataset + Observed Public Signals',
        executiveSummary:
          'Target B2B SaaS Growth Leaders over-index strongly on LinkedIn (2.1x average) and Reddit (2.08x average) while showing rising discovery behaviour in Gemini and ChatGPT. Commercial low-difficulty gaps around AI search visibility offer immediate organic upside.',
        marketingRecommendations: [
          'Shift 35% of awareness content toward LinkedIn founder breakdowns and YouTube deep-dive workflows.',
          'Publish benchmark comparison tables to capture Gemini and Perplexity citations.',
          'Target KD < 25 community-validated pain point keywords discovered in r/marketing and r/SEO.',
        ],
        createdAt: now,
      },
    ],
    conversations: [
      {
        id: 'conv_demo_01',
        userId: demoUserId,
        projectId: demoProjectId,
        title: 'Q4 Channel & Keyword Strategy',
        messages: [
          {
            id: 'msg_welcome_01',
            role: 'assistant',
            mode: 'Research Planner',
            content:
              'I have loaded your active research project "B2B SaaS Growth Leaders (US)". Ask me to identify low-competition keywords, build a 30-day channel plan, compare competitors, or inspect Reddit buyer objections.',
            timestamp: now,
            citations: [
              { source: 'AudiencePulse 9-Module Snapshot', provenance: 'Demo Dataset' },
            ],
            recommendedNextActions: [
              {
                label: 'Explore YouTube & LinkedIn Audience Gaps',
                targetTab: 'audience',
                prompt: 'Which YouTube channels and LinkedIn creators should we partner with first?',
              },
              {
                label: 'Open 12-Tool SEO Explorer',
                targetTab: 'seo',
                prompt: 'Prioritise the top 5 low-KD commercial keywords from this project.',
              },
            ],
            suggestedFollowUps: [
              'Build a 30-day marketing plan for B2B SaaS Growth Leaders',
              'What customer pain points appear most in Reddit communities?',
              'How can we increase brand citations in Gemini and ChatGPT?',
            ],
          },
        ],
        updatedAt: now,
      },
    ],
    competitorWatchlist: {
      [demoUserId]: ['sparktoro.com', 'ahrefs.com', 'semrush.com'],
    },
    trackedKeywords: {
      [demoUserId]: [
        { keyword: 'audience intelligence platform', targetDomain: 'growthstudio.demo', position: 3, volume: 6600 },
        { keyword: 'ai search visibility tracker', targetDomain: 'growthstudio.demo', position: 5, volume: 4100 },
        { keyword: 'reddit customer research tool', targetDomain: 'growthstudio.demo', position: 8, volume: 2100 },
      ],
    },
    keywordLists: [
      {
        id: 'kwl_demo_01',
        userId: demoUserId,
        name: 'High-Intent SEO & AI Targets',
        keywords: [
          {
            keyword: 'audience intelligence platform',
            volume: 6600,
            difficulty: 28,
            cpc: 5.4,
            currencySymbol: '$',
            intent: 'Commercial',
            country: 'United States',
            language: 'English',
            addedAt: now,
          },
          {
            keyword: 'ai search visibility tracker',
            volume: 4100,
            difficulty: 19,
            cpc: 4.8,
            currencySymbol: '$',
            intent: 'Commercial',
            country: 'United States',
            language: 'English',
            addedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    providers: defaultProviders,
    providerSecrets: {},
    plans: defaultPlans,
    notifications: [
      {
        id: 'notif_01',
        userId: demoUserId,
        title: 'Research snapshot ready',
        detail: 'B2B SaaS Growth Leaders (US) across all 9 audience modules is ready to inspect.',
        read: false,
        createdAt: now,
      },
      {
        id: 'notif_02',
        userId: demoUserId,
        title: 'AI Search Visibility opportunity',
        detail: '14 high-intent prompts identified where competitors are cited ahead of your domain.',
        read: false,
        createdAt: now,
      },
    ],
    apiUsageLogs: [
      {
        id: 'log_01',
        userId: demoUserId,
        providerId: 'google-suggest-free',
        endpoint: '/complete/search',
        status: 'ok',
        latencyMs: 92,
        message: 'Free Google Suggest adapter initialized',
        createdAt: now,
      },
    ],
  };
}

let cachedStore: StoreState | null = null;

function needsFreeProviderMigration(providers?: DataSourceProvider[]): boolean {
  if (!Array.isArray(providers) || providers.length === 0) return true;
  const legacyPaidIds = new Set(['semrush-api', 'dataforseo', 'similarweb-api', 'google-ads', 'x-api']);
  const legacyGsc = providers.some((p) => p.id === 'gsc-free' && p.requiresKey);
  return legacyGsc || providers.some((p) => legacyPaidIds.has(p.id) || !('costLabel' in p));
}

export function readStore(): StoreState {
  if (cachedStore) return cachedStore;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial = createInitialStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    cachedStore = initial;
    return cachedStore;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoreState;
    let dirty = false;
    if (needsFreeProviderMigration(parsed.providers)) {
      parsed.providers = createDefaultFreeProviders(new Date().toISOString());
      dirty = true;
    } else {
      const defaults = createDefaultFreeProviders(new Date().toISOString());
      const existingIds = new Set(parsed.providers.map((p) => p.id));
      for (const def of defaults) {
        if (!existingIds.has(def.id)) {
          parsed.providers.push(def);
          dirty = true;
        } else if (def.id === 'librecrawl-free' || def.id === 'oss-analytics-free') {
          const existing = parsed.providers.find((p) => p.id === def.id);
          if (existing && existing.mode === 'demo') {
            existing.name = def.name;
            existing.mode = 'live-free';
            existing.enabled = def.enabled;
            existing.requiresKey = def.requiresKey;
            existing.credentialLabel = def.credentialLabel;
            existing.status = def.status;
            existing.costLabel = def.costLabel;
            existing.notes = def.notes;
            dirty = true;
          }
        }
      }
    }
    if (!Array.isArray(parsed.keywordLists)) {
      parsed.keywordLists = createInitialStore().keywordLists;
      dirty = true;
    }
    const legacyDemoProj = parsed.projects?.find(
      (p) => p.id === 'proj_demo_01' && p.title === 'B2B SaaS Growth Leaders (US)' && !p.searchEngine
    );
    if (legacyDemoProj) {
      legacyDemoProj.country = GLOBAL_COUNTRY_LABEL;
      legacyDemoProj.state = ALL_STATES_LABEL;
      legacyDemoProj.searchEngine = 'All Engines';
      legacyDemoProj.title = 'B2B SaaS Growth Leaders (Global)';
      legacyDemoProj.intelligence = generateAudienceProfile(
        legacyDemoProj.query,
        GLOBAL_COUNTRY_LABEL,
        legacyDemoProj.language,
        legacyDemoProj.industry,
        ALL_STATES_LABEL,
        'All Engines'
      );
      dirty = true;
    }
    if (dirty) {
      writeStore(parsed);
    }
    cachedStore = parsed;
    return cachedStore;
  } catch {
    const fallback = createInitialStore();
    cachedStore = fallback;
    return cachedStore;
  }
}

export function writeStore(state: StoreState): void {
  cachedStore = state;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}
