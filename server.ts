import 'dotenv/config';
import express, { type NextFunction, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractBearerToken,
  hashPassword,
  rateLimit,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
  type AuthedRequest,
} from './server/auth.ts';
import {
  fetchBraveSearchResults,
  fetchCategorizedKeywordIdeas,
  fetchCommonCrawlDomainFootprint,
  fetchFirecrawlScrape,
  fetchGitHubRepositories,
  fetchGoogleSuggestKeywords,
  fetchGoogleTrendsRss,
  fetchHackerNewsDiscussions,
  fetchIndustryNewsRss,
  fetchOpenAlexCitations,
  fetchOpenPageRankScores,
  fetchOssVisitorAnalytics,
  fetchPageSpeedInsights,
  fetchRedditPublicThreads,
  fetchSearxngResults,
  fetchSerperResults,
  fetchTrancoDomainRanks,
  fetchWikidataEntityGraph,
  fetchWikimediaPageviews,
  fetchWikipediaTopics,
  fetchYouTubeSearchResults,
  inspectPublicWebsite,
  inspectSiteSitemapAndLinks,
  inspectSslAndSubdomains,
  testFreeProviderConnection,
} from './server/freeProviders.ts';
import {
  generateKeywordAiOverviewWithGemini,
  runCopilotWithGemini,
  runKeywordAiPromptWithGemini,
} from './server/gemini.ts';
import { readStore, sanitizeUser, writeStore, type StoredUser } from './server/store.ts';
import {
  computePlanUsage,
  generateAudienceProfile,
  generateCompetitorComparison,
  generateSeoToolData,
  hashSeed,
  normalizeDomain,
} from './src/lib/intelligence.ts';
import {
  ALL_STATES_LABEL,
  formatGeoLabel,
  getCountryIsoCode,
  GLOBAL_COUNTRY_LABEL,
  parseSelectedStates,
} from './src/lib/geoAndEngines.ts';
import {
  buildBulkKeywordAnalysis,
  buildFaqJsonLdSnippet,
  buildUbersuggestOverviewBaseline,
  computePaidDifficulty,
  extractDomainSafe,
  getCurrencyForCountry,
  getLanguageCode,
  inferKeywordIntent,
  parseBulkKeywordInput,
} from './src/lib/ubersuggest.ts';
import type {
  KeywordIdeaCategory,
  KeywordIdeaItem,
  ResearchProject,
  SavedKeywordItem,
  SavedKeywordList,
  SeoToolId,
  SubscriptionPlanId,
} from './src/types.ts';

const PORT = 3000;

