import { useState } from 'react';
import { ArrowRight, BarChart3, Bot, FileText, Globe, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { computePlanUsage } from '../lib/intelligence';
import { ALL_STATES_LABEL, formatGeoLabel, GLOBAL_COUNTRY_LABEL } from '../lib/geoAndEngines';
import type { PlanConfig, ResearchProject, SavedReport, UserAccount } from '../types';
import { CountrySelect, SearchEngineSelect, StateMultiSelector } from './GeoEngineControls';

interface DashboardOverviewProps {
  user: UserAccount;
  plan: PlanConfig;
  projects: ResearchProject[];
  reports: SavedReport[];
  watchlist: string[];
  trackedKeywords: { keyword: string; targetDomain: string; position: number; volume: number }[];
  onStartResearch: (payload: {
    query: string;
    country: string;
    state?: string;
    searchEngine?: string;
    language: string;
    industry: string;
  }) => Promise<void>;
  onOpenProject: (project: ResearchProject) => void;
  onDeleteProject: (id: string) => Promise<void>;
  onNavigateTab: (tab: 'overview' | 'audience' | 'seo' | 'competitors' | 'copilot' | 'reports' | 'settings' | 'admin', prompt?: string) => void;
}

export function DashboardOverview({
  user,
  plan,
  projects,
  reports,
  watchlist,
  trackedKeywords,
  onStartResearch,
  onOpenProject,
  onDeleteProject,
  onNavigateTab,
}: DashboardOverviewProps) {
  const [newResearchOpen, setNewResearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState(GLOBAL_COUNTRY_LABEL);
  const [stateRegion, setStateRegion] = useState(ALL_STATES_LABEL);
  const [searchEngine, setSearchEngine] = useState('All Engines');
  const [language, setLanguage] = useState(user.onboarding.preferredLanguage || 'English');
  const [industry, setIndustry] = useState(user.onboarding.industry || 'B2B SaaS & Marketing');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usage = computePlanUsage(user.creditsUsed, plan);
  const latestProject = projects[0];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setError('Enter an audience description, niche, or domain.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onStartResearch({
        query: query.trim(),
        country,
        state: stateRegion,
        searchEngine,
        language,
        industry,
      });
      setQuery('');
      setNewResearchOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run research');
    } finally {
      setSubmitting(false);
    }
  };

  const shortcuts = [
    { label: 'B2B SaaS Founders', query: 'B2B SaaS Founders in North America', tab: 'audience' as const },
    { label: 'Low-KD Commercial Keywords', query: '', tab: 'seo' as const },
    { label: 'Compare 5 Competitors', query: '', tab: 'competitors' as const },
    { label: '30-Day AI Content Plan', query: 'Build a 30-day marketing plan for our top audience', tab: 'copilot' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner + Prominent Start New Research CTA */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">
            {plan.name} Workspace · {user.onboarding.industry || 'Marketing Intelligence'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-[#171B35] dark:text-white">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Run multi-source audience research, inspect 12 SEO intelligence workflows, benchmark competitors, or ask
            the AI Research Copilot for your next strategic move.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setNewResearchOpen((v) => !v)}
            className="px-5 py-3 rounded-xl bg-[#565FEA] text-white font-semibold text-sm hover:bg-[#464ED8] transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Start New Research
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('copilot')}
            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Bot className="w-4 h-4 text-[#565FEA]" />
            Ask AI Copilot
          </button>
        </div>
      </div>

      {/* Inline Start New Research Form */}
      {newResearchOpen && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-[#151A33] border border-[#565FEA]/40 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-bold">New 9-Module Audience &amp; SEO Research</h2>
            <button
              type="button"
              onClick={() => setNewResearchOpen(false)}
              className="text-xs text-slate-500 hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label htmlFor="new-research-query" className="block text-xs font-medium mb-1">
                Audience, Niche, or Domain
              </label>
              <input
                id="new-research-query"
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., Independent Ecommerce Founders"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="new-research-country" className="block text-xs font-medium mb-1">
                Country (All Countries)
              </label>
              <CountrySelect
                id="new-research-country"
                ariaLabel="Country"
                value={country}
                onChange={(next) => {
                  setCountry(next);
                  setStateRegion(ALL_STATES_LABEL);
                }}
              />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="new-research-state" className="block text-xs font-medium mb-1">
                States / Regions (Your Choice)
              </label>
              <StateMultiSelector
                id="new-research-state"
                ariaLabel="Select states or regions"
                country={country}
                value={stateRegion}
                onChange={setStateRegion}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <label htmlFor="new-research-engine" className="block text-xs font-medium mb-1">
                Primary Search / Discovery Engine
              </label>
              <SearchEngineSelect
                id="new-research-engine"
                ariaLabel="Search engine"
                value={searchEngine}
                onChange={setSearchEngine}
                includeAllOption
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="new-research-language" className="block text-xs font-medium mb-1">
                Language
              </label>
              <input
                id="new-research-language"
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="new-research-industry" className="block text-xs font-medium mb-1">
                Industry Context
              </label>
              <input
                id="new-research-industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FFE500] text-[#171B35] font-bold text-sm hover:bg-[#F5DC00] transition-colors cursor-pointer"
              >
                {submitting ? 'Running...' : 'Run Research'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Top Metrics & Usage Limits Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Research Projects</span>
          <div className="text-2xl font-mono font-bold tabular-nums">{projects.length}</div>
          <p className="text-xs text-slate-500">9 interconnected modules each</p>
        </div>
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Top Audience Channel</span>
          <div className="text-2xl font-display font-bold truncate">
            {latestProject?.intelligence.summary.topPlatform || 'YouTube'}
          </div>
          <p className="text-xs text-[#638D50] dark:text-[#8BC374] font-mono tabular-nums">
            {latestProject?.intelligence.summary.topPlatformAffinity || 84}% affinity
          </p>
        </div>
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Tracked Keywords</span>
          <div className="text-2xl font-mono font-bold tabular-nums">{trackedKeywords.length}</div>
          <p className="text-xs text-slate-500">
            Top rank #{trackedKeywords[0]?.position ?? '—'} · {watchlist.length} rivals watched
          </p>
        </div>
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Monthly Credit Usage</span>
            <span className="font-mono tabular-nums font-semibold">
              {user.creditsUsed} / {plan.monthlyCredits}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${usage.isNearLimit ? 'bg-[#FF704D]' : 'bg-[#565FEA]'}`}
              style={{ width: `${usage.pctUsed}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {usage.remaining} credits remaining on {plan.name}
          </p>
        </div>
      </div>

      {/* Quick Research Shortcuts */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold mb-3">Quick Research Shortcuts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {shortcuts.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.tab === 'audience' && item.query) {
                  setQuery(item.query);
                  setNewResearchOpen(true);
                } else {
                  onNavigateTab(item.tab, item.query || undefined);
                }
              }}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left hover:border-[#565FEA] transition-colors flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className="text-sm font-medium">{item.label}</span>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Recent Research Projects + Keyword Summary | AI Recommendations & Competitors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-bold">Recent Research Projects</h2>
              <button
                type="button"
                onClick={() => onNavigateTab('audience')}
                className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF] hover:underline cursor-pointer"
              >
                Open Intelligence Engine
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Search className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-medium">No research projects yet</p>
                <button
                  type="button"
                  onClick={() => setNewResearchOpen(true)}
                  className="px-4 py-2 rounded-lg bg-[#565FEA] text-white text-xs font-semibold cursor-pointer"
                >
                  Start First Research
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map((proj) => (
                  <div key={proj.id} className="py-3.5 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj)}
                      className="text-left min-w-0 flex-1 group cursor-pointer"
                    >
                      <p className="text-sm font-semibold group-hover:text-[#565FEA] truncate">{proj.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatGeoLabel(proj.country, proj.state)} · {proj.searchEngine || 'Google'} · {proj.dataMode} · Top channel: {proj.intelligence.summary.topPlatform}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenProject(proj)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Inspect
                      </button>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteProject(proj.id)}
                          aria-label={`Delete project ${proj.title}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Keyword Tracking & Audience Summary */}
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-bold">Keyword Tracking &amp; Research Activity</h2>
              <button
                type="button"
                onClick={() => onNavigateTab('seo')}
                className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF] hover:underline cursor-pointer"
              >
                Open Rank Tracker
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                    <th className="pb-2 font-medium">Tracked Keyword</th>
                    <th className="pb-2 font-medium">Domain</th>
                    <th className="pb-2 font-medium text-right">Position</th>
                    <th className="pb-2 font-medium text-right">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trackedKeywords.map((kw) => (
                    <tr key={kw.keyword}>
                      <td className="py-2.5 font-medium">{kw.keyword}</td>
                      <td className="py-2.5 text-slate-500">{kw.targetDomain}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#638D50] dark:text-[#8BC374]">
                        #{kw.position}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{kw.volume.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {latestProject && (
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                Audience Summary: {latestProject.intelligence.summary.estimatedAudienceSize} estimated reach · AI Visibility{' '}
                {latestProject.intelligence.summary.aiVisibilityIndex}/100 · Avg Keyword Opportunity{' '}
                {latestProject.intelligence.summary.avgKeywordOpportunity}/100.
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* AI Recommendations */}
          <div className="bg-[#171B35] text-white border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#FFE500] text-xs font-semibold">
              <Sparkles className="w-4 h-4" />
              Next Recommended Actions
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {latestProject
                ? `Your "${latestProject.title}" audience over-indexes on ${latestProject.intelligence.socialNetworks[1]?.platform || 'LinkedIn'} (${latestProject.intelligence.socialNetworks[1]?.indexMultiplier || 2.0}x average). Explore creators and Reddit objections next.`
                : 'Start a research project to unlock tailored channel and keyword recommendations.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  onNavigateTab(
                    'copilot',
                    latestProject
                      ? `Build a 30-day marketing strategy for "${latestProject.query}" prioritizing ${latestProject.intelligence.summary.topPlatform} and low-KD keywords.`
                      : undefined
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-[#FFE500] text-[#171B35] text-xs font-bold hover:bg-[#F5DC00] cursor-pointer"
              >
                Generate 30-Day Plan
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('reports')}
                className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Export Report ({reports.length})
              </button>
            </div>
          </div>

          {/* Saved Reports & Favourite Competitors */}
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#565FEA]" />
                Favourite Competitors &amp; Saved Reports
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('competitors')}
                className="text-xs font-semibold text-[#565FEA] hover:underline cursor-pointer"
              >
                Compare
              </button>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                <strong className="text-[#171B35] dark:text-white">Watched Rivals:</strong>{' '}
                {watchlist.join(' · ') || 'None added'}
              </p>
              <p>
                <strong className="text-[#171B35] dark:text-white">Saved Reports:</strong>{' '}
                {reports[0]?.title || 'No saved reports yet'}
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigateTab('seo')}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                SEO Toolkit
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('reports')}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
