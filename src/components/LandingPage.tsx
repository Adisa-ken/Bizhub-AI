import { useState } from 'react';
import { ArrowRight, ChevronDown, Globe, Moon, Search, Sparkles, Sun, Users } from 'lucide-react';
import { generateAudienceProfile } from '../lib/intelligence';
import type { PlanConfig } from '../types';
import { AudienceComparisonChart } from './Charts';

interface LandingPageProps {
  brandName: string;
  plans: PlanConfig[];
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAuth: (mode: 'login' | 'register', prefillQuery?: string) => void;
  onInstantDemo: (prefillQuery?: string) => void;
}

const FAQS = [
  {
    q: 'How does AudiencePulse AI combine audience research and SEO into one workflow?',
    a: 'Every research project links 9 audience intelligence modules (social usage, demographics, AI search visibility, websites visited, keywords, media, Reddit, public creators, and topics) directly to 12 SEO tools and our AI Research Copilot so keyword plans reflect where your buyers actually pay attention.',
  },
  {
    q: 'Do I need paid third-party SEO or social API keys to get started?',
    a: 'Never. Built-in free live adapters (Google Suggest, Reddit Public JSON, Hacker News Algolia, Wikimedia OpenSearch, DuckDuckGo, and SSRF-safe Site Inspector) run at $0 cost out of the box, alongside optional free-quota Google Search Console, YouTube, PageSpeed, and self-hosted SearXNG or LibreCrawl endpoints.',
  },
  {
    q: 'Does AudiencePulse AI access private search histories or private follow lists?',
    a: 'Never. We strictly distinguish observed public profiles, aggregated market estimates, and AI-inferred recommendations. No private user search logs or private follow graphs are ever claimed or accessed.',
  },
  {
    q: 'Can agencies manage multiple clients and export white-label reports?',
    a: 'Yes. Pro and Agency plans support multi-workspace switching, custom brand names on reports, CSV and Excel exports, shareable links, and print-ready PDF briefs.',
  },
];

