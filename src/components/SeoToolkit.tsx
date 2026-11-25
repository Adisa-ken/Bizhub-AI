import { useState } from 'react';
import {
  Bot,
  ChevronRight,
  Download,
  FileText,
  Globe,
  Link2,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { ALL_STATES_LABEL, formatGeoLabel, GLOBAL_COUNTRY_LABEL } from '../lib/geoAndEngines';
import { formatExportCsv } from '../lib/intelligence';
import type { SeoToolId, SeoToolResult } from '../types';
import { CountrySelect, SearchEngineSelect, StateMultiSelector } from './GeoEngineControls';
import { UbersuggestWorkspace, type UbersuggestSection } from './UbersuggestWorkspace';

const RESEARCH_TOPIC_NAV: { id: UbersuggestSection; label: string }[] = [
  { id: 'keyword-overview', label: 'AI Keyword Overview' },
  { id: 'bulk-analysis', label: 'Bulk Analysis' },
  { id: 'keyword-ideas', label: 'Keyword Ideas' },
  { id: 'ai-prompt-ideas', label: 'AI Prompt Ideas' },
  { id: 'keyword-lists', label: 'Keyword Lists' },
];

const SUITE_SHORTCUTS: { label: string; toolId: SeoToolId; icon: typeof Sparkles }[] = [
  { label: 'AI Search Visibility', toolId: 'ai-visibility', icon: Sparkles },
  { label: 'Competitive Research', toolId: 'competitor-research', icon: Globe },
  { label: 'Content Creation', toolId: 'content-explorer', icon: FileText },
  { label: 'Link Building', toolId: 'backlink-explorer', icon: Link2 },
  { label: 'Local SEO', toolId: 'serp-analyzer', icon: MapPin },
];

const SEO_TOOLS: { id: SeoToolId; label: string; placeholder: string }[] = [
  { id: 'keyword-explorer', label: '1. Keyword Explorer', placeholder: 'Enter seed keyword (e.g., audience intelligence)' },
  { id: 'serp-analyzer', label: '2. SERP Analyzer', placeholder: 'Enter SERP query to inspect top rankings' },
  { id: 'website-explorer', label: '3. Website Explorer', placeholder: 'Enter domain (e.g., sparktoro.com)' },
  { id: 'backlink-explorer', label: '4. Backlink Explorer', placeholder: 'Enter domain to inspect referring domains' },
  { id: 'competitor-research', label: '5. Competitor Research', placeholder: 'Enter domain to benchmark rivals' },
  { id: 'keyword-gap', label: '6. Keyword Gap Analysis', placeholder: 'Enter your domain to compare gaps' },
  { id: 'rank-tracker', label: '7. Rank Tracker', placeholder: 'Enter tracked domain' },
  { id: 'technical-audit', label: '8. Technical SEO Audit', placeholder: 'Enter domain for technical checks' },
  { id: 'content-explorer', label: '9. Content Explorer', placeholder: 'Enter topic to discover high-performing content' },
  { id: 'content-gap', label: '10. Content Gap Analysis', placeholder: 'Enter your domain to find missing topic clusters' },
  { id: 'search-intent', label: '11. Search Intent Analysis', placeholder: 'Enter keyword theme' },
  { id: 'ai-visibility', label: '12. AI Search Visibility Tracker', placeholder: 'Enter domain for Gemini/ChatGPT/Perplexity check' },
];

interface SeoToolkitProps {
  defaultTarget?: string;
  defaultCountry?: string;
  defaultState?: string;
  onCreditsUpdated?: () => void;
}

export function SeoToolkit({
  defaultTarget = 'audience intelligence',
  defaultCountry = GLOBAL_COUNTRY_LABEL,
  defaultState = ALL_STATES_LABEL,
  onCreditsUpdated,
}: SeoToolkitProps) {
  const [workspaceMode, setWorkspaceMode] = useState<'ubersuggest' | 'classic-tool'>('ubersuggest');
  const [ubersuggestSection, setUbersuggestSection] = useState<UbersuggestSection>('keyword-overview');
  const [selectedTool, setSelectedTool] = useState<SeoToolId>('keyword-explorer');

  const [target, setTarget] = useState(defaultTarget);
  const [country, setCountry] = useState(defaultCountry || GLOBAL_COUNTRY_LABEL);
  const [stateRegion, setStateRegion] = useState(defaultState || ALL_STATES_LABEL);
  const [language, setLanguage] = useState('English');
  const [searchEngine, setSearchEngine] = useState('Google');

  const [result, setResult] = useState<SeoToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTool = async (
    toolId: SeoToolId,
    currentTarget: string,
    overrideCountry = country,
    overrideState = stateRegion,
    overrideEngine = searchEngine
  ) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.runSeoTool({
        toolId,
        target: currentTarget.trim() || defaultTarget,
        country: overrideCountry,
        state: overrideState,
        searchEngine: overrideEngine,
      });
      setResult(res.result);
      onCreditsUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run SEO tool');
    } finally {
      setLoading(false);
    }
  };

  const openClassicTool = (toolId: SeoToolId) => {
    setWorkspaceMode('classic-tool');
    setSelectedTool(toolId);
    void runTool(toolId, target);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runTool(selectedTool, target);
  };

  const handleExportCsv = () => {
    if (!result) return;
    const csv = formatExportCsv(result.columns, result.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.toolId}-${result.target.replace(/\W+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentMeta = SEO_TOOLS.find((t) => t.id === selectedTool) || SEO_TOOLS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Unified Ubersuggest + 12-Tool SEO Left Rail */}
      <aside className="lg:col-span-3 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-4 h-fit">
        {/* Research Topics (Ubersuggest Section) */}
        <div className="space-y-1">
          <p className="px-3 py-1.5 text-xs font-bold text-[#171B35] dark:text-white flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-[#FF704D]" />
            <span>Research Topics</span>
          </p>
          {RESEARCH_TOPIC_NAV.map((item) => {
            const active = workspaceMode === 'ubersuggest' && ubersuggestSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setWorkspaceMode('ubersuggest');
                  setUbersuggestSection(item.id);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#FF704D]/12 text-[#D94F2E] dark:text-[#FF8D70]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Suite Shortcuts */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1">
          {SUITE_SHORTCUTS.map((sc) => {
            const Icon = sc.icon;
            const active = workspaceMode === 'classic-tool' && selectedTool === sc.toolId;
            return (
              <button
                key={sc.label}
                type="button"
                onClick={() => openClassicTool(sc.toolId)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#565FEA] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{sc.label}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            );
          })}
        </div>

        {/* Full 12-Tool SEO & GEO Suite */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1">
          <p className="px-3 py-1 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Bot className="w-3 h-3" />
            <span>12-Tool SEO &amp; GEO Suite</span>
          </p>
          {SEO_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => openClassicTool(tool.id)}
              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                workspaceMode === 'classic-tool' && selectedTool === tool.id
                  ? 'bg-[#565FEA] text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content Panel */}
      <div className="lg:col-span-9 min-w-0 space-y-5">
        {workspaceMode === 'ubersuggest' ? (
          <UbersuggestWorkspace
            activeSection={ubersuggestSection}
            onChangeSection={setUbersuggestSection}
            keyword={target}
            onChangeKeyword={setTarget}
            country={country}
            onChangeCountry={setCountry}
            stateRegion={stateRegion}
            onChangeStateRegion={setStateRegion}
            language={language}
            onChangeLanguage={setLanguage}
            searchEngine={searchEngine}
            onChangeSearchEngine={setSearchEngine}
            onCreditsUpdated={onCreditsUpdated}
          />
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h1 className="text-lg font-display font-bold">{currentMeta.label}</h1>
                <span className="text-xs text-slate-400">
                  {result ? `Provenance: ${result.provenance}` : 'Ready'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-9 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <label htmlFor="seo-target-input" className="sr-only">
                    Keyword or Domain
                  </label>
                  <input
                    id="seo-target-input"
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={currentMeta.placeholder}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                  />
                </div>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#565FEA] text-white text-sm font-semibold hover:bg-[#464ED8] cursor-pointer"
                  >
                    {loading ? 'Running...' : 'Analyse'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="seo-country-select" className="block text-[11px] font-medium text-slate-500 mb-1">
                    Country (All Countries)
                  </label>
                  <CountrySelect
                    id="seo-country-select"
                    ariaLabel="Country"
                    value={country}
                    onChange={(next) => {
                      setCountry(next);
                      setStateRegion(ALL_STATES_LABEL);
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="seo-state-select" className="block text-[11px] font-medium text-slate-500 mb-1">
                    States / Regions (Your Choice)
                  </label>
                  <StateMultiSelector
                    id="seo-state-select"
                    ariaLabel="States or regions"
                    country={country}
                    value={stateRegion}
                    onChange={setStateRegion}
                  />
                </div>
                <div>
                  <label htmlFor="seo-engine-select" className="block text-[11px] font-medium text-slate-500 mb-1">
                    Search / Discovery Engine
                  </label>
                  <SearchEngineSelect
                    id="seo-engine-select"
                    ariaLabel="Search engine"
                    value={searchEngine}
                    onChange={setSearchEngine}
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            </form>

            {result && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {result.summaryMetrics.map((m) => (
                    <div
                      key={m.label}
                      className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-4"
                    >
                      <div className="text-xs text-slate-500 dark:text-slate-400">{m.label}</div>
                      <div className="text-lg font-mono font-bold tabular-nums mt-1 break-words">{m.value}</div>
                      {m.delta && <div className="text-xs text-[#638D50] dark:text-[#8BC374] mt-0.5">{m.delta}</div>}
                    </div>
                  ))}
                </div>

                <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold">Analysis Results for “{result.target}”</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {result.searchEngine} · {formatGeoLabel(result.country, result.state)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer self-start sm:self-auto"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                          {result.columns.map((col) => (
                            <th key={col} className="pb-3 font-medium pr-4">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {result.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            {result.columns.map((col) => (
                              <td
                                key={col}
                                className={`py-3 pr-4 ${
                                  typeof row[col] === 'number' ? 'font-mono tabular-nums' : ''
                                }`}
                              >
                                {typeof row[col] === 'number' ? (row[col] as number).toLocaleString() : row[col]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <p className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">Recommended Next Actions</p>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {result.recommendations.map((rec) => (
                        <li key={rec}>· {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
