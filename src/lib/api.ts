import type {
  AppNotification,
  BrandMentionItem,
  BulkKeywordRow,
  CompetitorSnapshot,
  CopilotConversation,
  CopilotMessage,
  DataSourceProvider,
  IndustryNewsItem,
  OnboardingProfile,
  OssVisitorAnalyticsSnapshot,
  PlanConfig,
  ResearchProject,
  SavedKeywordItem,
  SavedKeywordList,
  SavedReport,
  SeoToolId,
  SeoToolResult,
  SubscriptionPlanId,
  TrendingSearchTopic,
  UbersuggestOverviewPayload,
  UserAccount,
  Workspace,
  AiOverviewSourceItem,
} from '../types';

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    const errObj = data as { error?: string };
    throw new Error(errObj?.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export interface DashboardSummaryResponse {
  user: UserAccount;
  plan: PlanConfig;
  plans: PlanConfig[];
  workspaces: Workspace[];
  projects: ResearchProject[];
  reports: SavedReport[];
  watchlist: string[];
  trackedKeywords: { keyword: string; targetDomain: string; position: number; volume: number }[];
  notifications: AppNotification[];
}

export const api = {
  getPlans: () => apiFetch<{ plans: PlanConfig[] }>('/api/plans'),
  getPublicReport: (slug: string) =>
    apiFetch<{ report: SavedReport; project?: ResearchProject }>(`/api/reports/public/${encodeURIComponent(slug)}`),

  demoLogin: () => apiFetch<{ token: string; user: UserAccount }>('/api/auth/demo', { method: 'POST' }),
  register: (payload: { name: string; email: string; password: string }) =>
    apiFetch<{ token: string; user: UserAccount; previewVerificationCode: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    apiFetch<{ token: string; user: UserAccount }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  googleSignIn: (payload: { email: string; name: string }) =>
    apiFetch<{ token: string; user: UserAccount }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyEmail: (code: string) =>
    apiFetch<{ user: UserAccount }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  recoverPassword: (payload: { email: string; resetCode?: string; newPassword?: string }) =>
    apiFetch<{ message: string; previewResetCode?: string }>('/api/auth/recover-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  saveOnboarding: (payload: Partial<OnboardingProfile>) =>
    apiFetch<{ user: UserAccount }>('/api/auth/onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProfile: (payload: {
    name?: string;
    brandName?: string;
    workspaceId?: string;
    subscriptionPlan?: SubscriptionPlanId;
  }) =>
    apiFetch<{ user: UserAccount }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getDashboardSummary: () => apiFetch<DashboardSummaryResponse>('/api/dashboard/summary'),

  createWorkspace: (payload: { name: string; organisationName: string; industry: string }) =>
    apiFetch<{ workspace: Workspace; user: UserAccount }>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createProject: (payload: {
    query: string;
    title?: string;
    country: string;
    state?: string;
    searchEngine?: string;
    language: string;
    industry: string;
  }) =>
    apiFetch<{ project: ResearchProject; user: UserAccount }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProject: (
    id: string,
    payload: {
      query?: string;
      country?: string;
      state?: string;
      searchEngine?: string;
      language?: string;
      industry?: string;
    }
  ) =>
    apiFetch<{ project: ResearchProject }>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteProject: (id: string) => apiFetch<{ deleted: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),

  runSeoTool: (payload: {
    toolId: SeoToolId;
    target: string;
    country: string;
    state?: string;
    searchEngine: string;
  }) =>
    apiFetch<{ result: SeoToolResult; user: UserAccount }>('/api/seo/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getUbersuggestOverview: (payload: {
    keyword: string;
    country: string;
    state?: string;
    language: string;
    searchEngine: string;
  }) =>
    apiFetch<{ overview: UbersuggestOverviewPayload; user: UserAccount }>('/api/ubersuggest/overview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getUbersuggestAiResponse: (payload: {
    promptText: string;
    keyword: string;
    language: string;
    country: string;
    state?: string;
  }) =>
    apiFetch<{
      answer: string;
      brandsMentioned: string[];
      sources: { title: string; url: string }[];
    }>('/api/ubersuggest/ai-response', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateUbersuggestAiOverview: (payload: {
    keyword: string;
    language: string;
    country: string;
    state?: string;
  }) =>
    apiFetch<{
      aiSummary: string;
      aiOverview: string;
      brandsMentioned: BrandMentionItem[];
      topAiSources: AiOverviewSourceItem[];
    }>('/api/ubersuggest/ai-overview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLiveTrends: (country: string) =>
    apiFetch<{ country: string; iso: string; trends: TrendingSearchTopic[] }>(
      `/api/trends/live?country=${encodeURIComponent(country)}`
    ),

  getLiveNews: (query: string, country: string, language: string) =>
    apiFetch<{ query: string; country: string; news: IndustryNewsItem[] }>(
      `/api/news/live?q=${encodeURIComponent(query)}&country=${encodeURIComponent(country)}&language=${encodeURIComponent(language)}`
    ),

  getLiveOssAnalytics: () => apiFetch<OssVisitorAnalyticsSnapshot>('/api/analytics/live'),

  runBulkKeywordAnalysis: (payload: {
    rawKeywords: string;
    country: string;
    state?: string;
    language: string;
  }) =>
    apiFetch<{ rows: BulkKeywordRow[]; count: number; user: UserAccount }>('/api/seo/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getKeywordLists: () => apiFetch<{ lists: SavedKeywordList[] }>('/api/keyword-lists'),
  createKeywordList: (name: string) =>
    apiFetch<{ list: SavedKeywordList }>('/api/keyword-lists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteKeywordList: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/keyword-lists/${id}`, { method: 'DELETE' }),
  addKeywordToList: (listId: string, item: Omit<SavedKeywordItem, 'addedAt'>) =>
    apiFetch<{ list: SavedKeywordList }>(`/api/keyword-lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  removeKeywordFromList: (listId: string, keyword: string) =>
    apiFetch<{ list: SavedKeywordList }>(
      `/api/keyword-lists/${listId}/items?keyword=${encodeURIComponent(keyword)}`,
      { method: 'DELETE' }
    ),

  compareCompetitors: (payload: { domains: string[]; contextQuery?: string }) =>
    apiFetch<{ comparison: CompetitorSnapshot[]; maxAllowed: number }>('/api/competitors/compare', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getConversations: () => apiFetch<{ conversations: CopilotConversation[] }>('/api/copilot/conversations'),
  sendCopilotMessage: (payload: { conversationId?: string; projectId?: string; message: string; mode: string }) =>
    apiFetch<{ conversation: CopilotConversation; assistantMessage: CopilotMessage; user: UserAccount }>(
      '/api/copilot/chat',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  createReport: (payload: { projectId: string; title: string; whiteLabel: boolean; brandName: string }) =>
    apiFetch<{ report: SavedReport }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteReport: (id: string) => apiFetch<{ deleted: boolean }>(`/api/reports/${id}`, { method: 'DELETE' }),

  markAllNotificationsRead: () => apiFetch<{ ok: boolean }>('/api/notifications/read-all', { method: 'PATCH' }),

  getProviders: () => apiFetch<{ providers: DataSourceProvider[] }>('/api/providers'),
  updateProvider: (
    id: string,
    payload: { enabled?: boolean; credentialValue?: string; mode?: 'live-free' | 'demo' }
  ) =>
    apiFetch<{ provider: DataSourceProvider }>(`/api/providers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  testProvider: (id: string, gscAccessToken?: string | null) =>
    apiFetch<{ provider: DataSourceProvider; latencyMs?: number; testResult: string }>(`/api/providers/${id}/test`, {
      method: 'POST',
      headers: gscAccessToken ? { 'X-Google-Access-Token': gscAccessToken } : undefined,
    }),

  getGscSites: (gscAccessToken: string) =>
    apiFetch<{ sites: { siteUrl: string; permissionLevel: string }[] }>('/api/gsc/sites', {
      headers: { 'X-Google-Access-Token': gscAccessToken },
    }),

  getGscAnalytics: (gscAccessToken: string, siteUrl: string) =>
    apiFetch<{
      siteUrl: string;
      startDate: string;
      endDate: string;
      rows: { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }[];
    }>('/api/gsc/analytics', {
      method: 'POST',
      headers: { 'X-Google-Access-Token': gscAccessToken },
      body: JSON.stringify({ siteUrl }),
    }),

  getAdminStatus: () =>
    apiFetch<{ isAdmin: boolean; adminClaimed: boolean; envPasscodeConfigured: boolean }>('/api/admin/status'),
  claimAdmin: (passcode: string) =>
    apiFetch<{ user: UserAccount }>('/api/auth/admin-claim', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),
  getAdminOverview: () =>
    apiFetch<{
      metrics: {
        totalUsers: number;
        activeUsers: number;
        researchRequests: number;
        apiErrors: number;
        estMrrUsd: number;
        systemHealth: string;
      };
      users: UserAccount[];
      plans: PlanConfig[];
      providers: DataSourceProvider[];
      recentLogs: {
        id: string;
        userId: string;
        providerId: string;
        endpoint: string;
        status: 'ok' | 'error';
        latencyMs: number;
        message?: string;
        createdAt: string;
      }[];
    }>('/api/admin/overview'),
  updateAdminPlan: (id: SubscriptionPlanId, payload: Partial<PlanConfig>) =>
    apiFetch<{ plan: PlanConfig }>(`/api/admin/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updateAdminUser: (id: string, payload: { subscriptionPlan?: SubscriptionPlanId; creditsUsed?: number; role?: 'user' | 'admin' }) =>
    apiFetch<{ user: UserAccount }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  exportAccountData: () => apiFetch<Record<string, unknown>>('/api/account/export'),
  deleteAccount: () => apiFetch<{ deleted: boolean }>('/api/account', { method: 'DELETE' }),
};