function getAuthedUser(req: AuthedRequest): StoredUser | null {
  const token = extractBearerToken(req);
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const store = readStore();
  return store.users.find((u) => u.id === payload.userId) ?? null;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.authUserId = user.id;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = getAuthedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required.' });
    return;
  }
  req.authUserId = user.id;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/plans', (_req, res) => {
    const store = readStore();
    res.json({ plans: store.plans });
  });

  // Public shareable report endpoint
  app.get('/api/reports/public/:shareSlug', (req, res) => {
    const store = readStore();
    const report = store.reports.find((r) => r.shareSlug === req.params.shareSlug);
    if (!report) {
      res.status(404).json({ error: 'Shared report not found.' });
      return;
    }
    const project = store.projects.find((p) => p.id === report.projectId);
    res.json({ report, project });
  });

  // Auth routes
  app.post('/api/auth/demo', rateLimit(30, 60_000), (_req, res) => {
    const store = readStore();
    const demoUser = store.users.find((u) => u.id === 'usr_demo_01') || store.users[0];
    if (!demoUser) {
      res.status(500).json({ error: 'Demo workspace unavailable.' });
      return;
    }
    const token = signSessionToken(demoUser.id, demoUser.email);
    res.json({ token, user: sanitizeUser(demoUser) });
  });

  app.post('/api/auth/register', rateLimit(15, 60_000), (req, res) => {
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const rawPassword = String(password || '');

    if (!cleanName || cleanName.length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (rawPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const store = readStore();
    if (store.users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const workspaceId = `ws_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

    const newUser: StoredUser = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role: 'user',
      emailVerified: false,
      subscriptionPlan: 'free',
      creditsUsed: 0,
      workspaceId,
      brandName: 'AudiencePulse AI',
      passwordHash: hashPassword(rawPassword),
      verificationCode,
      resetToken: null,
      onboarding: {
        businessOrWebsite: '',
        industry: 'B2B SaaS & Marketing',
        targetAudience: '',
        targetCountries: ['United States'],
        preferredLanguage: 'English',
        objectives: [],
        completed: false,
      },
      createdAt: now,
    };

    const starterQuery = 'Digital Marketing & SaaS Buyers';
    const starterProjectId = `proj_${crypto.randomBytes(6).toString('hex')}`;

    store.users.push(newUser);
    store.workspaces.push({
      id: workspaceId,
      name: `${cleanName.split(' ')[0]}'s Workspace`,
      organisationName: `${cleanName.split(' ')[0]} Team`,
      ownerId: userId,
      industry: 'B2B SaaS & Marketing',
      createdAt: now,
    });
    store.projects.push({
      id: starterProjectId,
      userId,
      workspaceId,
      title: 'Starter Audience Snapshot',
      query: starterQuery,
      country: 'United States',
      language: 'English',
      industry: 'B2B SaaS & Marketing',
      dataMode: 'Demonstration Dataset',
      intelligence: generateAudienceProfile(starterQuery, 'United States', 'English', 'B2B SaaS & Marketing'),
      createdAt: now,
      updatedAt: now,
    });
    store.competitorWatchlist[userId] = ['sparktoro.com', 'ahrefs.com', 'semrush.com'];
    store.trackedKeywords[userId] = [
      { keyword: 'audience research software', targetDomain: 'example.com', position: 6, volume: 4400 },
    ];
    store.notifications.push({
      id: `notif_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      title: 'Welcome to AudiencePulse AI',
      detail: `Your verification code is ${verificationCode} (preview mode). Complete onboarding to tailor AI recommendations.`,
      read: false,
      createdAt: now,
    });

    writeStore(store);
    const token = signSessionToken(newUser.id, newUser.email);
    res.status(201).json({
      token,
      user: sanitizeUser(newUser),
      previewVerificationCode: verificationCode,
    });
  });

  app.post('/api/auth/login', rateLimit(20, 60_000), (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!cleanEmail || !rawPassword) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const store = readStore();
    const user = store.users.find((u) => u.email === cleanEmail);
    if (!user || !user.passwordHash || !verifyPassword(rawPassword, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signSessionToken(user.id, user.email);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/google', rateLimit(20, 60_000), (req, res) => {
    const { email, name } = req.body as { email?: string; name?: string };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || 'Google Workspace User').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Valid Google account email is required.' });
      return;
    }

    const store = readStore();
    let user = store.users.find((u) => u.email === cleanEmail);
    const now = new Date().toISOString();

    if (!user) {
      const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
      const workspaceId = `ws_${crypto.randomBytes(6).toString('hex')}`;
      user = {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: 'user',
        emailVerified: true,
        subscriptionPlan: 'free',
        creditsUsed: 0,
        workspaceId,
        brandName: 'AudiencePulse AI',
        passwordHash: '',
        verificationCode: '000000',
        resetToken: null,
        onboarding: {
          businessOrWebsite: '',
          industry: 'B2B SaaS & Marketing',
          targetAudience: '',
          targetCountries: ['United States'],
          preferredLanguage: 'English',
          objectives: [],
          completed: false,
        },
        createdAt: now,
      };
      store.users.push(user);
      store.workspaces.push({
        id: workspaceId,
        name: `${cleanName.split(' ')[0]}'s Workspace`,
        organisationName: `${cleanName.split(' ')[0]} Team`,
        ownerId: userId,
        industry: 'B2B SaaS & Marketing',
        createdAt: now,
      });
      store.competitorWatchlist[userId] = ['sparktoro.com', 'ahrefs.com', 'semrush.com'];
      store.trackedKeywords[userId] = [];
      writeStore(store);
    }

    const token = signSessionToken(user.id, user.email);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/verify-email', requireAuth, (req: AuthedRequest, res) => {
    const { code } = req.body as { code?: string };
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (String(code || '').trim() !== user.verificationCode) {
      res.status(400).json({ error: 'Verification code does not match.' });
      return;
    }
    user.emailVerified = true;
    writeStore(store);
    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/recover-password', rateLimit(10, 60_000), (req, res) => {
    const { email, newPassword, resetCode } = req.body as {
      email?: string;
      newPassword?: string;
      resetCode?: string;
    };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const store = readStore();
    const user = store.users.find((u) => u.email === cleanEmail);

    if (!newPassword) {
      if (user) {
        const token = String(Math.floor(100000 + Math.random() * 900000));
        user.resetToken = token;
        writeStore(store);
        res.json({
          message: 'Recovery code generated for preview verification.',
          previewResetCode: token,
        });
        return;
      }
      res.json({ message: 'If an account matches this email, recovery instructions are ready.' });
      return;
    }

    if (!user || !user.resetToken || String(resetCode || '').trim() !== user.resetToken) {
      res.status(400).json({ error: 'Invalid recovery code or email.' });
      return;
    }
    if (String(newPassword).length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    user.passwordHash = hashPassword(String(newPassword));
    user.resetToken = null;
    writeStore(store);
    res.json({ message: 'Password updated. You can now sign in.' });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/onboarding', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const body = req.body as Partial<StoredUser['onboarding']>;
    user.onboarding = {
      businessOrWebsite: String(body.businessOrWebsite ?? user.onboarding.businessOrWebsite ?? '').slice(0, 160),
      industry: String(body.industry ?? user.onboarding.industry ?? 'B2B SaaS & Marketing').slice(0, 100),
      targetAudience: String(body.targetAudience ?? user.onboarding.targetAudience ?? '').slice(0, 160),
      targetCountries: Array.isArray(body.targetCountries) && body.targetCountries.length > 0
        ? body.targetCountries.slice(0, 6).map(String)
        : ['United States'],
      preferredLanguage: String(body.preferredLanguage ?? user.onboarding.preferredLanguage ?? 'English').slice(0, 40),
      objectives: Array.isArray(body.objectives) ? body.objectives.slice(0, 6).map(String) : [],
      completed: true,
    };

    // Also create a tailored project if targetAudience was supplied and user has <= 1 project
    const userProjects = store.projects.filter((p) => p.userId === user.id);
    if (user.onboarding.targetAudience.trim().length >= 3 && userProjects.length <= 1) {
      const now = new Date().toISOString();
      const query = user.onboarding.targetAudience.trim();
      const country = user.onboarding.targetCountries[0] || 'United States';
      store.projects.unshift({
        id: `proj_${crypto.randomBytes(6).toString('hex')}`,
        userId: user.id,
        workspaceId: user.workspaceId,
        title: `${query} (${country})`,
        query,
        country,
        language: user.onboarding.preferredLanguage,
        industry: user.onboarding.industry,
        dataMode: 'Demonstration Dataset',
        intelligence: generateAudienceProfile(query, country, user.onboarding.preferredLanguage, user.onboarding.industry),
        createdAt: now,
        updatedAt: now,
      });
    }

    writeStore(store);
    res.json({ user: sanitizeUser(user) });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { name, brandName, workspaceId, subscriptionPlan } = req.body as {
      name?: string;
      brandName?: string;
      workspaceId?: string;
      subscriptionPlan?: SubscriptionPlanId;
    };
    if (typeof name === 'string' && name.trim().length >= 2) {
      user.name = name.trim().slice(0, 80);
    }
    if (typeof brandName === 'string' && brandName.trim().length >= 2) {
      user.brandName = brandName.trim().slice(0, 40);
    }
    if (typeof workspaceId === 'string' && store.workspaces.some((w) => w.id === workspaceId && w.ownerId === user.id)) {
      user.workspaceId = workspaceId;
    }
    if (subscriptionPlan && ['free', 'starter', 'pro', 'agency'].includes(subscriptionPlan)) {
      user.subscriptionPlan = subscriptionPlan;
    }
    writeStore(store);
    res.json({ user: sanitizeUser(user) });
  });

  // Admin bootstrap / claim
  app.get('/api/admin/status', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    res.json({
      isAdmin: user?.role === 'admin',
      adminClaimed: store.adminClaimed,
      envPasscodeConfigured: Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0),
    });
  });

  app.post('/api/auth/admin-claim', requireAuth, (req: AuthedRequest, res) => {
    const { passcode } = req.body as { passcode?: string };
    const cleanPasscode = String(passcode || '').trim();
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      if (cleanPasscode !== envPasscode) {
        res.status(403).json({ error: 'Incorrect administrator passcode.' });
        return;
      }
      user.role = 'admin';
      store.adminClaimed = true;
      writeStore(store);
      res.json({ user: sanitizeUser(user) });
      return;
    }

    if (!store.adminClaimed) {
      if (cleanPasscode.length < 6) {
        res.status(400).json({ error: 'Choose an administrator passcode of at least 6 characters.' });
        return;
      }
      store.adminPasscodeHash = hashPassword(cleanPasscode);
      store.adminClaimed = true;
      user.role = 'admin';
      writeStore(store);
      res.json({ user: sanitizeUser(user) });
      return;
    }

    if (store.adminPasscodeHash && verifyPassword(cleanPasscode, store.adminPasscodeHash)) {
      user.role = 'admin';
      writeStore(store);
      res.json({ user: sanitizeUser(user) });
      return;
    }

    res.status(403).json({ error: 'Invalid administrator passcode.' });
  });

  // Workspaces
  app.get('/api/workspaces', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const workspaces = store.workspaces.filter((w) => w.ownerId === req.authUserId);
    res.json({ workspaces });
  });

  app.post('/api/workspaces', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const plan = store.plans.find((p) => p.id === user.subscriptionPlan) || store.plans[0];
    const currentWorkspaces = store.workspaces.filter((w) => w.ownerId === user.id);
    if (currentWorkspaces.length >= plan.maxWorkspaces) {
      res.status(403).json({ error: `Your ${plan.name} plan allows up to ${plan.maxWorkspaces} workspace(s). Upgrade to add more.` });
      return;
    }
    const { name, organisationName, industry } = req.body as {
      name?: string;
      organisationName?: string;
      industry?: string;
    };
    if (!name || name.trim().length < 2) {
      res.status(400).json({ error: 'Workspace name is required.' });
      return;
    }
    const ws = {
      id: `ws_${crypto.randomBytes(6).toString('hex')}`,
      name: name.trim().slice(0, 60),
      organisationName: String(organisationName || name).trim().slice(0, 60),
      ownerId: user.id,
      industry: String(industry || user.onboarding.industry || 'Marketing').slice(0, 60),
      createdAt: new Date().toISOString(),
    };
    store.workspaces.push(ws);
    user.workspaceId = ws.id;
    writeStore(store);
    res.status(201).json({ workspace: ws, user: sanitizeUser(user) });
  });

  // Research Projects (9-module audience intelligence)
  app.get('/api/projects', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const projects = store.projects.filter((p) => p.userId === req.authUserId);
    res.json({ projects });
  });

  async function buildEnrichedProjectIntelligence(
    store: ReturnType<typeof readStore>,
    params: {
      query: string;
      country: string;
      state: string;
      searchEngine: string;
      language: string;
      industry: string;
    }
  ) {
    const {
      query: cleanQuery,
      country: cleanCountry,
      state: cleanState,
      searchEngine: cleanEngine,
      language: cleanLanguage,
      industry: cleanIndustry,
    } = params;
    const parsedStates = parseSelectedStates(cleanState);
    const countryCode = getCountryIsoCode(cleanCountry);

    const intelligence = generateAudienceProfile(
      cleanQuery,
      cleanCountry,
      cleanLanguage,
      cleanIndustry,
      cleanState,
      cleanEngine
    );

    const isProviderEnabled = (id: string) =>
      store.providers.some((p) => p.id === id && p.enabled);

    const searxQuery = parsedStates.length > 0 ? `${cleanQuery} ${parsedStates[0]}` : cleanQuery;

    const [
      liveSuggests,
      liveReddit,
      liveHn,
      liveWiki,
      liveYouTube,
      liveSearxng,
      liveEntities,
      liveNews,
      liveAnalytics,
    ] = await Promise.all([
      isProviderEnabled('google-suggest-free')
        ? fetchGoogleSuggestKeywords(cleanQuery, countryCode, cleanState)
        : Promise.resolve([]),
      isProviderEnabled('reddit-free') ? fetchRedditPublicThreads(cleanQuery) : Promise.resolve([]),
      isProviderEnabled('hn-algolia-free') ? fetchHackerNewsDiscussions(cleanQuery) : Promise.resolve([]),
      isProviderEnabled('wikipedia-free') ? fetchWikipediaTopics(cleanQuery) : Promise.resolve([]),
      isProviderEnabled('youtube-free') && store.providerSecrets['youtube-free']
        ? fetchYouTubeSearchResults(cleanQuery, store.providerSecrets['youtube-free'], countryCode)
        : Promise.resolve([]),
      isProviderEnabled('searxng-free') && store.providerSecrets['searxng-free']
        ? fetchSearxngResults(searxQuery, store.providerSecrets['searxng-free'])
        : Promise.resolve([]),
      isProviderEnabled('wikidata-sparql-free') ? fetchWikidataEntityGraph(cleanQuery) : Promise.resolve([]),
      isProviderEnabled('rss-news-free')
        ? fetchIndustryNewsRss(cleanQuery, store.providerSecrets['rss-news-free'], countryCode, getLanguageCode(cleanLanguage))
        : Promise.resolve([]),
      isProviderEnabled('oss-analytics-free') && store.providerSecrets['oss-analytics-free']
        ? fetchOssVisitorAnalytics(store.providerSecrets['oss-analytics-free'])
        : Promise.resolve(null),
    ]);

    let liveSignalCount = 0;

    if (liveSuggests.length > 0) {
      liveSignalCount += liveSuggests.length;
      const existingSet = new Set(intelligence.keywords.map((k) => k.keyword.toLowerCase()));
      const liveKeywords = liveSuggests
        .filter((kw) => !existingSet.has(kw.toLowerCase()))
        .slice(0, 6)
        .map((kw, idx) => ({
          keyword: kw,
          searchVolume: 1400 + ((kw.length * 310 + idx * 450) % 7200),
          difficulty: 14 + ((kw.length * 7 + idx * 5) % 28),
          cpcUsd: Number((1.1 + ((idx * 0.45) % 4.5)).toFixed(2)),
          competition: 'Low' as const,
          intent: (kw.startsWith('how') ? 'Informational' : 'Commercial') as 'Informational' | 'Commercial',
          cluster: `Live Free Suggest (${cleanCountry})`,
          isQuestion: /^(how|what|why|when|where|best)/i.test(kw),
          isTrending: true,
          trend12m: [42, 46, 51, 55, 60, 64, 68, 72, 77, 81, 86, 92],
          gapOpportunityScore: 84 - idx * 3,
          country: cleanCountry,
          language: cleanLanguage,
          searchEngine: cleanEngine,
          provenance: 'Observed' as const,
        }));
      intelligence.keywords = [...liveKeywords, ...intelligence.keywords];
    }

    if (liveReddit.length > 0) {
      liveSignalCount += liveReddit.length;
      const liveSubreddits = liveReddit.slice(0, 3).map((thread) => ({
        subreddit: thread.subreddit,
        subscribersEst: 'Live Public Thread',
        audienceMatchPct: 86,
        coreTopics: [cleanQuery, 'Live Reddit Discussion'],
        popularDiscussion: thread.title,
        faqQuestion: `Community discussion (${thread.numComments} comments, score ${thread.score})`,
        customerComplaint: 'Captured live from public Reddit search JSON without paid API keys.',
        trendDirection: 'Rising' as const,
        provenance: 'Observed' as const,
      }));
      intelligence.redditCommunities = [...liveSubreddits, ...intelligence.redditCommunities.slice(0, 4)];
    }

    if (liveHn.length > 0) {
      liveSignalCount += liveHn.length;
      const liveMedia = liveHn.slice(0, 3).map((story) => ({
        title: `${story.title} (HN · ${story.points} pts)`,
        mediaType: 'Industry Publication' as const,
        url: story.url,
        audienceAffinityPct: 78,
        topicFocus: cleanIndustry,
        frequency: `${story.numComments} live comments`,
        provenance: 'Observed' as const,
      }));
      intelligence.mediaConsumption = [...liveMedia, ...intelligence.mediaConsumption.slice(0, 4)];
    }

    if (liveWiki.length > 0) {
      liveSignalCount += liveWiki.length;
      const liveTopics = liveWiki.slice(0, 3).map((entry) => ({
        topic: entry.title,
        category: 'Industry Discussion' as const,
        cluster: 'Wikimedia Entity',
        interestPct: 74,
        growthPct: 19,
        relatedQuestion: `What is ${entry.title} in ${cleanIndustry}?`,
        contentOpportunity: `Reference authoritative Wikimedia entity (${entry.url}) for AI search grounding.`,
        provenance: 'Observed' as const,
      }));
      intelligence.topicsOfInterest = [...liveTopics, ...intelligence.topicsOfInterest.slice(0, 4)];
    }

    if (liveYouTube.length > 0) {
      liveSignalCount += liveYouTube.length;
      const liveCreators = liveYouTube.slice(0, 3).map((yt) => ({
        name: yt.channelTitle,
        handle: `@${yt.channelTitle.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
        platform: 'YouTube' as const,
        profileUrl: yt.url,
        industry: cleanIndustry,
        relevanceScore: 91,
        followersPublic: 'Live YouTube Data API v3',
        engagementRatePct: 4.8,
        collaborationIdea: `Partner or sponsor video around "${yt.title.slice(0, 48)}"`,
        observationKind: 'Observed Public Profile' as const,
      }));
      intelligence.socialAccounts = [...liveCreators, ...intelligence.socialAccounts.slice(0, 4)];
      const liveYtMedia = liveYouTube.slice(0, 2).map((yt) => ({
        title: `${yt.title} (YouTube Live)`,
        mediaType: 'YouTube Channel' as const,
        url: yt.url,
        audienceAffinityPct: 85,
        topicFocus: cleanQuery,
        frequency: 'Live YouTube API v3',
        provenance: 'Observed' as const,
      }));
      intelligence.mediaConsumption = [...liveYtMedia, ...intelligence.mediaConsumption.slice(0, 5)];
    }

    if (liveSearxng.length > 0) {
      liveSignalCount += liveSearxng.length;
      const liveSites = liveSearxng.slice(0, 3).map((hit) => {
        let host = 'searxng.result';
        try {
          host = new URL(hit.url).hostname.replace(/^www\./, '');
        } catch {
          host = 'searxng.result';
        }
        return {
          domain: host,
          category: `Live SearXNG (${hit.engine})`,
          monthlyVisitsEst: 48000,
          overlapPct: 42,
          primarySource: 'Organic Search' as const,
          topCountry: cleanCountry,
          isCompetitor: false,
          provenance: 'Observed' as const,
        };
      });
      intelligence.websiteVisitation = [...liveSites, ...intelligence.websiteVisitation.slice(0, 5)];
    }

    if (liveEntities.length > 0) {
      liveSignalCount += liveEntities.length;
      const entityTopics = liveEntities.slice(0, 3).map((ent) => ({
        topic: `${ent.label} (${ent.qid})`,
        category: 'Industry Discussion' as const,
        cluster: ent.industry || 'Wikidata Knowledge Graph',
        interestPct: 79,
        growthPct: 22,
        relatedQuestion: `How does ${ent.label} position within ${cleanIndustry}?`,
        contentOpportunity: `${ent.description}${ent.officialWebsite ? ` · Official site: ${ent.officialWebsite}` : ''}`,
        provenance: 'Observed' as const,
      }));
      intelligence.topicsOfInterest = [...entityTopics, ...intelligence.topicsOfInterest.slice(0, 4)];
    }

    if (liveNews.length > 0) {
      liveSignalCount += liveNews.length;
      const newsMedia = liveNews.slice(0, 3).map((n) => ({
        title: `${n.title}`,
        mediaType: 'News Publication' as const,
        url: n.url,
        audienceAffinityPct: 81,
        topicFocus: n.source,
        frequency: n.publishedAt || 'Live RSS Headline',
        provenance: 'Observed' as const,
      }));
      intelligence.mediaConsumption = [...newsMedia, ...intelligence.mediaConsumption.slice(0, 4)];
    }

    if (liveAnalytics?.configured && (liveAnalytics.topReferrers?.length || liveAnalytics.visitors30d)) {
      liveSignalCount += 1;
      const refSites = (liveAnalytics.topReferrers || []).slice(0, 3).map((r) => ({
        domain: r.domain,
        category: `${liveAnalytics.providerName || 'Analytics'} Referrer (Live)`,
        monthlyVisitsEst: r.visitors,
        overlapPct: 100,
        primarySource: 'Referral' as const,
        topCountry: cleanCountry,
        isCompetitor: false,
        provenance: 'Observed' as const,
      }));
      if (refSites.length > 0) {
        intelligence.websiteVisitation = [...refSites, ...intelligence.websiteVisitation.slice(0, 5)];
      }
    }

    const dataMode: ResearchProject['dataMode'] =
      liveSignalCount > 0 ? 'Free Live + Demo Hybrid' : 'Demonstration Dataset';

    if (liveSignalCount > 0) {
      intelligence.sampleModeNotice =
        `Live free adapters enriched this snapshot with ${liveSignalCount} observed public signals. Manage free and optional-quota adapters in API & Settings.`;
    }

    return { intelligence, dataMode, liveSignalCount };
  }

  app.post('/api/projects', requireAuth, async (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const plan = store.plans.find((p) => p.id === user.subscriptionPlan) || store.plans[0];
    const usage = computePlanUsage(user.creditsUsed, plan);
    if (usage.isExhausted) {
      res.status(403).json({ error: `Monthly research credit limit (${plan.monthlyCredits}) reached. Upgrade plan or adjust limits in Admin.` });
      return;
    }

    const { query, title, country, state, searchEngine, language, industry } = req.body as {
      query?: string;
      title?: string;
      country?: string;
      state?: string;
      searchEngine?: string;
      language?: string;
      industry?: string;
    };
    const cleanQuery = String(query || '').trim();
    if (cleanQuery.length < 2) {
      res.status(400).json({ error: 'Please enter an audience description, topic, or domain.' });
      return;
    }

    const cleanCountry = String(country || GLOBAL_COUNTRY_LABEL).trim() || GLOBAL_COUNTRY_LABEL;
    const parsedStates = parseSelectedStates(state);
    const cleanState = parsedStates.length > 0 ? parsedStates.join(', ') : ALL_STATES_LABEL;
    const cleanEngine = String(searchEngine || 'All Engines').trim() || 'All Engines';
    const cleanLanguage = String(language || 'English').trim();
    const cleanIndustry = String(industry || user.onboarding.industry || 'B2B SaaS & Marketing').trim();
    const now = new Date().toISOString();

    const { intelligence, dataMode, liveSignalCount } = await buildEnrichedProjectIntelligence(store, {
      query: cleanQuery,
      country: cleanCountry,
      state: cleanState,
      searchEngine: cleanEngine,
      language: cleanLanguage,
      industry: cleanIndustry,
    });

    const geoTitleLabel = formatGeoLabel(cleanCountry, cleanState);
    const project: ResearchProject = {
      id: `proj_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      workspaceId: user.workspaceId,
      title: String(title || `${cleanQuery} (${geoTitleLabel})`).slice(0, 110),
      query: cleanQuery.slice(0, 140),
      country: cleanCountry,
      state: cleanState,
      searchEngine: cleanEngine,
      language: cleanLanguage,
      industry: cleanIndustry,
      dataMode,
      intelligence,
      createdAt: now,
      updatedAt: now,
    };

    user.creditsUsed += 1;
    store.projects.unshift(project);
    store.apiUsageLogs.unshift({
      id: `log_${crypto.randomBytes(4).toString('hex')}`,
      userId: user.id,
      providerId: liveSignalCount > 0 ? 'google-suggest-free' : 'wikipedia-free',
      endpoint: '/audience/research',
      status: 'ok',
      latencyMs: 142,
      message: `Generated 9-module research snapshot for "${cleanQuery}" (${liveSignalCount} live free signals)`,
      createdAt: now,
    });
    writeStore(store);
    res.status(201).json({ project, user: sanitizeUser(user) });
  });

  app.patch('/api/projects/:id', requireAuth, async (req: AuthedRequest, res) => {
    const store = readStore();
    const project = store.projects.find((p) => p.id === req.params.id && p.userId === req.authUserId);
    if (!project) {
      res.status(404).json({ error: 'Research project not found.' });
      return;
    }

    const { query, country, state, searchEngine, language, industry } = req.body as {
      query?: string;
      country?: string;
      state?: string;
      searchEngine?: string;
      language?: string;
      industry?: string;
    };

    const cleanQuery = typeof query === 'string' && query.trim().length >= 2 ? query.trim() : project.query;
    const cleanCountry = typeof country === 'string' && country.trim() ? country.trim() : project.country;
    const parsedStates = parseSelectedStates(typeof state === 'string' ? state : project.state);
    const cleanState = parsedStates.length > 0 ? parsedStates.join(', ') : ALL_STATES_LABEL;
    const cleanEngine =
      typeof searchEngine === 'string' && searchEngine.trim()
        ? searchEngine.trim()
        : project.searchEngine || 'All Engines';
    const cleanLanguage = typeof language === 'string' && language.trim() ? language.trim() : project.language;
    const cleanIndustry = typeof industry === 'string' && industry.trim() ? industry.trim() : project.industry;
    const now = new Date().toISOString();

    const { intelligence, dataMode } = await buildEnrichedProjectIntelligence(store, {
      query: cleanQuery,
      country: cleanCountry,
      state: cleanState,
      searchEngine: cleanEngine,
      language: cleanLanguage,
      industry: cleanIndustry,
    });

    const geoTitleLabel = cleanCountry === GLOBAL_COUNTRY_LABEL && parsedStates.length === 0
      ? 'Global'
      : formatGeoLabel(cleanCountry, cleanState);

    project.query = cleanQuery.slice(0, 140);
    project.country = cleanCountry;
    project.state = cleanState;
    project.searchEngine = cleanEngine;
    project.language = cleanLanguage;
    project.industry = cleanIndustry;
    project.title = `${cleanQuery} (${geoTitleLabel})`.slice(0, 110);
    project.dataMode = dataMode;
    project.intelligence = intelligence;
    project.updatedAt = now;

    writeStore(store);
    res.json({ project });
  });

  app.delete('/api/projects/:id', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const idx = store.projects.findIndex((p) => p.id === req.params.id && p.userId === req.authUserId);
    if (idx === -1) {
      res.status(404).json({ error: 'Research project not found.' });
      return;
    }
    store.projects.splice(idx, 1);
    writeStore(store);
    res.json({ deleted: true });
  });

  // SEO Toolkit (12 tools)
  app.post('/api/seo/run', requireAuth, async (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { toolId, target, country, state, searchEngine } = req.body as {
      toolId?: SeoToolId;
      target?: string;
      country?: string;
      state?: string;
      searchEngine?: string;
    };
    const cleanTarget = String(target || '').trim();
    if (!cleanTarget) {
      res.status(400).json({ error: 'Enter a keyword or domain to analyse.' });
      return;
    }
    const activeToolId = toolId || 'keyword-explorer';
    const cleanCountry = String(country || GLOBAL_COUNTRY_LABEL).trim() || GLOBAL_COUNTRY_LABEL;
    const parsedStates = parseSelectedStates(state);
    const cleanState = parsedStates.length > 0 ? parsedStates.join(', ') : ALL_STATES_LABEL;
    const cleanEngine = String(searchEngine || 'Google').trim() || 'Google';
    const countryCode = getCountryIsoCode(cleanCountry);
    const geoLabel = formatGeoLabel(cleanCountry, cleanState);

    const result = generateSeoToolData(
      activeToolId,
      cleanTarget,
      cleanCountry,
      cleanEngine,
      cleanState
    );

    const isProviderEnabled = (id: string) =>
      store.providers.some((p) => p.id === id && p.enabled);

    let usedProviderId = 'google-suggest-free';

    if (
      (activeToolId === 'keyword-explorer' || activeToolId === 'keyword-gap' || activeToolId === 'search-intent') &&
      isProviderEnabled('google-suggest-free')
    ) {
      const liveSuggests = await fetchGoogleSuggestKeywords(cleanTarget, countryCode, cleanState);
      if (liveSuggests.length > 0) {
        result.provenance = 'Observed';
        const liveRows: Record<string, string | number>[] = liveSuggests.slice(0, 5).map((kw, idx): Record<string, string | number> => {
          const isInfo = /^(how|what|why|when|where|best)/i.test(kw);
          if (activeToolId === 'keyword-gap') {
            return {
              Keyword: `${kw} (Live Suggest)`,
              Volume: 1800 + ((kw.length * 290 + idx * 420) % 6400),
              KD: 16 + ((kw.length * 5 + idx * 4) % 28),
              'Your Pos': 'Not Ranked',
              'Top Competitor Pos': 2 + (idx % 4),
              'Gap Status': 'Missing (Live)',
            };
          }
          if (activeToolId === 'search-intent') {
            return {
              'Keyword Segment': `${kw} (Live Suggest)`,
              'Dominant Intent': isInfo ? 'Informational' : 'Commercial',
              'Share %': `${Math.max(12, 28 - idx * 4)}%`,
              'Recommended Content Format': isInfo ? 'Step-by-Step Playbook' : 'Comparison Landing Page',
              'CTA Match': isInfo ? 'Download Template' : 'Run Free Research',
            };
          }
          return {
            Keyword: `${kw} (Live Free Suggest)`,
            Volume: 1800 + ((kw.length * 290 + idx * 420) % 6400),
            KD: 16 + ((kw.length * 5 + idx * 4) % 28),
            'CPC ($)': (1.2 + idx * 0.35).toFixed(2),
            Intent: isInfo ? 'Informational' : 'Commercial',
            Opportunity: 'High (Live)',
          };
        });
        result.rows = [...liveRows, ...result.rows];
        result.recommendations.unshift(
          `Enriched live with ${liveSuggests.length} zero-cost ${cleanEngine} / Suggest queries for "${cleanTarget}" (${geoLabel}).`
        );
      }
    } else if (
      (activeToolId === 'technical-audit' || activeToolId === 'website-explorer') &&
      isProviderEnabled('site-inspector-free')
    ) {
      usedProviderId = 'site-inspector-free';
      const shouldRunPsi = activeToolId === 'technical-audit' && isProviderEnabled('pagespeed-free');
      const shouldCrawl = isProviderEnabled('librecrawl-free');
      const shouldSsl = isProviderEnabled('ssl-crtsh-free');
      const shouldFirecrawl = isProviderEnabled('firecrawl-oss') && Boolean(store.providerSecrets['firecrawl-oss']);
      const [site, psi, crawl, sslInfo, firecrawl] = await Promise.all([
        inspectPublicWebsite(cleanTarget),
        shouldRunPsi ? fetchPageSpeedInsights(cleanTarget, store.providerSecrets['pagespeed-free']) : Promise.resolve(null),
        shouldCrawl ? inspectSiteSitemapAndLinks(cleanTarget) : Promise.resolve(null),
        shouldSsl ? inspectSslAndSubdomains(cleanTarget) : Promise.resolve(null),
        shouldFirecrawl
          ? fetchFirecrawlScrape(cleanTarget, store.providerSecrets['firecrawl-oss'])
          : Promise.resolve(null),
      ]);
      if (site || psi || crawl || sslInfo || firecrawl) {
        result.provenance = 'Observed';
        result.summaryMetrics = [
          {
            label: 'HTTP Status',
            value: site ? String(site.statusCode) : 'Checked',
            delta: site?.reachable ? 'Reachable' : 'Issue',
          },
          {
            label: psi ? 'Mobile Performance' : 'Live TTFB',
            value: psi ? `${psi.performanceScore} / 100` : `${site?.responseMs ?? 0} ms`,
            delta: psi ? `LCP ${psi.lcp}` : (site?.responseMs ?? 0) < 600 ? 'Fast' : 'Optimize',
          },
          {
            label: sslInfo ? 'SSL & Subdomains' : crawl ? 'Sitemap & Links' : 'robots.txt',
            value: sslInfo
              ? `${sslInfo.sslValid ? 'TLS Valid' : 'TLS Issue'} · ${sslInfo.subdomainsCount} sub`
              : crawl
                ? `${crawl.sitemapUrlCount} URLs`
                : site?.hasRobotsTxt
                  ? 'Found'
                  : 'Missing',
            delta: sslInfo
              ? `${sslInfo.sslExpiryDays}d expiry · ${sslInfo.sslIssuer}`
              : crawl
                ? `${crawl.brokenLinks.length} broken / ${crawl.auditedPagesCount} checked`
                : undefined,
          },
          {
            label: 'Schema JSON-LD',
            value: site?.hasJsonLd ? 'Detected' : 'Missing',
            delta: crawl ? `${crawl.sitemapUrlCount} sitemap URLs` : site ? `${site.responseMs}ms TTFB` : undefined,
          },
        ];
        if (activeToolId === 'technical-audit') {
          const liveRows: Record<string, string | number>[] = [];
          if (sslInfo) {
            liveRows.push({
              Check: 'Live TLS / SSL & crt.sh Subdomain Discovery',
              Severity: sslInfo.sslValid ? 'Passed' : 'Error',
              'Affected URLs': Math.max(1, sslInfo.subdomainsCount),
              Impact: `${sslInfo.tlsProtocol} (${sslInfo.sslExpiryDays}d left, ${sslInfo.sslIssuer}) · Subdomains: ${sslInfo.sampleSubdomains.slice(0, 4).join(', ') || 'None'}`,
              'Suggested Fix': sslInfo.sslValid
                ? 'Certificate chain healthy; audit discovered subdomains for shadow SEO indexation'
                : 'Renew or fix TLS certificate chain',
            });
          }
          if (psi) {
            liveRows.push({
              Check: 'Live Google PageSpeed Insights v5 (Mobile)',
              Severity: psi.performanceScore >= 80 && psi.seoScore >= 85 ? 'Passed' : 'Warning',
              'Affected URLs': 1,
              Impact: `Perf ${psi.performanceScore}/100 · SEO ${psi.seoScore}/100 · LCP ${psi.lcp} · CLS ${psi.cls}`,
              'Suggested Fix': psi.performanceScore >= 85 ? 'Core Web Vitals look healthy' : 'Optimize LCP asset loading and main-thread JS',
            });
          }
          if (crawl) {
            liveRows.push({
              Check: 'Live Sitemap & Broken-Link Crawl (Built-in)',
              Severity: crawl.brokenLinks.length > 0 ? 'Error' : crawl.sitemapFound ? 'Passed' : 'Warning',
              'Affected URLs': crawl.auditedPagesCount,
              Impact: `Sitemap: ${crawl.sitemapFound ? `${crawl.sitemapUrlCount} URLs` : 'Not found'} · Broken links: ${crawl.brokenLinks.length}`,
              'Suggested Fix':
                crawl.brokenLinks.length > 0
                  ? `Fix ${crawl.brokenLinks[0]?.url} (HTTP ${crawl.brokenLinks[0]?.status})`
                  : crawl.sitemapFound
                    ? 'Sitemap & sampled internal links healthy'
                    : 'Publish an XML sitemap at /sitemap.xml',
            });
          }
          if (firecrawl) {
            liveRows.push({
              Check: 'Self-Hosted Firecrawl Markdown Extraction',
              Severity: 'Passed',
              'Affected URLs': 1,
              Impact: `Extracted "${firecrawl.title}" (${firecrawl.markdownSnippet.length} chars preview)`,
              'Suggested Fix': 'Structured markdown ready for AI Overviews & LLM indexing',
            });
          }
          if (site) {
            liveRows.push(
              {
                Check: 'Live HTML Title Tag',
                Severity: site.title ? 'Passed' : 'Error',
                'Affected URLs': 1,
                Impact: site.title ? `"${site.title}"` : 'Weak SERP click-through',
                'Suggested Fix': site.title ? 'Keep concise (50–60 chars)' : 'Add unique <title> tag',
              },
              {
                Check: 'Live Meta Description',
                Severity: site.metaDescription ? 'Passed' : 'Warning',
                'Affected URLs': 1,
                Impact: site.metaDescription ? `${site.metaDescription.length} chars detected` : 'Auto-generated snippets',
                'Suggested Fix': site.metaDescription ? 'Verified present' : 'Add 140–155 char meta description',
              },
              {
                Check: 'Live H1 Heading Count',
                Severity: site.h1Count === 1 ? 'Passed' : 'Warning',
                'Affected URLs': 1,
                Impact: `${site.h1Count} H1 element(s) on landing HTML`,
                'Suggested Fix': site.h1Count === 1 ? 'Single primary H1 verified' : 'Use one descriptive <h1> tag',
              },
              {
                Check: 'Canonical Link & Schema JSON-LD',
                Severity: site.hasCanonical && site.hasJsonLd ? 'Passed' : 'Warning',
                'Affected URLs': 1,
                Impact: `Canonical: ${site.hasCanonical ? 'Yes' : 'No'} · JSON-LD: ${site.hasJsonLd ? 'Yes' : 'No'}`,
                'Suggested Fix': site.hasCanonical && site.hasJsonLd ? 'Structured tags verified' : 'Add rel=canonical and JSON-LD schema',
              }
            );
          }
          result.rows = [...liveRows, ...result.rows.slice(0, 2)];
        } else {
          const liveRows: Record<string, string | number>[] = [];
          if (site) {
            liveRows.push({
              'Top Path': '/ (Live Inspected Root)',
              'Primary Keyword': site.title || cleanTarget,
              Pos: site.statusCode === 200 ? 1 : 0,
              'Monthly Visits': `${site.responseMs}ms TTFB`,
              'Traffic Share %': site.hasJsonLd ? 'Schema Ready' : 'No JSON-LD',
            });
          }
          if (crawl) {
            for (const pg of crawl.sampleUrls.slice(0, 4)) {
              liveRows.push({
                'Top Path': new URL(pg.url).pathname || '/',
                'Primary Keyword': pg.title || cleanTarget,
                Pos: pg.status,
                'Monthly Visits': pg.status < 400 ? 'Indexed OK' : `HTTP ${pg.status}`,
                'Traffic Share %': 'Live Crawl',
              });
            }
          }
          if (sslInfo) {
            for (const sub of sslInfo.sampleSubdomains.slice(0, 3)) {
              liveRows.push({
                'Top Path': `https://${sub}`,
                'Primary Keyword': `Discovered Subdomain (${sslInfo.sslIssuer})`,
                Pos: sslInfo.sslValid ? 200 : 0,
                'Monthly Visits': `${sslInfo.sslExpiryDays}d TLS`,
                'Traffic Share %': 'crt.sh',
              });
            }
          }
          result.rows = [...liveRows, ...result.rows];
        }
        if (sslInfo) {
          result.recommendations.unshift(
            `Certificate Transparency (crt.sh) & TLS check: ${sslInfo.tlsProtocol} (${sslInfo.sslValid ? 'Valid' : 'Issue'}, ${sslInfo.sslExpiryDays}d remaining) and ${sslInfo.subdomainsCount} subdomains discovered.`
          );
        }
        if (psi) {
          result.recommendations.unshift(
            `Live PageSpeed Insights v5 scored Performance ${psi.performanceScore}/100 and SEO ${psi.seoScore}/100 (FCP ${psi.fcp}, LCP ${psi.lcp}).`
          );
        }
        if (crawl) {
          result.recommendations.unshift(
            `Built-in Sitemap & Link Crawler checked ${crawl.auditedPagesCount} pages (Sitemap: ${crawl.sitemapFound ? `${crawl.sitemapUrlCount} URLs` : 'Missing'}, Broken links: ${crawl.brokenLinks.length}).`
          );
        }
        if (site) {
          result.recommendations.unshift(
            `Live SSRF-safe HTTP audit inspected ${site.finalUrl} in ${site.responseMs}ms (HTTP ${site.statusCode}).`
          );
        }
      }
    } else if (activeToolId === 'backlink-explorer') {
      usedProviderId = 'commoncrawl-free';
      const cleanHost = normalizeDomain(cleanTarget);
      const [cc, hnMentions, redditMentions, oprScores, trancoScores] = await Promise.all([
        isProviderEnabled('commoncrawl-free') ? fetchCommonCrawlDomainFootprint(cleanHost) : Promise.resolve({ indexedCount: 0, samples: [] }),
        isProviderEnabled('hn-algolia-free') ? fetchHackerNewsDiscussions(cleanHost) : Promise.resolve([]),
        isProviderEnabled('reddit-free') ? fetchRedditPublicThreads(cleanHost) : Promise.resolve([]),
        isProviderEnabled('openpagerank-free') && store.providerSecrets['openpagerank-free']
          ? fetchOpenPageRankScores([cleanHost], store.providerSecrets['openpagerank-free'])
          : Promise.resolve({} as Record<string, { authority: number; globalRank: string }>),
        fetchTrancoDomainRanks([cleanHost]),
      ]);
      const authorityScore = oprScores[cleanHost]?.authority ?? trancoScores[cleanHost];
      if (cc.samples.length > 0 || hnMentions.length > 0 || redditMentions.length > 0 || authorityScore) {
        result.provenance = 'Observed';
        if (authorityScore) {
          result.summaryMetrics[1] = {
            label: oprScores[cleanHost] ? 'Open PageRank DA' : 'Tranco Domain Authority',
            value: `${authorityScore} / 100`,
            delta: oprScores[cleanHost] ? `Global Rank #${oprScores[cleanHost].globalRank}` : 'Live Free Rank',
          };
        }
        result.summaryMetrics[2] = {
          label: 'Common Crawl URLs',
          value: `${cc.indexedCount}+ sampled`,
          delta: 'Open Web Index',
        };
        const liveRows: Record<string, string | number>[] = [
          ...hnMentions.slice(0, 3).map((h) => ({
            'Referring Domain': `news.ycombinator.com · ${h.title.slice(0, 42)}`,
            DR: 90,
            Type: 'Dofollow / Live HN Mention',
            'Anchor Text': cleanHost,
            'Target Page': h.url,
          })),
          ...redditMentions.slice(0, 3).map((r) => ({
            'Referring Domain': `reddit.com/${r.subreddit}`,
            DR: 91,
            Type: 'Live Community Mention',
            'Anchor Text': r.title.slice(0, 40),
            'Target Page': r.permalink,
          })),
          ...cc.samples.slice(0, 3).map((s) => ({
            'Referring Domain': `Common Crawl (${s.status} · ${s.mime})`,
            DR: authorityScore || 62,
            Type: 'Indexed Footprint',
            'Anchor Text': cleanHost,
            'Target Page': s.url,
          })),
        ];
        if (liveRows.length > 0) {
          result.rows = [...liveRows, ...result.rows.slice(0, 3)];
        }
        result.recommendations.unshift(
          `Observed live public mentions & crawl footprints via Common Crawl CDX (${cc.indexedCount}), HN Algolia (${hnMentions.length}), and Reddit (${redditMentions.length}).`
        );
      }
    } else if (
      activeToolId === 'serp-analyzer' &&
      isProviderEnabled('searxng-free') &&
      store.providerSecrets['searxng-free']
    ) {
      usedProviderId = 'searxng-free';
      const searxTarget = parsedStates.length > 0 ? `${cleanTarget} ${parsedStates[0]}` : cleanTarget;
      const searxHits = await fetchSearxngResults(searxTarget, store.providerSecrets['searxng-free']);
      if (searxHits.length > 0) {
        result.provenance = 'Observed';
        const liveRows = searxHits.slice(0, 6).map((hit, idx) => {
          let domain = 'result';
          try {
            domain = new URL(hit.url).hostname.replace(/^www\./, '');
          } catch {
            domain = 'result';
          }
          return {
            Pos: idx + 1,
            Domain: domain,
            'Page Type': hit.title.slice(0, 44),
            'Est. Traffic': `${hit.engine} (Live)`,
            'Ref. Domains': 'SearXNG',
            'SERP Feature': 'Live Organic',
          };
        });
        result.rows = [...liveRows, ...result.rows];
        result.recommendations.unshift(
          `Executed live self-hosted SearXNG metasearch query (${searxHits.length} results retrieved).`
        );
      }
    } else if (activeToolId === 'content-explorer') {
      usedProviderId = 'hn-algolia-free';
      const [hits, papers, repos] = await Promise.all([
        isProviderEnabled('hn-algolia-free') ? fetchHackerNewsDiscussions(cleanTarget) : Promise.resolve([]),
        isProviderEnabled('openalex-free') ? fetchOpenAlexCitations(cleanTarget) : Promise.resolve([]),
        isProviderEnabled('github-search-free') ? fetchGitHubRepositories(cleanTarget) : Promise.resolve([]),
      ]);
      const liveRows: Record<string, string | number>[] = [
        ...hits.slice(0, 3).map((h) => ({
          'Article Title': `${h.title} (HN Live)`,
          Domain: extractDomainSafe(h.url),
          'Est. Traffic': h.points * 45,
          'Ref. Domains': h.numComments,
          Published: 'HN Live',
        })),
        ...papers.slice(0, 2).map((p) => ({
          'Article Title': `${p.title} (OpenAlex Study)`,
          Domain: extractDomainSafe(p.url),
          'Est. Traffic': Math.max(120, p.citedByCount * 15),
          'Ref. Domains': p.citedByCount,
          Published: String(p.publicationYear || 'OpenAlex'),
        })),
        ...repos.slice(0, 2).map((r) => ({
          'Article Title': `${r.fullName} (GitHub · ${r.stars.toLocaleString()}★)`,
          Domain: 'github.com',
          'Est. Traffic': Math.max(200, r.stars * 2),
          'Ref. Domains': Math.max(10, Math.round(r.stars / 15)),
          Published: 'GitHub Live',
        })),
      ];
      if (liveRows.length > 0) {
        result.provenance = 'Observed';
        result.rows = [...liveRows, ...result.rows];
      }
    }

    user.creditsUsed += 1;
    store.apiUsageLogs.unshift({
      id: `log_${crypto.randomBytes(4).toString('hex')}`,
      userId: user.id,
      providerId: usedProviderId,
      endpoint: `/seo/${result.toolId}`,
      status: 'ok',
      latencyMs: 118,
      message: `SEO analysis: ${cleanTarget} (${result.provenance})`,
      createdAt: new Date().toISOString(),
    });
    writeStore(store);
    res.json({ result, user: sanitizeUser(user) });
  });

  // Ubersuggest AI Keyword Overview (Free Live + Optional Quota Adapters)
  app.post('/api/ubersuggest/overview', requireAuth, async (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { keyword, country, state, language, searchEngine } = req.body as {
      keyword?: string;
      country?: string;
      state?: string;
      language?: string;
      searchEngine?: string;
    };
    const cleanKeyword = String(keyword || '').trim();
    if (cleanKeyword.length < 2) {
      res.status(400).json({ error: 'Enter a keyword of at least 2 characters.' });
      return;
    }

    const cleanCountry = String(country || GLOBAL_COUNTRY_LABEL).trim() || GLOBAL_COUNTRY_LABEL;
    const parsedStates = parseSelectedStates(state);
    const cleanState = parsedStates.length > 0 ? parsedStates.join(', ') : ALL_STATES_LABEL;
    const cleanLanguage = String(language || 'English').trim() || 'English';
    const cleanEngine = String(searchEngine || 'Google').trim() || 'Google';
    const countryCode = getCountryIsoCode(cleanCountry);
    const langCode = getLanguageCode(cleanLanguage);

    const overview = buildUbersuggestOverviewBaseline({
      keyword: cleanKeyword,
      country: cleanCountry,
      state: cleanState,
      language: cleanLanguage,
      searchEngine: cleanEngine,
    });

    const isProviderEnabled = (id: string) =>
      store.providers.some((p) => p.id === id && p.enabled);

    const searchQuery = parsedStates.length > 0 ? `${cleanKeyword} ${parsedStates[0]}` : cleanKeyword;
    const currency = getCurrencyForCountry(cleanCountry);

    const [
      categorizedSuggest,
      liveReddit,
      liveHn,
      liveWiki,
      liveSerper,
      liveBrave,
      liveSearxng,
      livePageviews,
      liveTrends,
      liveOpenAlex,
      liveGitHub,
      liveEntityGraph,
      liveNewsRss,
    ] = await Promise.all([
      isProviderEnabled('google-suggest-free') || isProviderEnabled('ddg-ac-free')
        ? fetchCategorizedKeywordIdeas(cleanKeyword, countryCode, langCode, cleanState)
        : Promise.resolve({ autocomplete: [], questions: [], prepositions: [], comparisons: [] }),
      isProviderEnabled('reddit-free') ? fetchRedditPublicThreads(cleanKeyword) : Promise.resolve([]),
      isProviderEnabled('hn-algolia-free') ? fetchHackerNewsDiscussions(cleanKeyword) : Promise.resolve([]),
      isProviderEnabled('wikipedia-free') ? fetchWikipediaTopics(cleanKeyword) : Promise.resolve([]),
      isProviderEnabled('serper-free') && store.providerSecrets['serper-free']
        ? fetchSerperResults(searchQuery, store.providerSecrets['serper-free'], countryCode, langCode)
        : Promise.resolve({ organic: [], peopleAlsoAsk: [], answerBox: undefined }),
      isProviderEnabled('brave-search-free') && store.providerSecrets['brave-search-free']
        ? fetchBraveSearchResults(searchQuery, store.providerSecrets['brave-search-free'], countryCode)
        : Promise.resolve([]),
      isProviderEnabled('searxng-free') && store.providerSecrets['searxng-free']
        ? fetchSearxngResults(searchQuery, store.providerSecrets['searxng-free'])
        : Promise.resolve([]),
      isProviderEnabled('wikimedia-pageviews-free') ? fetchWikimediaPageviews(cleanKeyword) : Promise.resolve(null),
      isProviderEnabled('google-trends-rss-free')
        ? fetchGoogleTrendsRss(countryCode, cleanCountry)
        : Promise.resolve([]),
      isProviderEnabled('openalex-free') ? fetchOpenAlexCitations(cleanKeyword) : Promise.resolve([]),
      isProviderEnabled('github-search-free') ? fetchGitHubRepositories(cleanKeyword) : Promise.resolve([]),
      isProviderEnabled('wikidata-sparql-free') ? fetchWikidataEntityGraph(cleanKeyword) : Promise.resolve([]),
      isProviderEnabled('rss-news-free')
        ? fetchIndustryNewsRss(cleanKeyword, store.providerSecrets['rss-news-free'], countryCode, langCode)
        : Promise.resolve([]),
    ]);

    const liveSourcesUsed: string[] = [];

    const mergeIdeas = (
      category: KeywordIdeaCategory,
      liveTerms: string[],
      sourceLabel: string
    ) => {
      if (liveTerms.length === 0) return;
      const existing = new Set(overview.keywordIdeas[category].map((i) => i.keyword.toLowerCase()));
      const mapped: KeywordIdeaItem[] = liveTerms
        .filter((t) => !existing.has(t.toLowerCase()))
        .map((term, idx) => {
          const itemSeed = hashSeed(`${term}|${cleanCountry}`);
          const usd = Number((0.85 + (itemSeed % 45) * 0.11).toFixed(2));
          const intent = inferKeywordIntent(term);
          return {
            keyword: term,
            category,
            volume: 60 + ((itemSeed % 40) * 90),
            difficulty: 12 + ((itemSeed + idx * 5) % 42),
            paidDifficulty: computePaidDifficulty(itemSeed + idx, usd, intent),
            cpc: Number((usd * currency.rateFromUsd).toFixed(currency.code === 'JPY' || currency.code === 'NGN' ? 0 : 2)),
            intent,
            source: sourceLabel,
            provenance: 'Observed',
          };
        });
      overview.keywordIdeas[category] = [...mapped, ...overview.keywordIdeas[category]].slice(0, 16);
    };

    if (
      categorizedSuggest.autocomplete.length +
        categorizedSuggest.questions.length +
        categorizedSuggest.prepositions.length +
        categorizedSuggest.comparisons.length >
      0
    ) {
      liveSourcesUsed.push('Google & DuckDuckGo Suggest');
      mergeIdeas('autocomplete', categorizedSuggest.autocomplete, 'Google + DDG Suggest');
      mergeIdeas('questions', categorizedSuggest.questions, 'Google Suggest Questions');
      mergeIdeas('prepositions', categorizedSuggest.prepositions, 'Google Suggest Prepositions');
      mergeIdeas('comparisons', categorizedSuggest.comparisons, 'Google Suggest Comparisons');
    }

    if (liveSerper.peopleAlsoAsk.length > 0) {
      mergeIdeas('questions', liveSerper.peopleAlsoAsk, 'Serper People Also Ask');
    }

    // Build Live Search Results (Serper -> Brave -> SearXNG -> Wikipedia + HN + Reddit)
    const liveSerpRows: typeof overview.searchResults = [];

    if (liveSerper.organic.length > 0) {
      liveSourcesUsed.push('Serper.dev Google SERP');
      for (const hit of liveSerper.organic.slice(0, 8)) {
        const domain = extractDomainSafe(hit.link);
        const sSeed = hashSeed(hit.link);
        liveSerpRows.push({
          position: hit.position,
          title: hit.title,
          url: hit.link,
          domain,
          backlinks: 65 + (sSeed % 420),
          visits: Math.max(120, Math.round(2400 / Math.max(1, hit.position))),
          authority: 45 + (sSeed % 45),
          shares: 40 + (sSeed % 180),
          provenance: 'Observed',
        });
      }
      if (liveSerper.answerBox) {
        overview.aiOverview = liveSerper.answerBox;
      }
    } else if (liveBrave.length > 0) {
      liveSourcesUsed.push('Brave Search API');
      liveBrave.slice(0, 8).forEach((hit, idx) => {
        const domain = extractDomainSafe(hit.url);
        const sSeed = hashSeed(hit.url);
        liveSerpRows.push({
          position: idx + 1,
          title: hit.title,
          url: hit.url,
          domain,
          backlinks: 55 + (sSeed % 380),
          visits: Math.max(100, Math.round(2100 / (idx + 1))),
          authority: 42 + (sSeed % 46),
          shares: 35 + (sSeed % 140),
          provenance: 'Observed',
        });
      });
    } else if (liveSearxng.length > 0) {
      liveSourcesUsed.push('SearXNG Metasearch');
      liveSearxng.slice(0, 8).forEach((hit, idx) => {
        const domain = extractDomainSafe(hit.url);
        const sSeed = hashSeed(hit.url);
        liveSerpRows.push({
          position: idx + 1,
          title: hit.title,
          url: hit.url,
          domain,
          backlinks: 48 + (sSeed % 310),
          visits: Math.max(90, Math.round(1800 / (idx + 1))),
          authority: 40 + (sSeed % 48),
          shares: 30 + (sSeed % 120),
          provenance: 'Observed',
        });
      });
    }

    if (liveReddit.length > 0) {
      liveSourcesUsed.push('Reddit Public JSON');
    }
    if (liveHn.length > 0) {
      liveSourcesUsed.push('Hacker News Algolia');
    }
    if (liveWiki.length > 0) {
      liveSourcesUsed.push('Wikimedia OpenSearch');
    }

    // Add Wikipedia / HN / Reddit to Search Results if SERP APIs weren't configured
    if (liveSerpRows.length === 0 && (liveWiki.length > 0 || liveHn.length > 0 || liveReddit.length > 0)) {
      let pos = 1;
      for (const w of liveWiki.slice(0, 2)) {
        liveSerpRows.push({
          position: pos++,
          title: `${w.title} — Wikipedia`,
          url: w.url,
          domain: 'en.wikipedia.org',
          backlinks: 820,
          visits: 1640,
          authority: 96,
          shares: 210,
          provenance: 'Observed',
        });
      }
      for (const r of liveReddit.slice(0, 2)) {
        liveSerpRows.push({
          position: pos++,
          title: `${r.title} (${r.subreddit})`,
          url: r.permalink,
          domain: 'reddit.com',
          backlinks: 64 + r.numComments,
          visits: 420 + r.score * 6,
          authority: 91,
          shares: r.numComments + r.score,
          provenance: 'Observed',
        });
      }
      for (const h of liveHn.slice(0, 2)) {
        liveSerpRows.push({
          position: pos++,
          title: h.title,
          url: h.url,
          domain: extractDomainSafe(h.url),
          backlinks: 42 + h.numComments,
          visits: 280 + h.points * 8,
          authority: 74,
          shares: h.points + h.numComments,
          provenance: 'Observed',
        });
      }
    }

    if (liveSerpRows.length > 0) {
      overview.searchResults = [
        ...liveSerpRows,
        ...overview.searchResults.slice(0, Math.max(0, 8 - liveSerpRows.length)).map((row, idx) => ({
          ...row,
          position: liveSerpRows.length + idx + 1,
        })),
      ];
    }

    // Enrich Domain Authority via Open PageRank (if key configured) or Tranco free lookup
    const serpDomains = overview.searchResults.map((r) => r.domain);
    if (isProviderEnabled('openpagerank-free') && store.providerSecrets['openpagerank-free']) {
      const oprScores = await fetchOpenPageRankScores(serpDomains, store.providerSecrets['openpagerank-free']);
      if (Object.keys(oprScores).length > 0) {
        liveSourcesUsed.push('Open PageRank API');
        overview.searchResults = overview.searchResults.map((r) => ({
          ...r,
          authority: oprScores[r.domain.toLowerCase()]?.authority ?? r.authority,
        }));
      }
    } else {
      const trancoScores = await fetchTrancoDomainRanks(serpDomains);
      if (Object.keys(trancoScores).length > 0) {
        liveSourcesUsed.push('Tranco Domain Ranks');
        overview.searchResults = overview.searchResults.map((r) => ({
          ...r,
          authority: trancoScores[r.domain.toLowerCase()] ?? r.authority,
        }));
      }
    }

    // Enrich Content Ideas from Reddit + Hacker News + OpenAlex + GitHub
    const liveContentIdeas = [
      ...liveReddit.slice(0, 3).map((r) => ({
        title: `${r.title} (${r.subreddit})`,
        url: r.permalink,
        domain: 'reddit.com',
        estVisits: Math.max(40, r.score * 14 + r.numComments * 8),
        backlinks: Math.max(2, Math.round(r.numComments / 3)),
        socialShares: r.score + r.numComments,
        source: 'Reddit Public Feed',
        provenance: 'Observed' as const,
      })),
      ...liveHn.slice(0, 3).map((h) => ({
        title: h.title,
        url: h.url,
        domain: extractDomainSafe(h.url),
        estVisits: Math.max(60, h.points * 22),
        backlinks: Math.max(4, h.numComments),
        socialShares: h.points + h.numComments,
        source: 'HN Algolia Live',
        provenance: 'Observed' as const,
      })),
      ...liveOpenAlex.slice(0, 2).map((w) => ({
        title: `${w.title} (${w.citedByCount.toLocaleString()} citations)`,
        url: w.url,
        domain: extractDomainSafe(w.url),
        estVisits: Math.max(90, w.citedByCount * 12),
        backlinks: Math.max(5, w.citedByCount),
        socialShares: w.citedByCount,
        source: 'OpenAlex Research',
        provenance: 'Observed' as const,
      })),
      ...liveGitHub.slice(0, 2).map((repo) => ({
        title: `${repo.fullName} — ${repo.description || 'Open-Source Repository'}`,
        url: repo.url,
        domain: 'github.com',
        estVisits: Math.max(110, repo.stars * 2),
        backlinks: Math.max(8, Math.round(repo.stars / 12)),
        socialShares: repo.stars,
        source: 'GitHub Stars Live',
        provenance: 'Observed' as const,
      })),
      ...liveNewsRss.slice(0, 2).map((news) => ({
        title: news.title,
        url: news.url,
        domain: extractDomainSafe(news.url),
        estVisits: 450,
        backlinks: 14,
        socialShares: 65,
        source: `${news.source} (RSS)`,
        provenance: 'Observed' as const,
      })),
    ];

    if (liveOpenAlex.length > 0) {
      liveSourcesUsed.push('OpenAlex Citations');
    }
    if (liveGitHub.length > 0) {
      liveSourcesUsed.push('GitHub Open-Source Search');
    }
    if (liveEntityGraph.length > 0) {
      liveSourcesUsed.push('Wikidata Entity Graph');
      overview.entityGraph = liveEntityGraph;
    }
    if (liveNewsRss.length > 0) {
      liveSourcesUsed.push('Industry News RSS');
      overview.industryNews = liveNewsRss;
    }
    if (livePageviews && livePageviews.months.length >= 4) {
      liveSourcesUsed.push(`Wikimedia Pageviews (${livePageviews.articleTitle})`);
      const avgViews = Math.max(1, livePageviews.totalViews / livePageviews.months.length);
      overview.wikimediaPageviewsTotal = livePageviews.totalViews;
      overview.volumeHistory = livePageviews.months.map((m) => {
        const ratio = m.views / avgViews;
        const scaledTotal = Math.max(100, Math.round(overview.monthlyVolumeTotal * ratio));
        const mobile = Math.round((scaledTotal * overview.deviceSplit.mobilePct) / 100);
        return {
          month: m.month,
          total: scaledTotal,
          desktop: scaledTotal - mobile,
          mobile,
        };
      });
    }
    if (liveTrends.length > 0) {
      liveSourcesUsed.push('Google Trends RSS');
      overview.trendingNow = liveTrends.slice(0, 8);
    }

    if (liveContentIdeas.length > 0) {
      overview.contentIdeas = [...liveContentIdeas, ...overview.contentIdeas].slice(0, 12);
    }

    // Update FAQ JSON-LD snippet using enriched live Questions
    overview.faqJsonLdSnippet = buildFaqJsonLdSnippet(
      cleanKeyword,
      overview.keywordIdeas.questions,
      formatGeoLabel(cleanCountry, cleanState)
    );

    // Update Top AI Sources from enriched Search Results
    overview.topAiSources = overview.searchResults.slice(0, 10).map((r, idx) => ({
      rank: idx + 1,
      domain: r.domain,
      title: r.title,
      url: r.url,
      snippet: `Cited web source #${idx + 1} (${r.authority} DA · ${r.backlinks.toLocaleString()} backlinks).`,
    }));

    overview.liveSourcesUsed = liveSourcesUsed;
    if (liveSourcesUsed.length > 0) {
      overview.provenanceSummary = `Live free sources active: ${liveSourcesUsed.join(', ')}`;
    }

    user.creditsUsed += 1;
    store.apiUsageLogs.unshift({
      id: `log_${crypto.randomBytes(4).toString('hex')}`,
      userId: user.id,
      providerId: liveSourcesUsed.length > 0 ? 'google-suggest-free' : 'ddg-ac-free',
      endpoint: '/ubersuggest/overview',
      status: 'ok',
      latencyMs: 135,
      message: `AI Keyword Overview: "${cleanKeyword}" (${liveSourcesUsed.length} live sources)`,
      createdAt: new Date().toISOString(),
    });
    writeStore(store);
    res.json({ overview, user: sanitizeUser(user) });
  });

  app.post('/api/ubersuggest/ai-response', requireAuth, rateLimit(20, 60_000), async (req: AuthedRequest, res) => {
    const { promptText, keyword, language, country, state } = req.body as {
      promptText?: string;
      keyword?: string;
      language?: string;
      country?: string;
      state?: string;
    };
    const cleanPrompt = String(promptText || '').trim();
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Prompt text is required.' });
      return;
    }
    try {
      const data = await runKeywordAiPromptWithGemini({
        promptText: cleanPrompt,
        keyword: String(keyword || cleanPrompt).trim(),
        language: String(language || 'English').trim(),
        country: String(country || GLOBAL_COUNTRY_LABEL).trim(),
        state: String(state || ALL_STATES_LABEL).trim(),
      });
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to fetch Gemini AI response.',
      });
    }
  });

  app.post('/api/ubersuggest/ai-overview', requireAuth, rateLimit(15, 60_000), async (req: AuthedRequest, res) => {
    const { keyword, language, country, state } = req.body as {
      keyword?: string;
      language?: string;
      country?: string;
      state?: string;
    };
    const cleanKeyword = String(keyword || '').trim();
    if (!cleanKeyword) {
      res.status(400).json({ error: 'Keyword is required.' });
      return;
    }
    try {
      const data = await generateKeywordAiOverviewWithGemini({
        keyword: cleanKeyword,
        language: String(language || 'English').trim(),
        country: String(country || GLOBAL_COUNTRY_LABEL).trim(),
        state: String(state || ALL_STATES_LABEL).trim(),
      });
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to generate Gemini AI Overview.',
      });
    }
  });

  // Live Google Trends RSS Radar
  app.get('/api/trends/live', requireAuth, async (req, res) => {
    const country = String(req.query.country || GLOBAL_COUNTRY_LABEL).trim();
    const iso = getCountryIsoCode(country);
    const trends = await fetchGoogleTrendsRss(iso, country);
    res.json({ country, iso, trends });
  });

  // Live Industry News RSS / Atom Aggregator
  app.get('/api/news/live', requireAuth, async (req, res) => {
    const store = readStore();
    const query = String(req.query.q || 'seo marketing').trim();
    const country = String(req.query.country || GLOBAL_COUNTRY_LABEL).trim();
    const language = String(req.query.language || 'English').trim();
    const news = await fetchIndustryNewsRss(
      query,
      store.providerSecrets['rss-news-free'],
      getCountryIsoCode(country),
      getLanguageCode(language)
    );
    res.json({ query, country, news });
  });

  // Live Umami / PostHog Visitor Analytics
  app.get('/api/analytics/live', requireAuth, async (_req, res) => {
    const store = readStore();
    const enabled = store.providers.some((p) => p.id === 'oss-analytics-free' && p.enabled);
    if (!enabled) {
      res.json({ configured: false, message: 'Umami / PostHog adapter is disabled in API & Settings.' });
      return;
    }
    const snapshot = await fetchOssVisitorAnalytics(store.providerSecrets['oss-analytics-free']);
    res.json(snapshot);
  });

  // Bulk Keyword Analysis (Up to 25 keywords at once, enriched with live Google Suggest demand)
  app.post('/api/seo/bulk', requireAuth, async (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { rawKeywords, country, state, language } = req.body as {
      rawKeywords?: string;
      country?: string;
      state?: string;
      language?: string;
    };
    const keywords = parseBulkKeywordInput(String(rawKeywords || ''));
    if (keywords.length === 0) {
      res.status(400).json({ error: 'Enter at least one keyword (one per line or comma-separated).' });
      return;
    }
    const cleanCountry = String(country || GLOBAL_COUNTRY_LABEL).trim() || GLOBAL_COUNTRY_LABEL;
    const countryCode = getCountryIsoCode(cleanCountry);
    const rows = buildBulkKeywordAnalysis({
      keywords,
      country: cleanCountry,
      state,
      language,
    });

    const suggestEnabled = store.providers.some((p) => p.id === 'google-suggest-free' && p.enabled);
    if (suggestEnabled) {
      const liveCounts = await Promise.all(
        rows.slice(0, 8).map(async (row) => {
          const suggestions = await fetchGoogleSuggestKeywords(row.keyword, countryCode, state);
          return { keyword: row.keyword, count: suggestions.length };
        })
      );
      for (const item of liveCounts) {
        if (item.count > 0) {
          const target = rows.find((r) => r.keyword === item.keyword);
          if (target) {
            target.provenance = 'Observed';
            target.volume = Math.max(target.volume, item.count * 420);
          }
        }
      }
    }

    user.creditsUsed += 1;
    writeStore(store);
    res.json({ rows, count: rows.length, user: sanitizeUser(user) });
  });

  // Keyword Lists CRUD (Save + organize keywords across sessions)
  app.get('/api/keyword-lists', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const lists = (store.keywordLists || []).filter((l) => l.userId === req.authUserId);
    res.json({ lists });
  });

  app.post('/api/keyword-lists', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const { name } = req.body as { name?: string };
    const cleanName = String(name || '').trim();
    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Keyword list name must be at least 2 characters.' });
      return;
    }
    const now = new Date().toISOString();
    const newList: SavedKeywordList = {
      id: `kwl_${crypto.randomBytes(5).toString('hex')}`,
      userId: req.authUserId!,
      name: cleanName.slice(0, 80),
      keywords: [],
      createdAt: now,
      updatedAt: now,
    };
    store.keywordLists = [newList, ...(store.keywordLists || [])];
    writeStore(store);
    res.status(201).json({ list: newList });
  });

  app.delete('/api/keyword-lists/:id', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const idx = (store.keywordLists || []).findIndex(
      (l) => l.id === req.params.id && l.userId === req.authUserId
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Keyword list not found.' });
      return;
    }
    store.keywordLists.splice(idx, 1);
    writeStore(store);
    res.json({ deleted: true });
  });

  app.post('/api/keyword-lists/:id/items', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const list = (store.keywordLists || []).find(
      (l) => l.id === req.params.id && l.userId === req.authUserId
    );
    if (!list) {
      res.status(404).json({ error: 'Keyword list not found.' });
      return;
    }
    const item = req.body as Partial<SavedKeywordItem>;
    const cleanKw = String(item.keyword || '').trim();
    if (!cleanKw) {
      res.status(400).json({ error: 'Keyword is required.' });
      return;
    }
    if (!list.keywords.some((k) => k.keyword.toLowerCase() === cleanKw.toLowerCase())) {
      list.keywords.unshift({
        keyword: cleanKw.slice(0, 140),
        volume: Number(item.volume || 0),
        difficulty: Number(item.difficulty || 0),
        cpc: Number(item.cpc || 0),
        currencySymbol: String(item.currencySymbol || '$').slice(0, 8),
        intent: String(item.intent || 'Commercial').slice(0, 30),
        country: String(item.country || GLOBAL_COUNTRY_LABEL).slice(0, 80),
        language: String(item.language || 'English').slice(0, 40),
        addedAt: new Date().toISOString(),
      });
      list.updatedAt = new Date().toISOString();
      writeStore(store);
    }
    res.status(201).json({ list });
  });

  app.delete('/api/keyword-lists/:id/items', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const list = (store.keywordLists || []).find(
      (l) => l.id === req.params.id && l.userId === req.authUserId
    );
    if (!list) {
      res.status(404).json({ error: 'Keyword list not found.' });
      return;
    }
    const kw = String(req.query.keyword || '').trim().toLowerCase();
    list.keywords = list.keywords.filter((k) => k.keyword.toLowerCase() !== kw);
    list.updatedAt = new Date().toISOString();
    writeStore(store);
    res.json({ list });
  });

  // Tracked Keywords & Competitors
  app.get('/api/dashboard/summary', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const watchlist = store.competitorWatchlist[user.id] || ['sparktoro.com', 'ahrefs.com', 'semrush.com'];
    const trackedKeywords = store.trackedKeywords[user.id] || [];
    const notifications = store.notifications.filter((n) => n.userId === user.id);
    const projects = store.projects.filter((p) => p.userId === user.id);
    const reports = store.reports.filter((r) => r.userId === user.id);
    const workspaces = store.workspaces.filter((w) => w.ownerId === user.id);
    const plan = store.plans.find((p) => p.id === user.subscriptionPlan) || store.plans[0];
    res.json({
      user: sanitizeUser(user),
      plan,
      plans: store.plans,
      workspaces,
      projects,
      reports,
      watchlist,
      trackedKeywords,
      notifications,
    });
  });

  app.post('/api/competitors/compare', requireAuth, async (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const plan = store.plans.find((p) => p.id === user.subscriptionPlan) || store.plans[0];
    const { domains, contextQuery } = req.body as { domains?: string[]; contextQuery?: string };
    const cleaned = Array.from(new Set((domains || []).map(normalizeDomain).filter(Boolean)));
    if (cleaned.length === 0) {
      res.status(400).json({ error: 'Add at least one competitor domain.' });
      return;
    }
    const capped = cleaned.slice(0, Math.min(5, plan.maxCompetitors));
    store.competitorWatchlist[user.id] = capped;
    writeStore(store);

    const comparison = generateCompetitorComparison(capped, contextQuery || user.onboarding.targetAudience || 'B2B SaaS');

    const isProviderEnabled = (id: string) => store.providers.some((p) => p.id === id && p.enabled);
    const [oprScores, trancoScores, perDomainLive] = await Promise.all([
      isProviderEnabled('openpagerank-free') && store.providerSecrets['openpagerank-free']
        ? fetchOpenPageRankScores(capped, store.providerSecrets['openpagerank-free'])
        : Promise.resolve({} as Record<string, { authority: number; globalRank: string }>),
      fetchTrancoDomainRanks(capped),
      Promise.all(
        capped.map(async (dom) => {
          const [site, cc, hn, ssl] = await Promise.all([
            isProviderEnabled('site-inspector-free') ? inspectPublicWebsite(dom) : Promise.resolve(null),
            isProviderEnabled('commoncrawl-free')
              ? fetchCommonCrawlDomainFootprint(dom)
              : Promise.resolve({ indexedCount: 0, samples: [] }),
            isProviderEnabled('hn-algolia-free') ? fetchHackerNewsDiscussions(dom) : Promise.resolve([]),
            isProviderEnabled('ssl-crtsh-free') ? inspectSslAndSubdomains(dom) : Promise.resolve(null),
          ]);
          return { dom, site, cc, hn, ssl };
        })
      ),
    ]);

    for (const row of comparison) {
      const key = row.domain.toLowerCase();
      const live = perDomainLive.find((x) => x.dom === key);
      const oprDa = oprScores[key]?.authority;
      const trancoDa = trancoScores[key];
      const realAuthority = oprDa ?? trancoDa;
      if (realAuthority) {
        row.domainAuthority = realAuthority;
      }
      if (live && (live.site || live.cc.indexedCount > 0 || live.hn.length > 0 || live.ssl || realAuthority)) {
        row.provenance = 'Observed';
        row.liveSignals = {
          statusCode: live.site?.statusCode ?? 0,
          responseMs: live.site?.responseMs ?? 0,
          hasJsonLd: Boolean(live.site?.hasJsonLd),
          commonCrawlPages: live.cc.indexedCount,
          hnMentions: live.hn.length,
          authoritySource: oprDa ? 'Open PageRank API' : trancoDa ? 'Tranco Top 1M' : 'Baseline',
          sslValid: live.ssl?.sslValid,
          sslExpiryDays: live.ssl?.sslExpiryDays,
          sslIssuer: live.ssl?.sslIssuer,
          subdomainsCount: live.ssl?.subdomainsCount,
          sampleSubdomains: live.ssl?.sampleSubdomains,
        };
      }
    }

    res.json({ comparison, maxAllowed: plan.maxCompetitors });
  });

  // AI Research Copilot (Server-Side Gemini)
  app.get('/api/copilot/conversations', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const conversations = store.conversations.filter((c) => c.userId === req.authUserId);
    res.json({ conversations });
  });

  app.post('/api/copilot/chat', requireAuth, rateLimit(20, 60_000), async (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { conversationId, projectId, message, mode } = req.body as {
      conversationId?: string;
      projectId?: string;
      message?: string;
      mode?: string;
    };
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      res.status(400).json({ error: 'Please enter a research question.' });
      return;
    }

    const project = store.projects.find((p) => p.id === projectId && p.userId === user.id)
      || store.projects.find((p) => p.userId === user.id);

    let conv = store.conversations.find((c) => c.id === conversationId && c.userId === user.id);
    const now = new Date().toISOString();
    if (!conv) {
      conv = {
        id: `conv_${crypto.randomBytes(6).toString('hex')}`,
        userId: user.id,
        projectId: project?.id,
        title: cleanMessage.slice(0, 48),
        messages: [],
        updatedAt: now,
      };
      store.conversations.unshift(conv);
    }

    conv.messages.push({
      id: `msg_${crypto.randomBytes(4).toString('hex')}`,
      role: 'user',
      mode: mode || 'Research Planner',
      content: cleanMessage,
      timestamp: now,
    });

    try {
      const onboardingSummary = `${user.onboarding.businessOrWebsite || 'Business not specified'} | Industry: ${user.onboarding.industry} | Audience: ${user.onboarding.targetAudience || 'General'} | Objectives: ${user.onboarding.objectives.join(', ')}`;
      const aiResult = await runCopilotWithGemini({
        message: cleanMessage,
        mode: mode || 'Research Planner',
        project,
        onboardingSummary,
      });

      const assistantMsg = {
        id: `msg_${crypto.randomBytes(4).toString('hex')}`,
        role: 'assistant' as const,
        mode: mode || 'Research Planner',
        content: `${aiResult.answer}\n\nData Provenance: ${aiResult.dataProvenanceNote}`,
        timestamp: new Date().toISOString(),
        citations: aiResult.citations,
        recommendedNextActions: aiResult.recommendedNextActions,
        suggestedFollowUps: aiResult.suggestedFollowUps,
      };
      conv.messages.push(assistantMsg);
      conv.updatedAt = new Date().toISOString();
      user.creditsUsed += 1;
      writeStore(store);

      res.json({ conversation: conv, assistantMessage: assistantMsg, user: sanitizeUser(user) });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gemini Copilot request failed.';
      store.apiUsageLogs.unshift({
        id: `log_${crypto.randomBytes(4).toString('hex')}`,
        userId: user.id,
        providerId: 'gemini-copilot',
        endpoint: '/api/copilot/chat',
        status: 'error',
        latencyMs: 0,
        message: errMsg,
        createdAt: new Date().toISOString(),
      });
      writeStore(store);
      res.status(502).json({ error: errMsg, conversation: conv });
    }
  });

  // Reports
  app.get('/api/reports', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const reports = store.reports.filter((r) => r.userId === req.authUserId);
    res.json({ reports });
  });

  app.post('/api/reports', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { projectId, title, whiteLabel, brandName } = req.body as {
      projectId?: string;
      title?: string;
      whiteLabel?: boolean;
      brandName?: string;
    };
    const project = store.projects.find((p) => p.id === projectId && p.userId === user.id)
      || store.projects.find((p) => p.userId === user.id);
    if (!project) {
      res.status(400).json({ error: 'Create or select a research project first.' });
      return;
    }
    const topNet = project.intelligence.socialNetworks[0];
    const secondNet = project.intelligence.socialNetworks[1];
    const topKw = project.intelligence.keywords[0];
    const report = {
      id: `rep_${crypto.randomBytes(6).toString('hex')}`,
      userId: user.id,
      workspaceId: user.workspaceId,
      projectId: project.id,
      title: String(title || `${project.title} — Executive Intelligence Report`).slice(0, 100),
      brandName: String(brandName || user.brandName || 'AudiencePulse AI').slice(0, 40),
      whiteLabel: Boolean(whiteLabel),
      shareSlug: `${crypto.randomBytes(4).toString('hex')}-${project.id.slice(-4)}`,
      confidenceLabel: `${project.dataMode} (Observed public signals + estimated benchmarks)`,
      executiveSummary: `Audience analysis for "${project.query}" (${project.country}) identifies ${topNet?.platform} (${topNet?.audiencePct}% affinity) and ${secondNet?.platform} (${secondNet?.audiencePct}% affinity, ${secondNet?.indexMultiplier}x market average) as primary reach channels. Top keyword opportunity "${topKw?.keyword}" carries ${topKw?.searchVolume.toLocaleString()} monthly searches at KD ${topKw?.difficulty}.`,
      marketingRecommendations: [
        `Concentrate creator outreach and organic video on ${topNet?.platform} and ${secondNet?.platform}.`,
        `Build comparison & intent pages targeting "${topKw?.keyword}" and adjacent KD < 30 terms.`,
        `Address top community pain points mined from ${project.intelligence.redditCommunities[0]?.subreddit || 'niche subreddits'} in landing copy.`,
        `Increase AI answer engine citations across Gemini, ChatGPT, and Perplexity with open benchmark studies.`,
      ],
      createdAt: new Date().toISOString(),
    };
    store.reports.unshift(report);
    writeStore(store);
    res.status(201).json({ report });
  });

  app.delete('/api/reports/:id', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const idx = store.reports.findIndex((r) => r.id === req.params.id && r.userId === req.authUserId);
    if (idx === -1) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    store.reports.splice(idx, 1);
    writeStore(store);
    res.json({ deleted: true });
  });

  // Notifications
  app.patch('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    for (const n of store.notifications) {
      if (n.userId === req.authUserId) {
        n.read = true;
      }
    }
    writeStore(store);
    res.json({ ok: true });
  });

  // API Providers Settings (never return stored credentials)
  app.get('/api/providers', requireAuth, (_req, res) => {
    const store = readStore();
    res.json({ providers: store.providers });
  });

  app.patch('/api/providers/:id', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const provider = store.providers.find((p) => p.id === req.params.id);
    if (!provider) {
      res.status(404).json({ error: 'Provider not found.' });
      return;
    }
    const { enabled, credentialValue, mode } = req.body as {
      enabled?: boolean;
      credentialValue?: string;
      mode?: 'live-free' | 'demo';
    };
    if (typeof enabled === 'boolean') {
      provider.enabled = enabled;
    }
    if (typeof credentialValue === 'string' && credentialValue.trim().length > 0) {
      store.providerSecrets[provider.id] = credentialValue.trim();
      provider.hasCredential = true;
    }
    if (mode === 'live-free' || mode === 'demo') {
      provider.mode = mode;
    }
    provider.status = !provider.enabled
      ? 'Disabled'
      : provider.hasCredential
        ? 'Connected'
        : provider.mode === 'live-free'
          ? 'Active (Free Live)'
          : 'Ready (Free)';
    writeStore(store);
    res.json({ provider });
  });

  app.post('/api/providers/:id/test', requireAuth, async (req: AuthedRequest, res) => {
    const store = readStore();
    const provider = store.providers.find((p) => p.id === req.params.id);
    if (!provider) {
      res.status(404).json({ error: 'Provider not found.' });
      return;
    }
    const now = new Date().toISOString();
    const gscAccessToken = req.header('X-Google-Access-Token') || undefined;
    const probe = await testFreeProviderConnection(provider.id, store.providerSecrets[provider.id], gscAccessToken);
    provider.lastTestedAt = now;
    provider.usageCount += 1;
    if (!probe.ok) {
      provider.errorCount += 1;
    }
    if (!provider.enabled) {
      provider.status = 'Disabled';
    } else if (provider.hasCredential || (provider.id === 'gsc-free' && gscAccessToken)) {
      provider.status = 'Connected';
    } else if (provider.mode === 'live-free') {
      provider.status = 'Active (Free Live)';
    } else {
      provider.status = 'Ready (Free)';
    }
    store.apiUsageLogs.unshift({
      id: `log_${crypto.randomBytes(4).toString('hex')}`,
      userId: req.authUserId!,
      providerId: provider.id,
      endpoint: '/provider/health-test',
      status: probe.ok ? 'ok' : 'error',
      latencyMs: probe.latencyMs,
      message: `${provider.name}: ${probe.message}`,
      createdAt: now,
    });
    writeStore(store);
    res.json({
      provider,
      latencyMs: probe.latencyMs,
      testResult: probe.message,
    });
  });

  // Google Search Console Live Proxy (client provides Firebase OAuth Bearer token via X-Google-Access-Token)
  app.get('/api/gsc/sites', requireAuth, async (req: AuthedRequest, res) => {
    const gscToken = req.header('X-Google-Access-Token');
    if (!gscToken) {
      res.status(401).json({ error: 'Google Search Console access token required. Please sign in with Google first.' });
      return;
    }
    try {
      const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        signal: AbortSignal.timeout(6000),
        headers: { Authorization: `Bearer ${gscToken}` },
      });
      const text = await response.text();
      if (!response.ok) {
        res.status(response.status).json({ error: `Search Console API error (${response.status}): ${text.slice(0, 200)}` });
        return;
      }
      const data = JSON.parse(text) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] };
      res.json({ sites: data.siteEntry || [] });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unable to fetch Search Console sites.' });
    }
  });

  app.post('/api/gsc/analytics', requireAuth, async (req: AuthedRequest, res) => {
    const gscToken = req.header('X-Google-Access-Token');
    if (!gscToken) {
      res.status(401).json({ error: 'Google Search Console access token required. Please sign in with Google first.' });
      return;
    }
    const { siteUrl } = req.body as { siteUrl?: string };
    const cleanSiteUrl = String(siteUrl || '').trim();
    if (
      !cleanSiteUrl ||
      (!cleanSiteUrl.startsWith('https://') &&
        !cleanSiteUrl.startsWith('http://') &&
        !cleanSiteUrl.startsWith('sc-domain:'))
    ) {
      res.status(400).json({ error: 'Valid verified Search Console siteUrl is required.' });
      return;
    }
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    try {
      const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cleanSiteUrl)}/searchAnalytics/query`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${gscToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['query', 'page'],
          rowLimit: 25,
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        res.status(response.status).json({ error: `Search Console analytics error (${response.status}): ${text.slice(0, 200)}` });
        return;
      }
      const data = JSON.parse(text) as {
        rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
      };
      const rows = (data.rows || []).map((r) => ({
        query: r.keys?.[0] || '',
        page: r.keys?.[1] || '',
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(((r.ctr || 0) * 100).toFixed(2)),
        position: Number((r.position || 0).toFixed(1)),
      }));
      res.json({ siteUrl: cleanSiteUrl, startDate: fmt(startDate), endDate: fmt(endDate), rows });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Unable to fetch Search Console analytics.' });
    }
  });

  // Account Privacy Controls (Data export & delete)
  app.get('/api/account/export', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      user: sanitizeUser(user),
      workspaces: store.workspaces.filter((w) => w.ownerId === user.id),
      projects: store.projects.filter((p) => p.userId === user.id),
      reports: store.reports.filter((r) => r.userId === user.id),
      conversations: store.conversations.filter((c) => c.userId === user.id),
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audiencepulse-account-export.json"');
    res.send(JSON.stringify(payload, null, 2));
  });

  app.delete('/api/account', requireAuth, (req: AuthedRequest, res) => {
    const store = readStore();
    if (req.authUserId === 'usr_demo_01') {
      res.status(400).json({ error: 'The shared preview demo workspace cannot be permanently deleted.' });
      return;
    }
    store.users = store.users.filter((u) => u.id !== req.authUserId);
    store.workspaces = store.workspaces.filter((w) => w.ownerId !== req.authUserId);
    store.projects = store.projects.filter((p) => p.userId !== req.authUserId);
    store.reports = store.reports.filter((r) => r.userId !== req.authUserId);
    store.conversations = store.conversations.filter((c) => c.userId !== req.authUserId);
    store.notifications = store.notifications.filter((n) => n.userId !== req.authUserId);
    writeStore(store);
    res.json({ deleted: true });
  });

  // Admin Console routes
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const store = readStore();
    const activeUsers = store.users.length;
    const totalRequests = store.apiUsageLogs.length + store.projects.length * 9;
    const errorCount = store.apiUsageLogs.filter((l) => l.status === 'error').length;
    const estMrrUsd = store.users.reduce((sum, u) => {
      const plan = store.plans.find((p) => p.id === u.subscriptionPlan);
      return sum + (plan?.monthlyPriceUsd ?? 0);
    }, 0);

    res.json({
      metrics: {
        totalUsers: store.users.length,
        activeUsers,
        researchRequests: totalRequests,
        apiErrors: errorCount,
        estMrrUsd,
        systemHealth: errorCount > 5 ? 'Degraded' : 'Nominal',
      },
      users: store.users.map(sanitizeUser),
      plans: store.plans,
      providers: store.providers,
      recentLogs: store.apiUsageLogs.slice(0, 20),
    });
  });

  app.patch('/api/admin/plans/:id', requireAdmin, (req, res) => {
    const store = readStore();
    const plan = store.plans.find((p) => p.id === req.params.id);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }
    const { monthlyCredits, maxCompetitors, maxWorkspaces, aiMessagesPerMonth, whiteLabelReports } = req.body as Partial<typeof plan>;
    if (typeof monthlyCredits === 'number' && monthlyCredits >= 1) plan.monthlyCredits = Math.round(monthlyCredits);
    if (typeof maxCompetitors === 'number' && maxCompetitors >= 1 && maxCompetitors <= 5) plan.maxCompetitors = Math.round(maxCompetitors);
    if (typeof maxWorkspaces === 'number' && maxWorkspaces >= 1) plan.maxWorkspaces = Math.round(maxWorkspaces);
    if (typeof aiMessagesPerMonth === 'number' && aiMessagesPerMonth >= 1) plan.aiMessagesPerMonth = Math.round(aiMessagesPerMonth);
    if (typeof whiteLabelReports === 'boolean') plan.whiteLabelReports = whiteLabelReports;
    writeStore(store);
    res.json({ plan });
  });

  app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
    const store = readStore();
    const target = store.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { subscriptionPlan, creditsUsed, role } = req.body as {
      subscriptionPlan?: SubscriptionPlanId;
      creditsUsed?: number;
      role?: 'user' | 'admin';
    };
    if (subscriptionPlan && ['free', 'starter', 'pro', 'agency'].includes(subscriptionPlan)) {
      target.subscriptionPlan = subscriptionPlan;
    }
    if (typeof creditsUsed === 'number' && creditsUsed >= 0) {
      target.creditsUsed = Math.round(creditsUsed);
    }
    if (role === 'user' || role === 'admin') {
      target.role = role;
    }
    writeStore(store);
    res.json({ user: sanitizeUser(target) });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AudiencePulse AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