export function LandingPage({
  brandName,
  plans,
  darkMode,
  onToggleDarkMode,
  onOpenAuth,
  onInstantDemo,
}: LandingPageProps) {
  const [previewQuery, setPreviewQuery] = useState('B2B SaaS Growth Leaders');
  const [activePreviewTab, setActivePreviewTab] = useState<'social' | 'keywords' | 'reddit' | 'ai'>('social');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactOpen, setContactOpen] = useState<'privacy' | 'terms' | 'contact' | 'api' | null>(null);

  const previewData = generateAudienceProfile(previewQuery, 'United States', 'English', 'B2B SaaS & Marketing');

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInstantDemo(previewQuery.trim() || 'B2B SaaS Growth Leaders');
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] dark:bg-[#0D1021] text-[#171B35] dark:text-slate-100">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#11152B]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-display font-bold tracking-tight text-[#171B35] dark:text-white whitespace-nowrap shrink-0"
          >
            {brandName}
          </a>

          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-[#565FEA] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#audience-research" className="hover:text-[#565FEA] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Audience Research
            </a>
            <a href="#seo-tools" className="hover:text-[#565FEA] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              SEO Tools
            </a>
            <a href="#pricing" className="hover:text-[#565FEA] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-[#565FEA] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Login
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register', previewQuery)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#565FEA] text-white hover:bg-[#464ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Run Free Audience Research
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="bg-[#171B35] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <p className="text-sm font-medium text-[#FFE500]">
              Audience Intelligence · 12-Tool SEO Suite · AI Research Copilot
            </p>
            <h1
              className="font-display font-bold tracking-tight leading-[1.08] text-white"
              style={{ fontSize: 'clamp(2.25rem, 4.1vw, 3.75rem)', textWrap: 'balance' }}
            >
              Discover who your customers are,{' '}
              <span className="bg-[#FFE500] text-[#171B35] px-2 rounded-md inline-block">
                where they spend time
              </span>{' '}
              and what they search for.
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              Combine SparkToro-grade audience discovery, Ahrefs-style keyword and backlink research, competitor traffic
              intelligence, and a Gemini-powered Research Copilot in one unified workspace.
            </p>

            <form onSubmit={handleHeroSubmit} className="flex flex-col sm:flex-row gap-3 max-w-2xl pt-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <label htmlFor="hero-audience-input" className="sr-only">
                  Enter an audience, niche, or domain
                </label>
                <input
                  id="hero-audience-input"
                  type="text"
                  value={previewQuery}
                  onChange={(e) => setPreviewQuery(e.target.value)}
                  placeholder="Try: B2B SaaS Founders, Shopify Store Owners, or domain.com"
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white text-[#171B35] placeholder:text-slate-400 text-sm font-medium focus:outline-2 focus:outline-[#FFE500]"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 rounded-xl bg-[#FFE500] text-[#171B35] font-bold text-sm hover:bg-[#F5DC00] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Run Free Audience Research
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300 pt-1">
              <span>Free tier included — no card required</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onInstantDemo(previewQuery)}
                className="underline underline-offset-4 hover:text-[#FFE500] cursor-pointer"
              >
                Explore live demo workspace
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="underline underline-offset-4 hover:text-[#FFE500] cursor-pointer"
              >
                Sign in to existing account
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex">
            <div className="w-full rounded-2xl overflow-hidden border border-slate-700/80 bg-[#1F2547] flex flex-col">
              <div className="relative flex-1 min-h-[240px] bg-gradient-to-br from-[#565FEA]/30 to-[#171B35]">
                <img
                  src="/src/assets/images/marketing_studio_scene_1795559611994.jpg"
                  alt="Marketing strategists reviewing audience and keyword analytics in a modern studio"
                  referrerPolicy="no-referrer"
                  className="w-full h-full lg:h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#171B35]/90 via-[#171B35]/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-xs font-medium text-[#FFE500]">Live Intelligence Snapshot</p>
                  <p className="text-sm font-semibold mt-0.5">
                    {previewData.query} · {previewData.summary.topPlatform} ({previewData.summary.topPlatformAffinity}% affinity)
                  </p>
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3 border-t border-slate-700/80 text-center">
                <div>
                  <div className="text-lg font-mono font-semibold tabular-nums text-white">9</div>
                  <div className="text-[11px] text-slate-300">Audience Modules</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-semibold tabular-nums text-white">12</div>
                  <div className="text-[11px] text-slate-300">SEO Tools</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-semibold tabular-nums text-[#FFE500]">5</div>
                  <div className="text-[11px] text-slate-300">Rival Matrix</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Product Preview */}
      <section id="audience-research" className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">
              01. Interactive Product Preview · Demonstration Dataset
            </p>
            <h2 className="text-3xl font-display font-bold tracking-tight text-[#171B35] dark:text-white">
              See where "{previewData.query}" spends time before spending a dollar
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-xl">
            {[
              { id: 'social', label: 'Social Networks' },
              { id: 'keywords', label: 'Search Keywords' },
              { id: 'reddit', label: 'Reddit Insights' },
              { id: 'ai', label: 'AI Search Visibility' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePreviewTab(tab.id as typeof activePreviewTab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activePreviewTab === tab.id
                    ? 'bg-[#565FEA] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:p-8">
          {activePreviewTab === 'social' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8">
                <h3 className="text-base font-semibold mb-4">Preferred Social Networks vs. Market Average</h3>
                <AudienceComparisonChart data={previewData.socialNetworks.slice(0, 7)} />
              </div>
              <div className="lg:col-span-4 space-y-4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-6 lg:pt-0 lg:pl-6">
                <h3 className="text-base font-semibold">What AudiencePulse AI Discovers</h3>
                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <li>
                    <strong className="text-[#171B35] dark:text-white">Channel Over-Indexing:</strong> Compare audience
                    affinity directly against general internet baselines.
                  </li>
                  <li>
                    <strong className="text-[#171B35] dark:text-white">High-Intent Keywords:</strong> Filter by KD,
                    CPC, buyer intent, questions, and trending demand.
                  </li>
                  <li>
                    <strong className="text-[#171B35] dark:text-white">Community Pain Points:</strong> Extract customer
                    complaints and FAQs from niche Reddit communities.
                  </li>
                  <li>
                    <strong className="text-[#171B35] dark:text-white">AI Search Citations:</strong> Benchmark brand
                    visibility inside Gemini, ChatGPT, Claude, and Perplexity.
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => onInstantDemo(previewQuery)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#171B35] dark:bg-[#565FEA] text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Open Full 9-Module Report
                </button>
              </div>
            </div>
          )}

          {activePreviewTab === 'keywords' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                    <th className="pb-3 font-medium">Keyword</th>
                    <th className="pb-3 font-medium text-right">Volume</th>
                    <th className="pb-3 font-medium text-right">KD</th>
                    <th className="pb-3 font-medium text-right">CPC</th>
                    <th className="pb-3 font-medium">Intent</th>
                    <th className="pb-3 font-medium text-right">Gap Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewData.keywords.slice(0, 6).map((kw) => (
                    <tr key={kw.keyword} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 font-medium text-[#171B35] dark:text-white">{kw.keyword}</td>
                      <td className="py-3 text-right font-mono tabular-nums">{kw.searchVolume.toLocaleString()}</td>
                      <td className="py-3 text-right font-mono tabular-nums">{kw.difficulty}</td>
                      <td className="py-3 text-right font-mono tabular-nums">${kw.cpcUsd.toFixed(2)}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{kw.intent}</td>
                      <td className="py-3 text-right font-mono tabular-nums font-semibold text-[#638D50] dark:text-[#8BC374]">
                        {kw.gapOpportunityScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePreviewTab === 'reddit' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {previewData.redditCommunities.map((sub) => (
                <div key={sub.subreddit} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#565FEA] dark:text-[#8E96FF]">{sub.subreddit}</span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {sub.subscribersEst} · {sub.audienceMatchPct}% match
                    </span>
                  </div>
                  <p className="text-sm font-medium">{sub.popularDiscussion}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Common Complaint: {sub.customerComplaint}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activePreviewTab === 'ai' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {previewData.searchAndAi.map((engine) => (
                <div key={engine.platform} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{engine.platform}</span>
                    <span className="text-xs font-mono tabular-nums text-[#565FEA] dark:text-[#8E96FF]">
                      {engine.visibilityScore}/100
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {engine.type} · {engine.audienceAdoptionPct}% audience adoption
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Next citation move: {engine.citationOpportunities[0]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Capabilities Asymmetric Bento Showcase */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-12">
        <div className="max-w-2xl mb-8 space-y-2">
          <p className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">02. Unified Marketing Stack</p>
          <h2 className="text-3xl font-display font-bold tracking-tight">
            Four intelligence engines working from one shared customer memory
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">Audience Intelligence</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-xl font-display font-bold">9-Module Audience Intelligence Engine</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Map social networks, demographics, AI search adoption, website overlap, search keywords, podcasts and
              newsletters, Reddit communities, public creators, and buying pain points in one connected profile.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
              <span>· Social Networks</span>
              <span>· Demographics</span>
              <span>· Search &amp; AI Tools</span>
              <span>· Website Visitation</span>
              <span>· Search Keywords</span>
              <span>· Media &amp; Podcasts</span>
              <span>· Reddit Communities</span>
              <span>· Public Creators</span>
              <span>· Topics &amp; Clusters</span>
            </div>
          </div>

          <div id="seo-tools" className="lg:col-span-5 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#FF704D]">Advanced SEO Toolkit</span>
              <Globe className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-xl font-display font-bold">12 Actionable SEO &amp; GEO Tools</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Keyword Explorer, SERP Analyzer, Website &amp; Backlink Explorers, Keyword &amp; Content Gaps, Rank Tracker,
              Technical Audit, Search Intent, and AI Search Visibility Tracker.
            </p>
            <button
              type="button"
              onClick={() => onInstantDemo(previewQuery)}
              className="text-sm font-semibold text-[#565FEA] dark:text-[#8E96FF] hover:underline cursor-pointer"
            >
              Launch SEO Toolkit in Demo &rarr;
            </button>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
            <span className="text-xs font-semibold text-[#638D50] dark:text-[#8BC374]">Competitor Intelligence</span>
            <h3 className="text-xl font-display font-bold">Compare Up to 5 Competitors Side-by-Side</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Benchmark organic traffic estimates, top keywords, best-performing pages, backlink profiles, paid search,
              and audience overlap across five domains at once.
            </p>
          </div>

          <div className="lg:col-span-7 bg-[#171B35] text-white border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#FFE500]">AI Research Copilot</span>
              <Sparkles className="w-4 h-4 text-[#FFE500]" />
            </div>
            <h3 className="text-xl font-display font-bold">Turn Raw Research Into 30-Day Execution Plans</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Ask natural-language questions connected directly to your active research project. Includes Research
              Planner, Opportunity Finder, Buyer Intent Detector, Content Strategy Generator, and next-step prompts.
            </p>
          </div>
        </div>
      </section>

      {/* Demo Testimonials (Explicitly labelled) */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            03. Sample Customer Perspectives (Demonstration Placeholders)
          </p>
          <h2 className="text-2xl font-display font-bold tracking-tight">
            Built for marketing teams, SEO leads, and agencies
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-start gap-4">
            <img
              src="/src/assets/images/strategist_avatar_1795559611276.jpg"
              alt="Placeholder portrait of Sarah Jenkins, Head of Growth"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-200"
            />
            <div className="space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                “Replacing guesswork with audience-vs-average channel charts cut our wasted ad spend and surfaced three
                low-KD comparison clusters in our first afternoon.”
              </p>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-[#171B35] dark:text-white">Sarah Jenkins</strong> · Head of Growth, Northstar Cloud
                (Illustrative Placeholder)
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-start gap-4">
            <img
              src="/src/assets/images/director_avatar_1795559611779.jpg"
              alt="Placeholder portrait of Marcus Vance, Agency Managing Partner"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-200"
            />
            <div className="space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                “Client onboarding used to take four disconnected spreadsheets. Now we generate branded audience,
                Reddit, and AI search briefs from a single workspace.”
              </p>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-[#171B35] dark:text-white">Marcus Vance</strong> · Managing Partner, SignalPeak Digital
                (Illustrative Placeholder)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-14">
        <div className="max-w-2xl mb-8 space-y-2">
          <p className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">04. Transparent Plans</p>
          <h2 className="text-3xl font-display font-bold tracking-tight">Start free, scale when your team needs more</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 flex flex-col justify-between border ${
                plan.id === 'pro'
                  ? 'bg-[#171B35] text-white border-[#565FEA]'
                  : 'bg-white dark:bg-[#151A33] border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-display font-bold">{plan.name}</h3>
                  <p className={`text-xs mt-1 ${plan.id === 'pro' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {plan.audienceTag}
                  </p>
                </div>
                <div className="text-3xl font-mono font-bold tabular-nums">
                  ${plan.monthlyPriceUsd}
                  <span className="text-xs font-sans font-normal opacity-75"> / month</span>
                </div>
                <ul className={`space-y-2 text-xs ${plan.id === 'pro' ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
                  {plan.highlights.map((h) => (
                    <li key={h}>· {h}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth('register', previewQuery)}
                className={`mt-6 w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                  plan.id === 'pro'
                    ? 'bg-[#FFE500] text-[#171B35] hover:bg-[#F5DC00]'
                    : 'bg-[#565FEA] text-white hover:bg-[#464ED8]'
                }`}
              >
                {plan.monthlyPriceUsd === 0 ? 'Start Free Plan' : `Choose ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-display font-bold tracking-tight mb-6">Frequently Asked Questions</h2>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="p-5">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-semibold text-sm sm:text-base cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11152B] mt-10">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <strong className="text-[#171B35] dark:text-white">{brandName}</strong> · Audience Research, SEO &amp; Marketing Intelligence
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" onClick={() => setContactOpen('api')} className="hover:text-[#565FEA] cursor-pointer">
              API &amp; Resources
            </button>
            <button type="button" onClick={() => setContactOpen('privacy')} className="hover:text-[#565FEA] cursor-pointer">
              Privacy Policy
            </button>
            <button type="button" onClick={() => setContactOpen('terms')} className="hover:text-[#565FEA] cursor-pointer">
              Terms of Service
            </button>
            <button type="button" onClick={() => setContactOpen('contact')} className="hover:text-[#565FEA] cursor-pointer">
              Contact
            </button>
          </div>
        </div>
      </footer>

      {contactOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-display font-bold capitalize">{contactOpen === 'api' ? 'API Integrations & Resources' : contactOpen}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {contactOpen === 'privacy' &&
                'AudiencePulse AI isolates user workspaces, keeps API credentials server-side, never accesses private user search histories or follow graphs, and provides one-click JSON export and account deletion inside Settings.'}
              {contactOpen === 'terms' &&
                'All external provider adapters comply with official API rate limits, licensing terms, and data-retention rules. Demonstration datasets are clearly marked until live provider credentials are connected.'}
              {contactOpen === 'contact' &&
                'Reach our product engineering & agency partnerships desk at hello@audiencepulse.demo or launch the in-app Research Copilot for guided setup.'}
              {contactOpen === 'api' &&
                'Modular server-side free adapters support Google Suggest, Reddit Public JSON, Hacker News Algolia, Wikimedia OpenSearch, DuckDuckGo, Built-in Site Inspector, Google PageSpeed Insights, Search Console, YouTube Free Quota, SearXNG, and LibreCrawl.'}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setContactOpen(null)}
                className="px-4 py-2 rounded-lg bg-[#565FEA] text-white text-sm font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
