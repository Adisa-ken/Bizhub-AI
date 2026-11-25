export type DataProvenance = 'Demo Dataset' | 'Estimated' | 'Observed' | 'AI-Inferred';

export type SubscriptionPlanId = 'free' | 'starter' | 'pro' | 'agency';

export type UserRole = 'user' | 'admin';

export interface OnboardingProfile {
  businessOrWebsite: string;
  industry: string;
  targetAudience: string;
  targetCountries: string[];
  preferredLanguage: string;
  objectives: string[];
  completed: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  subscriptionPlan: SubscriptionPlanId;
  creditsUsed: number;
  workspaceId: string;
  brandName: string;
  onboarding: OnboardingProfile;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  organisationName: string;
  ownerId: string;
  industry: string;
  createdAt: string;
}

export interface SocialNetworkMetric {
  platform: string;
  audiencePct: number;
  marketAvgPct: number;
  indexMultiplier: number;
  rank: number;
  delta30d: number;
  recommended: boolean;
  historicalSeries: { month: string; audiencePct: number; avgPct: number }[];
  provenance: DataProvenance;
}

export interface DemographicBreakdown {
  label: string;
  audiencePct: number;
  marketAvgPct: number;
  category: 'age' | 'gender' | 'country' | 'state' | 'city' | 'language' | 'education' | 'occupation' | 'income' | 'household';
  provenance: DataProvenance;
}

export interface SearchAiPlatformMetric {
  platform: string;
  type: 'Traditional Search' | 'AI Search';
  audienceAdoptionPct: number;
  visibilityScore: number;
  brandMentionsEst: number;
  competitorMentionsEst: number;
  topQuestions: string[];
  citationOpportunities: string[];
  history: { month: string; visibility: number }[];
  provenance: DataProvenance;
}

export interface WebsiteVisitationEntry {
  domain: string;
  category: string;
  monthlyVisitsEst: number;
  overlapPct: number;
  primarySource: 'Organic Search' | 'Direct' | 'Social' | 'Referral' | 'Paid';
  topCountry: string;
  isCompetitor: boolean;
  provenance: DataProvenance;
}

export interface KeywordRecord {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpcUsd: number;
  competition: 'Low' | 'Medium' | 'High';
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  cluster: string;
  isQuestion: boolean;
  isTrending: boolean;
  trend12m: number[];
  gapOpportunityScore: number;
  country: string;
  language: string;
  searchEngine: string;
  provenance: DataProvenance;
}

export interface MediaConsumptionItem {
  title: string;
  mediaType: 'Website' | 'Blog' | 'News Publication' | 'Podcast' | 'YouTube Channel' | 'Online Magazine' | 'Industry Publication';
  url: string;
  audienceAffinityPct: number;
  topicFocus: string;
  frequency: string;
  provenance: DataProvenance;
}

export interface RedditCommunityEntry {
  subreddit: string;
  subscribersEst: string;
  audienceMatchPct: number;
  coreTopics: string[];
  popularDiscussion: string;
  faqQuestion: string;
  customerComplaint: string;
  trendDirection: 'Rising' | 'Steady' | 'Peak';
  provenance: DataProvenance;
}

export interface SocialAccountFollowed {
  name: string;
  handle: string;
  platform: 'YouTube' | 'LinkedIn' | 'X' | 'Instagram' | 'TikTok' | 'Substack';
  profileUrl: string;
  industry: string;
  relevanceScore: number;
  followersPublic: string;
  engagementRatePct: number;
  collaborationIdea: string;
  observationKind: 'Observed Public Profile' | 'AI-Inferred Recommendation';
}

export interface TopicOfInterest {
  topic: string;
  category: 'Buying Interest' | 'Pain Point' | 'Hobby' | 'Industry Discussion' | 'Trending Subject';
  cluster: string;
  interestPct: number;
  growthPct: number;
  relatedQuestion: string;
  contentOpportunity: string;
  provenance: DataProvenance;
}

