import { useEffect, useState } from 'react';
import { Activity, Bot, Download, ExternalLink, FileText, Info, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { formatExportCsv, validateSafeUrl } from '../lib/intelligence';
import { ALL_STATES_LABEL, formatGeoLabel, GLOBAL_COUNTRY_LABEL } from '../lib/geoAndEngines';
import type { OssVisitorAnalyticsSnapshot, ResearchProject } from '../types';
import { AudienceComparisonChart, BreakdownBarList, TrendLineChart } from './Charts';
import { CountrySelect, SearchEngineSelect, StateMultiSelector } from './GeoEngineControls';

type ModuleId =
  | 'social'
  | 'demographics'
  | 'search-ai'
  | 'websites'
  | 'keywords'
  | 'media'
  | 'reddit'
  | 'creators'
  | 'topics';

const MODULES: { id: ModuleId; label: string }[] = [
  { id: 'social', label: '1. Social Networks' },
  { id: 'demographics', label: '2. Demographics' },
  { id: 'search-ai', label: '3. Search & AI Tools' },
  { id: 'websites', label: '4. Website Visitation' },
  { id: 'keywords', label: '5. Search Keywords' },
  { id: 'media', label: '6. Media Consumption' },
  { id: 'reddit', label: '7. Reddit Communities' },
  { id: 'creators', label: '8. Social Accounts' },
  { id: 'topics', label: '9. Topics of Interest' },
];

interface AudienceIntelligenceProps {
  projects: ResearchProject[];
  activeProject: ResearchProject;
  onSelectProject: (project: ResearchProject) => void;
  onProjectUpdated: (project: ResearchProject) => void;
  onAskCopilot: (prompt: string) => void;
  onCreateReportFromProject: (project: ResearchProject) => void;
}

export function AudienceIntelligence({
  projects,
  activeProject,
  onSelectProject,
  onProjectUpdated,
  onAskCopilot,
  onCreateReportFromProject,
}: AudienceIntelligenceProps) {
  const [activeModule, setActiveModule] = useState<ModuleId>('social');
  const [selectedPlatform, setSelectedPlatform] = useState<string>(
    activeProject.intelligence.socialNetworks[0]?.platform || 'YouTube'
  );
  const [demoCategory, setDemoCategory] = useState<string>('all');
  const [demoLocationFilter, setDemoLocationFilter] = useState<string>('');
  const [kwIntentFilter, setKwIntentFilter] = useState<string>('All');
  const [kwQuestionsOnly, setKwQuestionsOnly] = useState(false);
  const [kwEngineFilter, setKwEngineFilter] = useState(activeProject.searchEngine || 'All Engines');
  const [kwCountryFilter, setKwCountryFilter] = useState(activeProject.country || GLOBAL_COUNTRY_LABEL);
  const [kwStateFilter, setKwStateFilter] = useState(activeProject.state || ALL_STATES_LABEL);
  const [geoUpdating, setGeoUpdating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [ossAnalytics, setOssAnalytics] = useState<OssVisitorAnalyticsSnapshot | null>(null);
  const [ossLoading, setOssLoading] = useState(false);

  useEffect(() => {
    setKwEngineFilter(activeProject.searchEngine || 'All Engines');
    setKwCountryFilter(activeProject.country || GLOBAL_COUNTRY_LABEL);
    setKwStateFilter(activeProject.state || ALL_STATES_LABEL);
  }, [activeProject.id, activeProject.country, activeProject.state, activeProject.searchEngine]);

  const applyGeoEngineUpdate = async (nextCountry: string, nextState: string, nextEngine: string) => {
    setKwCountryFilter(nextCountry);
    setKwStateFilter(nextState);
    setKwEngineFilter(nextEngine);
    setGeoError(null);
    setGeoUpdating(true);
    try {
      const res = await api.updateProject(activeProject.id, {
        country: nextCountry,
        state: nextState,
        searchEngine: nextEngine,
      });
      onProjectUpdated(res.project);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : 'Unable to update Audience Engine targeting');
    } finally {
      setGeoUpdating(false);
    }
  };

  useEffect(() => {
    if (activeModule !== 'websites') return;
    let cancelled = false;
    setOssLoading(true);
    api
      .getLiveOssAnalytics()
      .then((res) => {
        if (!cancelled) setOssAnalytics(res);
      })
      .catch(() => {
        // Non-blocking
      })
      .finally(() => {
        if (!cancelled) setOssLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeModule]);

  const intel = activeProject.intelligence;
  const activeSocialObj =
    intel.socialNetworks.find((s) => s.platform === selectedPlatform) || intel.socialNetworks[0];

  const filteredDemographics = intel.demographics.filter((d) => {
    const matchCategory = demoCategory === 'all' || d.category === demoCategory;
    const matchLocation =
      !demoLocationFilter.trim() || d.label.toLowerCase().includes(demoLocationFilter.trim().toLowerCase());
    return matchCategory && matchLocation;
  });

  const filteredKeywords = intel.keywords.filter((kw) => {
    const matchIntent = kwIntentFilter === 'All' || kw.intent === kwIntentFilter;
    const matchQ = !kwQuestionsOnly || kw.isQuestion;
    return matchIntent && matchQ;
  });

  const handleExportKeywordsCsv = () => {
    const cols = ['Keyword', 'Country', 'StatesRegion', 'SearchEngine', 'Volume', 'Difficulty', 'CPC', 'Intent', 'Cluster', 'GapScore', 'Provenance'];
    const rows = filteredKeywords.map((k) => ({
      Keyword: k.keyword,
      Country: kwCountryFilter,
      StatesRegion: kwStateFilter,
      SearchEngine: kwEngineFilter === 'All Engines' ? k.searchEngine : kwEngineFilter,
      Volume: k.searchVolume,
      Difficulty: k.difficulty,
      CPC: k.cpcUsd,
      Intent: k.intent,
      Cluster: k.cluster,
      GapScore: k.gapOpportunityScore,
      Provenance: k.provenance,
    }));
    const csv = formatExportCsv(cols, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.title.replace(/\W+/g, '-').toLowerCase()}-keywords.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header, Project Selector & Full Geo/Engine Targeting Bar */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-[#565FEA] dark:text-[#8E96FF]">Audience Intelligence Engine</span>
              <span aria-hidden="true">·</span>
              <span>{activeProject.dataMode}</span>
              <span aria-hidden="true">·</span>
              <span>{formatGeoLabel(kwCountryFilter, kwStateFilter)}</span>
              <span aria-hidden="true">·</span>
              <span>Engine: {kwEngineFilter === 'All Engines' ? 'All Search Engines' : kwEngineFilter}</span>
            </div>
            <h1 className="text-2xl font-display font-bold text-[#171B35] dark:text-white">{activeProject.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="project-switcher" className="sr-only">
              Select research project
            </label>
            <select
              id="project-switcher"
              value={activeProject.id}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs font-medium"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                onAskCopilot(
                  `Analyse the "${activeProject.query}" audience research across social channels, Reddit objections, and keyword gaps.`
                )
              }
              className="px-3.5 py-2 rounded-xl bg-[#565FEA] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#464ED8] cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              Ask Copilot
            </button>
            <button
              type="button"
              onClick={() => onCreateReportFromProject(activeProject)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Save Report
            </button>
          </div>
        </div>

        {/* All-Countries, Multi-State & All-Engines Dropdown Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label htmlFor="audience-country-select" className="block text-[11px] font-medium text-slate-500 mb-1">
              Country / Region (Global + 195+ Countries)
            </label>
            <CountrySelect
              id="audience-country-select"
              ariaLabel="Audience Engine country"
              value={kwCountryFilter}
              onChange={(next) => {
                void applyGeoEngineUpdate(next, ALL_STATES_LABEL, kwEngineFilter);
              }}
            />
          </div>
          <div className="lg:col-span-4">
            <label htmlFor="audience-state-select" className="block text-[11px] font-medium text-slate-500 mb-1">
              States / Regions (Your Choice)
            </label>
            <StateMultiSelector
              id="audience-state-select"
              ariaLabel="Audience Engine states or regions"
              country={kwCountryFilter}
              value={kwStateFilter}
              onChange={(nextState) => {
                void applyGeoEngineUpdate(kwCountryFilter, nextState, kwEngineFilter);
              }}
            />
          </div>
          <div className="lg:col-span-3">
            <label htmlFor="audience-engine-select" className="block text-[11px] font-medium text-slate-500 mb-1">
              Search / Discovery Engine
            </label>
            <SearchEngineSelect
              id="audience-engine-select"
              ariaLabel="Audience Engine search engine"
              value={kwEngineFilter}
              onChange={(nextEngine) => {
                void applyGeoEngineUpdate(kwCountryFilter, kwStateFilter, nextEngine);
              }}
              includeAllOption
            />
          </div>
          <div className="lg:col-span-1">
            <button
              type="button"
              disabled={geoUpdating}
              onClick={() => void applyGeoEngineUpdate(kwCountryFilter, kwStateFilter, kwEngineFilter)}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              title="Refresh live audience signals for selected location & search engine"
            >
              {geoUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span className="lg:hidden">Refresh</span>
            </button>
          </div>
        </div>
        {geoError && (
          <p className="text-xs text-red-600 dark:text-red-400">{geoError}</p>
        )}
      </div>

      {/* Provenance Notice */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{intel.sampleModeNotice}</span>
      </div>

      {/* 9-Module Switcher */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl">
        {MODULES.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => setActiveModule(mod.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === mod.id
                ? 'bg-[#565FEA] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {mod.label}
          </button>
        ))}
      </div>

      {/* Module 1: Preferred Social Networks */}
      {activeModule === 'social' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-bold">Social Platform Usage vs. Market Average</h2>
              <span className="text-xs text-slate-400">Click any platform to inspect trend</span>
            </div>
            <AudienceComparisonChart
              data={intel.socialNetworks}
              selectedPlatform={activeSocialObj?.platform}
              onSelectPlatform={setSelectedPlatform}
            />
          </div>

          <div className="lg:col-span-5 space-y-6">
            {activeSocialObj && (
              <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Selected Platform · Rank #{activeSocialObj.rank}</p>
                    <h3 className="text-xl font-display font-bold">{activeSocialObj.platform}</h3>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-lg font-bold text-[#565FEA] dark:text-[#8E96FF]">
                      {activeSocialObj.audiencePct}%
                    </div>
                    <div className="text-xs text-slate-400">
                      30d change: {activeSocialObj.delta30d >= 0 ? '+' : ''}
                      {activeSocialObj.delta30d}%
                    </div>
                  </div>
                </div>
                <TrendLineChart
                  label={`${activeSocialObj.platform} 6-month usage trend`}
                  series={activeSocialObj.historicalSeries.map((h) => ({ label: h.month, value: h.audiencePct }))}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Source: {activeSocialObj.provenance} · Index {activeSocialObj.indexMultiplier}x market average.
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-semibold">Recommended Focus Platforms</h3>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {intel.socialNetworks
                  .filter((s) => s.recommended)
                  .slice(0, 4)
                  .map((s) => (
                    <li key={s.platform} className="flex items-center justify-between">
                      <span className="font-medium text-[#171B35] dark:text-white">{s.platform}</span>
                      <span className="font-mono tabular-nums">
                        {s.audiencePct}% ({s.indexMultiplier}x avg)
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Module 2: Demographics */}
      {activeModule === 'demographics' && (
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-display font-bold">Audience Demographics &amp; Socio-Firmographics</h2>
              <p className="text-xs text-slate-500">
                Authorized &amp; aggregated indicators · Industry: {activeProject.industry}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={demoLocationFilter}
                onChange={(e) => setDemoLocationFilter(e.target.value)}
                placeholder="Filter by location or trait..."
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
              <select
                aria-label="Filter demographic category"
                value={demoCategory}
                onChange={(e) => setDemoCategory(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs"
              >
                <option value="all">All Dimensions</option>
                <option value="age">Age Groups</option>
                <option value="gender">Gender</option>
                <option value="country">Countries</option>
                <option value="state">States / Regions</option>
                <option value="city">Cities</option>
                <option value="language">Languages</option>
                <option value="education">Education</option>
                <option value="occupation">Occupations</option>
                <option value="income">Income Indicators</option>
                <option value="household">Household Indicators</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BreakdownBarList
              items={filteredDemographics.map((d) => ({
                label: d.label,
                primaryPct: d.audiencePct,
                secondaryPct: d.marketAvgPct,
                subtitle: `${d.category} · ${d.provenance}`,
              }))}
            />
          </div>
        </div>
      )}

      {/* Module 3: Search and AI Tool Usage */}
      {activeModule === 'search-ai' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Visibility estimates reflect brand and competitor appearances in public/simulated search prompts. AudiencePulse AI
            never accesses private user search histories.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {intel.searchAndAi.map((engine) => (
              <div
                key={engine.platform}
                className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400">{engine.type} · {engine.provenance}</span>
                    <h3 className="text-base font-display font-bold">{engine.platform}</h3>
                  </div>
                  <span className="text-sm font-mono font-bold tabular-nums text-[#565FEA] dark:text-[#8E96FF]">
                    {engine.visibilityScore}/100
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs border-y border-slate-100 dark:border-slate-800 py-2 font-mono tabular-nums">
                  <div>
                    <div className="text-slate-400 font-sans text-[11px]">Adoption</div>
                    <div className="font-semibold">{engine.audienceAdoptionPct}%</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-sans text-[11px]">Brand</div>
                    <div className="font-semibold">{engine.brandMentionsEst}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-sans text-[11px]">Rivals</div>
                    <div className="font-semibold">{engine.competitorMentionsEst}</div>
                  </div>
                </div>
                <TrendLineChart
                  label={`${engine.platform} visibility history`}
                  series={engine.history.map((h) => ({ label: h.month, value: h.visibility }))}
                  accentColor={engine.type === 'AI Search' ? '#FF704D' : '#565FEA'}
                />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold">Top Prompt / Search Question:</p>
                  <p className="text-slate-600 dark:text-slate-300">“{engine.topQuestions[0]}”</p>
                  <p className="font-semibold pt-1">Citation Opportunity:</p>
                  <p className="text-slate-600 dark:text-slate-300">{engine.citationOpportunities[0]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module 4: Website Visitation */}
      {activeModule === 'websites' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-display font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#565FEA]" />
                  <span>First-Party Visitor Telemetry (Umami / PostHog)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live 30-day visitor metrics &amp; top referrers from your connected open-source analytics server
                </p>
              </div>
              {ossAnalytics?.providerName && (
                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {ossAnalytics.providerName}
                </span>
              )}
            </div>

            {ossLoading ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading first-party analytics...</p>
            ) : ossAnalytics && ossAnalytics.configured && typeof ossAnalytics.visitors30d === 'number' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1021] border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500">30d Visitors</div>
                    <div className="text-xl font-mono font-bold tabular-nums mt-0.5">
                      {ossAnalytics.visitors30d.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1021] border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500">30d Pageviews</div>
                    <div className="text-xl font-mono font-bold tabular-nums mt-0.5">
                      {(ossAnalytics.pageviews30d ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1021] border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500">Top Referrers</div>
                    <div className="text-xs font-medium mt-1 truncate">
                      {ossAnalytics.topReferrers && ossAnalytics.topReferrers.length > 0
                        ? ossAnalytics.topReferrers.map((r) => `${r.domain} (${r.visitors})`).join(', ')
                        : 'Direct / None reported'}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{ossAnalytics.message}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {ossAnalytics?.message ||
                  'Connect Umami or PostHog in API & Settings (format: umami|https://host|websiteId|token or posthog|https://us.posthog.com|projectId|apiKey) to merge live site traffic.'}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 overflow-x-auto">
            <h2 className="text-base font-display font-bold mb-4">Frequently Visited &amp; Competitor Websites</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Domain</th>
                  <th className="pb-3 pr-4 font-medium">Category</th>
                  <th className="pb-3 pr-4 font-medium text-right">Est. Monthly Visits</th>
                  <th className="pb-3 pr-4 font-medium text-right">Audience Overlap</th>
                  <th className="pb-3 pr-4 font-medium">Top Source</th>
                  <th className="pb-3 pr-4 font-medium">Top Geo</th>
                  <th className="pb-3 font-medium">Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {intel.websiteVisitation.map((site) => (
                  <tr key={site.domain} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4 font-semibold text-[#171B35] dark:text-white">
                      {site.domain}
                      {site.isCompetitor && <span className="ml-2 text-[11px] text-[#FF704D]">Competitor</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{site.category}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{site.monthlyVisitsEst.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#565FEA] dark:text-[#8E96FF]">
                      {site.overlapPct}%
                    </td>
                    <td className="py-3 pr-4">{site.primarySource}</td>
                    <td className="py-3 pr-4">{site.topCountry}</td>
                    <td className="py-3 text-xs text-slate-400">{site.provenance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Module 5: Search Keywords */}
      {activeModule === 'keywords' && (
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-display font-bold">Audience Search Keyword Explorer</h2>
              <p className="text-xs text-slate-500">
                Geo: {formatGeoLabel(kwCountryFilter, kwStateFilter)} · Language: {activeProject.language} · Engine: {kwEngineFilter}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <CountrySelect
                  ariaLabel="Filter keywords by country"
                  value={kwCountryFilter}
                  onChange={(next) => {
                    void applyGeoEngineUpdate(next, ALL_STATES_LABEL, kwEngineFilter);
                  }}
                />
              </div>
              <div className="w-48">
                <StateMultiSelector
                  ariaLabel="Filter keywords by states or regions"
                  country={kwCountryFilter}
                  value={kwStateFilter}
                  onChange={(nextState) => {
                    void applyGeoEngineUpdate(kwCountryFilter, nextState, kwEngineFilter);
                  }}
                />
              </div>
              <div className="w-44">
                <SearchEngineSelect
                  ariaLabel="Filter by search engine"
                  value={kwEngineFilter}
                  onChange={(nextEngine) => {
                    void applyGeoEngineUpdate(kwCountryFilter, kwStateFilter, nextEngine);
                  }}
                  includeAllOption
                />
              </div>
              <select
                aria-label="Filter by search intent"
                value={kwIntentFilter}
                onChange={(e) => setKwIntentFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs"
              >
                <option value="All">All Intents</option>
                <option value="Commercial">Commercial</option>
                <option value="Informational">Informational</option>
                <option value="Transactional">Transactional</option>
              </select>
              <label className="inline-flex items-center gap-1.5 text-xs px-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kwQuestionsOnly}
                  onChange={(e) => setKwQuestionsOnly(e.target.checked)}
                />
                Questions only
              </label>
              <button
                type="button"
                onClick={handleExportKeywordsCsv}
                className="px-3 py-2 rounded-xl bg-[#565FEA] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-3 font-medium">Keyword</th>
                  <th className="pb-3 font-medium">Cluster</th>
                  <th className="pb-3 font-medium text-right">Volume</th>
                  <th className="pb-3 font-medium text-right">KD</th>
                  <th className="pb-3 font-medium text-right">CPC</th>
                  <th className="pb-3 font-medium">Intent</th>
                  <th className="pb-3 font-medium text-right">Gap Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredKeywords.map((kw) => (
                  <tr key={kw.keyword} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-medium">
                      {kw.keyword}
                      {kw.isTrending && <span className="ml-2 text-[11px] text-[#FF704D]">Trending</span>}
                    </td>
                    <td className="py-3 text-xs text-slate-500">{kw.cluster}</td>
                    <td className="py-3 text-right font-mono tabular-nums">{kw.searchVolume.toLocaleString()}</td>
                    <td className="py-3 text-right font-mono tabular-nums">{kw.difficulty}</td>
                    <td className="py-3 text-right font-mono tabular-nums">${kw.cpcUsd.toFixed(2)}</td>
                    <td className="py-3 text-xs">{kw.intent}</td>
                    <td className="py-3 text-right font-mono tabular-nums font-semibold text-[#638D50] dark:text-[#8BC374]">
                      {kw.gapOpportunityScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Module 6: Media Consumption */}
      {activeModule === 'media' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {intel.mediaConsumption.map((item) => {
            const safeHref = validateSafeUrl(item.url);
            return (
              <div
                key={item.title}
                className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{item.mediaType} · {item.frequency}</span>
                  <span className="font-mono tabular-nums font-semibold text-[#565FEA] dark:text-[#8E96FF]">
                    {item.audienceAffinityPct}% affinity
                  </span>
                </div>
                <h3 className="text-base font-display font-bold">{item.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">{item.topicFocus}</p>
                {safeHref && (
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#565FEA] hover:underline pt-1"
                  >
                    Visit Publication <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Module 7: Reddit Communities */}
      {activeModule === 'reddit' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Reddit community insights adhere to Reddit API licensing, commercial-use boundaries, and data-retention controls.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intel.redditCommunities.map((sub) => (
              <div
                key={sub.subreddit}
                className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-display font-bold text-[#565FEA] dark:text-[#8E96FF]">
                    {sub.subreddit}
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {sub.subscribersEst} · {sub.audienceMatchPct}% match · {sub.trendDirection}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Topics: {sub.coreTopics.join(' · ')}</p>
                <div className="space-y-1.5 text-xs">
                  <p>
                    <strong>Popular Discussion:</strong> {sub.popularDiscussion}
                  </p>
                  <p>
                    <strong>Frequent Question:</strong> {sub.faqQuestion}
                  </p>
                  <p className="text-[#FF704D]">
                    <strong>Customer Complaint:</strong> {sub.customerComplaint}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module 8: Social Accounts Followed */}
      {activeModule === 'creators' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Public creator discovery strictly distinguishes Observed Public Profiles from AI-Inferred Recommendations.
            AudiencePulse AI never claims access to private user follow lists.
          </p>
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-3 font-medium">Creator / Industry Account</th>
                  <th className="pb-3 font-medium">Platform</th>
                  <th className="pb-3 font-medium">Signal Type</th>
                  <th className="pb-3 font-medium text-right">Relevance</th>
                  <th className="pb-3 font-medium text-right">Public Reach</th>
                  <th className="pb-3 font-medium">Collaboration Opportunity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {intel.socialAccounts.map((acc) => {
                  const safeHref = validateSafeUrl(acc.profileUrl);
                  return (
                    <tr key={acc.handle} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3">
                        <div className="font-semibold">{acc.name}</div>
                        <div className="text-xs text-slate-500">
                          {safeHref ? (
                            <a href={safeHref} target="_blank" rel="noreferrer noopener" className="hover:underline">
                              {acc.handle}
                            </a>
                          ) : (
                            acc.handle
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-xs">{acc.platform}</td>
                      <td className="py-3 text-xs text-slate-500">{acc.observationKind}</td>
                      <td className="py-3 text-right font-mono tabular-nums font-semibold">{acc.relevanceScore}%</td>
                      <td className="py-3 text-right font-mono tabular-nums">
                        {acc.followersPublic} ({acc.engagementRatePct}%)
                      </td>
                      <td className="py-3 text-xs text-slate-600 dark:text-slate-300">{acc.collaborationIdea}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Module 9: Topics of Interest */}
      {activeModule === 'topics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {intel.topicsOfInterest.map((topic) => (
            <div
              key={topic.topic}
              className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2.5"
            >
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {topic.category} · {topic.cluster} · {topic.provenance}
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#638D50] dark:text-[#8BC374]">
                  {topic.interestPct}% interest (+{topic.growthPct}%)
                </span>
              </div>
              <h3 className="text-base font-display font-bold">{topic.topic}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <strong>Buyer Question:</strong> {topic.relatedQuestion}
              </p>
              <p className="text-xs text-[#565FEA] dark:text-[#8E96FF]">
                <strong>Content Opportunity:</strong> {topic.contentOpportunity}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