export interface AudienceIntelligencePayload {
  query: string;
  country: string;
  state?: string;
  searchEngine?: string;
  language: string;
  industry: string;
  generatedAt: string;
  sampleModeNotice: string;
  summary: {
    estimatedAudienceSize: string;
    topPlatform: string;
    topPlatformAffinity: number;
    avgKeywordOpportunity: number;
    aiVisibilityIndex: number;
  };
  socialNetworks: SocialNetworkMetric[];
  demographics: DemographicBreakdown[];
  searchAndAi: SearchAiPlatformMetric[];
  websiteVisitation: WebsiteVisitationEntry[];
  keywords: KeywordRecord[];
  mediaConsumption: MediaConsumptionItem[];
  redditCommunities: RedditCommunityEntry[];
  socialAccounts: SocialAccountFollowed[];
  topicsOfInterest: TopicOfInterest[];
}

export interface ResearchProject {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  query: string;
  country: string;
  state?: string;
  searchEngine?: string;
  language: string;
  industry: string;
  dataMode: 'Free Live + Demo Hybrid' | 'Demonstration Dataset' | 'Connected Provider';
  intelligence: AudienceIntelligencePayload;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorSnapshot {
  domain: string;
  organicTrafficEst: number;
  domainAuthority: number;
  paidTrafficEst: number;
  backlinksEst: number;
  referringDomainsEst: number;
  audienceOverlapPct: number;
  topKeywords: { keyword: string; position: number; volume: number; url: string }[];
  bestPages: { path: string; estTraffic: number; backlinks: number }[];
  socialPresence: { platform: string; followersEst: string; activityLevel: string }[];
  marketOpportunities: string[];
  provenance: DataProvenance;
  liveSignals?: {
    statusCode: number;
    responseMs: number;
    hasJsonLd: boolean;
    commonCrawlPages: number;
    hnMentions: number;
    authoritySource: string;
    sslValid?: boolean;
    sslExpiryDays?: number;
    sslIssuer?: string;
    subdomainsCount?: number;
    sampleSubdomains?: string[];
  };
}

export type SeoToolId =
  | 'keyword-explorer'
  | 'serp-analyzer'
  | 'website-explorer'
  | 'backlink-explorer'
  | 'competitor-research'
  | 'keyword-gap'
  | 'rank-tracker'
  | 'technical-audit'
  | 'content-explorer'
  | 'content-gap'
  | 'search-intent'
  | 'ai-visibility';

export interface SeoToolResult {
  toolId: SeoToolId;
  target: string;
  country: string;
  state?: string;
  searchEngine: string;
  generatedAt: string;
  provenance: DataProvenance;
  summaryMetrics: { label: string; value: string; delta?: string }[];
  columns: string[];
  rows: Record<string, string | number>[];
  recommendations: string[];
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  timestamp: string;
  citations?: { source: string; provenance: DataProvenance }[];
  recommendedNextActions?: { label: string; targetTab: string; prompt?: string }[];
  suggestedFollowUps?: string[];
  isError?: boolean;
}

export interface CopilotConversation {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  messages: CopilotMessage[];
  updatedAt: string;
}

export interface SavedReport {
  id: string;
  userId: string;
  workspaceId: string;
  projectId: string;
  title: string;
  brandName: string;
  whiteLabel: boolean;
  shareSlug: string;
  confidenceLabel: string;
  executiveSummary: string;
  marketingRecommendations: string[];
  createdAt: string;
}

export interface DataSourceProvider {
  id: string;
  name: string;
  category: 'Free No-Key Live API' | 'Free Official Quota' | 'Open-Source Self-Hosted';
  costLabel: string;
  requiresKey: boolean;
  enabled: boolean;
  mode: 'live-free' | 'demo';
  hasCredential: boolean;
  credentialLabel: string;
  usageCount: number;
  errorCount: number;
  status: 'Active (Free Live)' | 'Ready (Free)' | 'Connected' | 'Disabled';
  lastTestedAt: string | null;
  notes: string;
}

export interface PlanConfig {
  id: SubscriptionPlanId;
  name: string;
  audienceTag: string;
  monthlyPriceUsd: number;
  monthlyCredits: number;
  maxCompetitors: number;
  maxWorkspaces: number;
  aiMessagesPerMonth: number;
  whiteLabelReports: boolean;
  highlights: string[];
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  detail: string;
  read: boolean;
  createdAt: string;
}

export type KeywordIdeaCategory = 'autocomplete' | 'questions' | 'prepositions' | 'comparisons';

export interface KeywordIdeaItem {
  keyword: string;
  category: KeywordIdeaCategory;
  volume: number;
  difficulty: number;
  paidDifficulty?: number;
  cpc: number;
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  source: string;
  provenance: DataProvenance;
}

export interface BulkKeywordRow {
  keyword: string;
  volume: number;
  difficulty: number;
  paidDifficulty?: number;
  cpc: number;
  currencySymbol: string;
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  serpFeatures: string[];
  topPagesAvgBacklinks: number;
  noClickPct: number;
  provenance: DataProvenance;
}

export interface AiPromptIdeaItem {
  id: string;
  prompt: string;
  platform: 'ChatGPT' | 'Gemini';
  language: string;
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  answer?: string;
  brandsMentioned?: string[];
  sources?: { title: string; url: string }[];
  loading?: boolean;
  error?: string;
}

export interface AiOverviewSourceItem {
  rank: number;
  domain: string;
  title: string;
  url: string;
  snippet: string;
}

export interface BrandMentionItem {
  brand: string;
  domain: string;
  mentions: number;
  sentiment: 'Positive' | 'Neutral' | 'Mixed';
}

export interface SerpResultItem {
  position: number;
  title: string;
  url: string;
  domain: string;
  backlinks: number;
  visits: number;
  authority: number;
  shares: number;
  provenance: DataProvenance;
}

export interface ContentIdeaItem {
  title: string;
  url: string;
  domain: string;
  estVisits: number;
  backlinks: number;
  socialShares: number;
  source: string;
  provenance: DataProvenance;
}

export interface SavedKeywordItem {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  currencySymbol: string;
  intent: string;
  country: string;
  language: string;
  addedAt: string;
}

export interface SavedKeywordList {
  id: string;
  userId: string;
  name: string;
  keywords: SavedKeywordItem[];
  createdAt: string;
  updatedAt: string;
}

export interface UbersuggestOverviewPayload {
  keyword: string;
  country: string;
  state: string;
  language: string;
  searchEngine: string;
  generatedAt: string;
  provenanceSummary: string;
  liveSourcesUsed: string[];
  seoDifficulty: number;
  seoDifficultyLabel: 'Easy' | 'Low' | 'Medium' | 'High';
  paidDifficulty?: number;
  searchIntent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  cpcValue: number;
  cpcCurrencyCode: string;
  cpcCurrencySymbol: string;
  cpcCompetitiveness: 'Low' | 'Medium' | 'High';
  serpFeaturesCount: number;
  serpFeaturesList: string[];
  topPagesAvgBacklinks: number;
  monthlyVolumeTotal: number;
  deviceSplit: {
    desktopPct: number;
    mobilePct: number;
  };
  volumeHistory: {
    month: string;
    total: number;
    desktop: number;
    mobile: number;
  }[];
  aiSummary: string;
  aiOverview: string;
  brandsMentioned: BrandMentionItem[];
  topAiSources: AiOverviewSourceItem[];
  promptsIntent: {
    informationalPct: number;
    commercialPct: number;
    transactionalPct: number;
    navigationalPct: number;
  };
  searchIntentBreakdown: {
    informationalPct: number;
    commercialPct: number;
    transactionalPct: number;
    navigationalPct: number;
  };
  clickBehavior: {
    organicClicksPct: number;
    paidClicksPct: number;
    noClickPct: number;
  };
  aiPromptIdeas: AiPromptIdeaItem[];
  keywordIdeas: Record<KeywordIdeaCategory, KeywordIdeaItem[]>;
  audienceAge: { bracket: string; pct: number }[];
  searchResults: SerpResultItem[];
  contentIdeas: ContentIdeaItem[];
  trendingNow?: TrendingSearchTopic[];
  wikimediaPageviewsTotal?: number;
  faqJsonLdSnippet?: string;
  entityGraph?: BrandEntityNode[];
  industryNews?: IndustryNewsItem[];
}

export interface TrendingSearchTopic {
  title: string;
  approxTraffic: string;
  country: string;
  relatedNewsTitle?: string;
  url?: string;
}

export interface BrandEntityNode {
  qid: string;
  label: string;
  description: string;
  officialWebsite?: string;
  industry?: string;
  inception?: string;
  wikidataUrl: string;
}

export interface IndustryNewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
}

export interface OssVisitorAnalyticsSnapshot {
  configured: boolean;
  providerName?: 'Umami' | 'PostHog';
  visitors30d?: number;
  pageviews30d?: number;
  bounces30d?: number;
  topReferrers?: { domain: string; visitors: number }[];
  message?: string;
}

