import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  BookmarkPlus,
  Bot,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FolderPlus,
  HelpCircle,
  ListChecks,
  Loader2,
  Network,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import { ALL_STATES_LABEL, formatGeoLabel, GLOBAL_COUNTRY_LABEL } from '../lib/geoAndEngines';
import { formatExportCsv, validateSafeUrl } from '../lib/intelligence';
import {
  formatCompactMonthlyVolume,
  getIntentBadgeMeta,
  getSeoDifficultySignalMeta,
  SUPPORTED_LANGUAGES,
} from '../lib/ubersuggest';
import type {
  AiPromptIdeaItem,
  BulkKeywordRow,
  IndustryNewsItem,
  KeywordIdeaCategory,
  KeywordIdeaItem,
  SavedKeywordList,
  TrendingSearchTopic,
  UbersuggestOverviewPayload,
} from '../types';
import { CountrySelect, SearchEngineSelect, StateMultiSelector } from './GeoEngineControls';

function MetricTooltip({ label, text }: { label: string; text: string }) {
  return (
    <span className="relative inline-flex items-center group align-middle">
      <button
        type="button"
        aria-label={`About ${label}`}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-[#171B35] dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-[#565FEA] cursor-help"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-[#171B35] text-white text-[11px] font-normal leading-snug p-2.5 shadow-xl z-40 text-left whitespace-normal"
      >
        {text}
      </span>
    </span>
  );
}

function IntentLetterBadge({ intent, compact = false }: { intent: string; compact?: boolean }) {
  const meta = getIntentBadgeMeta(intent);
  return (
    <span className="inline-flex items-center gap-1.5" title={`${meta.label} Search Intent`}>
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ${
          compact ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'
        } ${meta.bgClass}`}
      >
        {meta.letter}
      </span>
      {!compact && <span className="text-xs text-slate-500 dark:text-slate-400 hidden xl:inline">{meta.label}</span>}
    </span>
  );
}

function DifficultySignalIndicator({
  difficulty,
  statusTag,
  showFpp = false,
}: {
  difficulty: number;
  statusTag?: string;
  showFpp?: boolean;
}) {
  const meta = getSeoDifficultySignalMeta(difficulty);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums" title={`${meta.label} SEO Difficulty (${difficulty}/100) · ${meta.fppLabel}`}>
      <svg
        width="16"
        height="14"
        viewBox="0 0 16 14"
        aria-hidden="true"
        className={`shrink-0 ${meta.colorClass}`}
      >
        <rect x="1" y="9" width="3" height="4" rx="0.75" fill="currentColor" />
        <rect
          x="6.5"
          y="5"
          width="3"
          height="8"
          rx="0.75"
          fill="currentColor"
          opacity={meta.bars >= 2 ? 1 : 0.25}
        />
        <rect
          x="12"
          y="1"
          width="3"
          height="12"
          rx="0.75"
          fill="currentColor"
          opacity={meta.bars >= 3 ? 1 : 0.25}
        />
      </svg>
      <span className="font-semibold text-[#171B35] dark:text-white">{difficulty}</span>
      {showFpp && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${meta.badgeBgClass}`}>
          {meta.fppLabel}
        </span>
      )}
      {statusTag && (
        <span className="text-[10px] font-sans text-slate-400">{statusTag}</span>
      )}
    </span>
  );
}

export type UbersuggestSection =
  | 'keyword-overview'
  | 'bulk-analysis'
  | 'keyword-ideas'
  | 'ai-prompt-ideas'
  | 'keyword-lists';

interface UbersuggestWorkspaceProps {
  activeSection: UbersuggestSection;
  onChangeSection: (section: UbersuggestSection) => void;
  keyword: string;
  onChangeKeyword: (next: string) => void;
  country: string;
  onChangeCountry: (next: string) => void;
  stateRegion: string;
  onChangeStateRegion: (next: string) => void;
  language: string;
  onChangeLanguage: (next: string) => void;
  searchEngine: string;
  onChangeSearchEngine: (next: string) => void;
  onCreditsUpdated?: () => void;
}

const CATEGORY_META: { id: KeywordIdeaCategory; title: string; subtitle: string }[] = [
  { id: 'autocomplete', title: 'Google Autocomplete', subtitle: 'Direct query completions' },
  { id: 'questions', title: 'Questions', subtitle: 'Who, what, where, why, how' },
  { id: 'prepositions', title: 'Prepositions', subtitle: 'For, near, with, without, to' },
  { id: 'comparisons', title: 'Comparisons', subtitle: 'Vs, versus, or, alternative' },
];

export function UbersuggestWorkspace({
  activeSection,
  onChangeSection,
  keyword,
  onChangeKeyword,
  country,
  onChangeCountry,
  stateRegion,
  onChangeStateRegion,
  language,
  onChangeLanguage,
  searchEngine,
  onChangeSearchEngine,
  onCreditsUpdated,
}: UbersuggestWorkspaceProps) {
  const [overview, setOverview] = useState<UbersuggestOverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiOverviewLoading, setAiOverviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Search mode: Keywords vs Website/Domain
  const [searchMode, setSearchMode] = useState<'keywords' | 'website'>('keywords');

  // Volume toggle: Total vs Devices
  const [volumeTab, setVolumeTab] = useState<'total' | 'devices'>('total');
  const [showAllContentIdeas, setShowAllContentIdeas] = useState(false);

  // Keyword Ideas View filters, sorting & selection
  const [ideasFilterCategory, setIdeasFilterCategory] = useState<'all' | KeywordIdeaCategory>('all');
  const [ideasSearchFilter, setIdeasSearchFilter] = useState('');
  const [ideasFppFilter, setIdeasFppFilter] = useState<'all' | 'high' | 'good' | 'competitive'>('all');
  const [ideasVolFilter, setIdeasVolFilter] = useState<'all' | '100' | '500' | '1000' | '5000'>('all');
  const [ideasIntentFilter, setIdeasIntentFilter] = useState<string>('all');
  const [ideasSdFilter, setIdeasSdFilter] = useState<'all' | 'easy' | 'low' | 'medium' | 'high'>('all');
  const [ideasCpcFilter, setIdeasCpcFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [ideasSortField, setIdeasSortField] = useState<'volume' | 'difficulty' | 'paidDifficulty' | 'cpc' | 'keyword'>('volume');
  const [ideasSortDir, setIdeasSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIdeaKeywords, setSelectedIdeaKeywords] = useState<Set<string>>(new Set());
  const [copiedSelection, setCopiedSelection] = useState(false);

  // Bulk Analysis state
  const [bulkInput, setBulkInput] = useState(
    'audience intelligence platform\nplumber near me\nai search visibility tracker\nbest seo audit tool\nreddit customer research'
  );
  const [bulkRows, setBulkRows] = useState<BulkKeywordRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // AI Prompt Ideas state
  const [customPromptInput, setCustomPromptInput] = useState('');

  // Keyword Lists state
  const [keywordLists, setKeywordLists] = useState<SavedKeywordList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [savedKeywordSet, setSavedKeywordSet] = useState<Set<string>>(new Set());

  // Live Google Trends RSS, Industry News RSS & FAQ Schema copy state
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsOverride, setTrendsOverride] = useState<TrendingSearchTopic[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsOverride, setNewsOverride] = useState<IndustryNewsItem[] | null>(null);
  const [copiedFaq, setCopiedFaq] = useState(false);

  const serpSectionRef = useRef<HTMLDivElement | null>(null);

  const syncSavedSet = (lists: SavedKeywordList[]) => {
    const next = new Set<string>();
    for (const l of lists) {
      for (const k of l.keywords) {
        next.add(k.keyword.toLowerCase());
      }
    }
    setSavedKeywordSet(next);
  };

  const loadKeywordLists = async () => {
    try {
      const res = await api.getKeywordLists();
      setKeywordLists(res.lists);
      syncSavedSet(res.lists);
      if (res.lists[0] && !selectedListId) {
        setSelectedListId(res.lists[0].id);
      }
    } catch {
      // Non-blocking
    }
  };

  const fetchOverview = async (targetKw = keyword) => {
    let clean = targetKw.trim();
    if (searchMode === 'website') {
      clean = clean.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || clean;
    }
    if (clean.length < 2) {
      setError('Enter a keyword or domain of at least 2 characters.');
      return;
    }
    setError(null);
    setStatusNotice(null);
    setLoading(true);
    try {
      const res = await api.getUbersuggestOverview({
        keyword: clean,
        country,
        state: stateRegion,
        language,
        searchEngine,
      });
      setOverview(res.overview);
      setTrendsOverride(null);
      setNewsOverride(null);
      setCopiedFaq(false);
      setSelectedIdeaKeywords(new Set());
      onCreditsUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load keyword overview');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshTrends = async () => {
    setTrendsLoading(true);
    setError(null);
    try {
      const res = await api.getLiveTrends(country);
      setTrendsOverride(res.trends);
      setStatusNotice(`Loaded ${res.trends.length} live trending searches for ${country} via Google Trends RSS.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh Google Trends RSS');
    } finally {
      setTrendsLoading(false);
    }
  };

  const handleRefreshNews = async () => {
    const targetQuery = overview?.keyword || keyword.trim() || 'marketing';
    setNewsLoading(true);
    setError(null);
    try {
      const res = await api.getLiveNews(targetQuery, country, language);
      setNewsOverride(res.news);
      setStatusNotice(`Loaded ${res.news.length} industry news articles for "${targetQuery}" via RSS aggregator.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh Industry News RSS');
    } finally {
      setNewsLoading(false);
    }
  };

  const handleCopyFaqJsonLd = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedFaq(true);
      setTimeout(() => setCopiedFaq(false), 2500);
    } catch {
      setStatusNotice('Copy the JSON-LD snippet manually from the Schema box.');
    }
  };

  useEffect(() => {
    void fetchOverview(keyword);
    void loadKeywordLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveKeyword = async (item: {
    keyword: string;
    volume: number;
    difficulty: number;
    cpc: number;
    intent: string;
  }) => {
    setError(null);
    try {
      let targetListId = selectedListId || keywordLists[0]?.id;
      if (!targetListId) {
        const created = await api.createKeywordList('My Keyword Research');
        targetListId = created.list.id;
        setKeywordLists([created.list]);
        setSelectedListId(targetListId);
      }
      const res = await api.addKeywordToList(targetListId, {
        keyword: item.keyword,
        volume: item.volume,
        difficulty: item.difficulty,
        cpc: item.cpc,
        currencySymbol: overview?.cpcCurrencySymbol || '$',
        intent: item.intent,
        country,
        language,
      });
      const updatedLists = keywordLists.some((l) => l.id === res.list.id)
        ? keywordLists.map((l) => (l.id === res.list.id ? res.list : l))
        : [res.list, ...keywordLists];
      setKeywordLists(updatedLists);
      syncSavedSet(updatedLists);
      setStatusNotice(`Saved "${item.keyword}" to "${res.list.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save keyword');
    }
  };

  const handleRunAiPrompt = async (promptItem: AiPromptIdeaItem) => {
    if (!overview) return;
    setOverview((prev) =>
      prev
        ? {
            ...prev,
            aiPromptIdeas: prev.aiPromptIdeas.map((p) =>
              p.id === promptItem.id ? { ...p, loading: true, error: undefined } : p
            ),
          }
        : prev
    );
    try {
      const res = await api.getUbersuggestAiResponse({
        promptText: promptItem.prompt,
        keyword: overview.keyword,
        language,
        country,
        state: stateRegion,
      });
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              aiPromptIdeas: prev.aiPromptIdeas.map((p) =>
                p.id === promptItem.id
                  ? {
                      ...p,
                      loading: false,
                      answer: res.answer,
                      brandsMentioned: res.brandsMentioned,
                      sources: res.sources,
                    }
                  : p
              ),
            }
          : prev
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch Gemini AI response';
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              aiPromptIdeas: prev.aiPromptIdeas.map((p) =>
                p.id === promptItem.id ? { ...p, loading: false, error: msg } : p
              ),
            }
          : prev
      );
    }
  };

  const handleGenerateLiveAiOverview = async () => {
    if (!overview) return;
    setAiOverviewLoading(true);
    setError(null);
    try {
      const res = await api.generateUbersuggestAiOverview({
        keyword: overview.keyword,
        language,
        country,
        state: stateRegion,
      });
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              aiSummary: res.aiSummary,
              aiOverview: res.aiOverview,
              brandsMentioned: res.brandsMentioned.length > 0 ? res.brandsMentioned : prev.brandsMentioned,
              topAiSources: res.topAiSources.length > 0 ? res.topAiSources : prev.topAiSources,
            }
          : prev
      );
      setStatusNotice('Updated AI Summary, AI Overview, and Cited Sources live via Gemini Google Search grounding.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate Gemini AI Overview');
    } finally {
      setAiOverviewLoading(false);
    }
  };

  const handleRunBulkAnalysis = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setBulkLoading(true);
    try {
      const res = await api.runBulkKeywordAnalysis({
        rawKeywords: bulkInput,
        country,
        state: stateRegion,
        language,
      });
      setBulkRows(res.rows);
      onCreditsUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run bulk analysis');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBulkInput(reader.result.slice(0, 4000));
      }
    };
    reader.readAsText(file);
  };

  const handleExportCsvFile = (filename: string, columns: string[], rows: Record<string, string | number>[]) => {
    const csv = formatExportCsv(columns, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeSavedList = keywordLists.find((l) => l.id === selectedListId) || keywordLists[0] || null;

  const allIdeasList: KeywordIdeaItem[] = overview
    ? ideasFilterCategory === 'all'
      ? [
          ...overview.keywordIdeas.autocomplete,
          ...overview.keywordIdeas.questions,
          ...overview.keywordIdeas.prepositions,
          ...overview.keywordIdeas.comparisons,
        ]
      : overview.keywordIdeas[ideasFilterCategory]
    : [];

  const filteredIdeasList = allIdeasList
    .filter((item) => {
      const txt = ideasSearchFilter.trim().toLowerCase();
      if (txt) {
        const parts = txt.split(',').map((s) => s.trim()).filter(Boolean);
        const includes = parts.filter((p) => !p.startsWith('-'));
        const excludes = parts.filter((p) => p.startsWith('-') && p.length > 1).map((p) => p.slice(1));
        const kwLower = item.keyword.toLowerCase();
        if (includes.length > 0 && !includes.some((inc) => kwLower.includes(inc))) return false;
        if (excludes.some((exc) => kwLower.includes(exc))) return false;
      }
      if (ideasFppFilter === 'high' && item.difficulty > 25) return false;
      if (ideasFppFilter === 'good' && item.difficulty > 40) return false;
      if (ideasFppFilter === 'competitive' && item.difficulty <= 40) return false;

      if (ideasVolFilter !== 'all' && item.volume < Number(ideasVolFilter)) return false;
      if (ideasIntentFilter !== 'all' && item.intent !== ideasIntentFilter) return false;

      if (ideasSdFilter === 'easy' && item.difficulty > 20) return false;
      if (ideasSdFilter === 'low' && (item.difficulty <= 20 || item.difficulty > 38)) return false;
      if (ideasSdFilter === 'medium' && (item.difficulty <= 38 || item.difficulty > 60)) return false;
      if (ideasSdFilter === 'high' && item.difficulty <= 60) return false;

      if (ideasCpcFilter === 'low' && item.cpc >= 1.5) return false;
      if (ideasCpcFilter === 'mid' && (item.cpc < 1.5 || item.cpc > 4)) return false;
      if (ideasCpcFilter === 'high' && item.cpc <= 4) return false;

      return true;
    })
    .slice()
    .sort((a, b) => {
      const mul = ideasSortDir === 'asc' ? 1 : -1;
      if (ideasSortField === 'keyword') return a.keyword.localeCompare(b.keyword) * mul;
      if (ideasSortField === 'paidDifficulty') {
        return ((a.paidDifficulty ?? 15) - (b.paidDifficulty ?? 15)) * mul;
      }
      return (Number(a[ideasSortField]) - Number(b[ideasSortField])) * mul;
    });

  const handleToggleSortIdeas = (field: 'volume' | 'difficulty' | 'paidDifficulty' | 'cpc' | 'keyword') => {
    if (ideasSortField === field) {
      setIdeasSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setIdeasSortField(field);
      setIdeasSortDir(field === 'keyword' ? 'asc' : 'desc');
    }
  };

  const handleToggleSelectIdea = (kw: string) => {
    setSelectedIdeaKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  };

  const handleCopySelectedIdeas = async (items: KeywordIdeaItem[]) => {
    const chosen = selectedIdeaKeywords.size > 0
      ? items.filter((i) => selectedIdeaKeywords.has(i.keyword))
      : items;
    if (chosen.length === 0) return;
    try {
      await navigator.clipboard.writeText(chosen.map((c) => c.keyword).join('\n'));
      setCopiedSelection(true);
      setStatusNotice(`Copied ${chosen.length} keyword${chosen.length === 1 ? '' : 's'} to clipboard.`);
      setTimeout(() => setCopiedSelection(false), 2000);
    } catch {
      setStatusNotice('Copy manually from the table.');
    }
  };

  const handleAddSelectedIdeasToList = async (items: KeywordIdeaItem[]) => {
    const chosen = selectedIdeaKeywords.size > 0
      ? items.filter((i) => selectedIdeaKeywords.has(i.keyword))
      : items.slice(0, 5);
    for (const item of chosen.slice(0, 15)) {
      await handleSaveKeyword(item);
    }
    setSelectedIdeaKeywords(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Top Ubersuggest-Style Search & Geo/Language Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (activeSection === 'bulk-analysis') {
            void handleRunBulkAnalysis();
          } else {
            void fetchOverview(keyword);
          }
        }}
        className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-4 text-xs font-bold tracking-wide uppercase">
            <button
              type="button"
              onClick={() => setSearchMode('keywords')}
              className={`pb-1.5 border-b-2 transition-colors cursor-pointer ${
                searchMode === 'keywords'
                  ? 'border-[#FF704D] text-[#FF704D]'
                  : 'border-transparent text-slate-500 hover:text-[#171B35] dark:hover:text-white'
              }`}
            >
              Search by Keywords
            </button>
            <button
              type="button"
              onClick={() => setSearchMode('website')}
              className={`pb-1.5 border-b-2 transition-colors cursor-pointer ${
                searchMode === 'website'
                  ? 'border-[#FF704D] text-[#FF704D]'
                  : 'border-transparent text-slate-500 hover:text-[#171B35] dark:hover:text-white'
              }`}
            >
              Search by Website
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">or try</span>
            <button
              type="button"
              onClick={() => {
                onChangeSection('bulk-analysis');
                if (bulkRows.length === 0) void handleRunBulkAnalysis();
              }}
              className="font-semibold text-[#565FEA] dark:text-[#8E96FF] underline underline-offset-2 cursor-pointer"
            >
              Bulk Analysis
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {searchMode === 'website'
              ? 'Enter a domain or website URL to extract keyword ideas & SERP benchmarks'
              : 'Discover new keywords · monthly volume, Paid Difficulty (PD) & SEO Difficulty (SD)'}
          </span>
          {keywordLists.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="active-kw-list-select" className="text-slate-500 dark:text-slate-400">
                Save target list:
              </label>
              <select
                id="active-kw-list-select"
                value={selectedListId || keywordLists[0]?.id || ''}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs"
              >
                {keywordLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.keywords.length})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="ubersuggest-keyword-input" className="sr-only">
              {searchMode === 'website' ? 'Website domain to research' : 'Keyword to research'}
            </label>
            <input
              id="ubersuggest-keyword-input"
              type="text"
              value={keyword}
              onChange={(e) => onChangeKeyword(e.target.value)}
              placeholder={
                searchMode === 'website'
                  ? 'Enter website domain (e.g., hubspot.com, shopify.com)'
                  : 'Enter keyword (e.g., plumber near me, audience intelligence)'
              }
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="ubersuggest-language-select" className="sr-only">
              Language
            </label>
            <select
              id="ubersuggest-language-select"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-sm"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.name}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <CountrySelect
              id="ubersuggest-country-select"
              ariaLabel="Location Country"
              value={country}
              onChange={(next) => {
                onChangeCountry(next);
                onChangeStateRegion(ALL_STATES_LABEL);
              }}
            />
          </div>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={loading || bulkLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#565FEA] text-white text-sm font-semibold hover:bg-[#464ED8] inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {loading || bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>AI Search</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="ubersuggest-state-select" className="block text-[11px] font-medium text-slate-500 mb-1">
              States / Regions (Your Choice)
            </label>
            <StateMultiSelector
              id="ubersuggest-state-select"
              ariaLabel="States or regions"
              country={country}
              value={stateRegion}
              onChange={onChangeStateRegion}
            />
          </div>
          <div>
            <label htmlFor="ubersuggest-engine-select" className="block text-[11px] font-medium text-slate-500 mb-1">
              Search / Discovery Engine
            </label>
            <SearchEngineSelect
              id="ubersuggest-engine-select"
              ariaLabel="Search engine"
              value={searchEngine}
              onChange={onChangeSearchEngine}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {statusNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
            {statusNotice}
          </div>
        )}
      </form>

      {/* VIEW 1: AI KEYWORD OVERVIEW */}
      {activeSection === 'keyword-overview' && overview && (
        <div className="space-y-6">
          {/* Header Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <h1 className="text-2xl font-display font-bold tracking-tight leading-snug">
              AI Keyword Overview{' '}
              <span className="font-normal text-slate-500 dark:text-slate-400">for</span>{' '}
              <span className="underline decoration-[#565FEA]/50 underline-offset-4">{overview.keyword}</span>
              <button
                type="button"
                aria-label={`Save ${overview.keyword} to keyword list`}
                onClick={() =>
                  void handleSaveKeyword({
                    keyword: overview.keyword,
                    volume: overview.monthlyVolumeTotal,
                    difficulty: overview.seoDifficulty,
                    cpc: overview.cpcValue,
                    intent: overview.searchIntent,
                  })
                }
                className="ml-2.5 inline-flex items-center justify-center align-middle p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Add keyword to Keyword List"
              >
                {savedKeywordSet.has(overview.keyword.toLowerCase()) ? (
                  <Check className="w-4 h-4 text-[#16A34A]" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 lg:max-w-sm lg:text-right">
              {overview.provenanceSummary}
            </p>
          </div>

          {/* 6 KPI Summary Cards (3 wide cards x 2 rows) with Monthly Search Volume, Paid Difficulty (PD) & Help Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Search Volume / mo</span>
                <MetricTooltip
                  label="Search Volume per month"
                  text="Volume is the number of searches this particular keyword has during a month."
                />
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums text-[#565FEA] dark:text-[#8E96FF]">
                {formatCompactMonthlyVolume(overview.monthlyVolumeTotal)}{' '}
                <span className="text-xs font-sans font-medium text-slate-400">/mo</span>
              </div>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {overview.monthlyVolumeTotal.toLocaleString()} searches / month
              </div>
            </div>

            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>SEO Difficulty</span>
                <MetricTooltip
                  label="SEO Difficulty"
                  text="Estimated organic search competition (1–100). Lower scores indicate stronger First Page Potential (FPP)."
                />
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums">
                <DifficultySignalIndicator difficulty={overview.seoDifficulty} showFpp />
              </div>
              <div className="text-xs font-semibold text-[#16A34A]">
                {overview.seoDifficultyLabel.toUpperCase()} · Over 6 months
              </div>
            </div>

            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Paid Difficulty (PD)</span>
                <MetricTooltip
                  label="Paid Difficulty"
                  text="Estimated competition in paid search ads (1–100). Higher numbers mean more advertisers bidding."
                />
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums">
                {overview.paidDifficulty ?? Math.min(99, Math.max(8, Math.round(overview.cpcValue * 6) + 12))}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Google Ads Bid Competition
              </div>
            </div>

            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Search Intent</span>
                <MetricTooltip
                  label="Search Intent"
                  text="Primary searcher purpose: I = Informational, C = Commercial, T = Transactional, N = Navigational."
                />
              </div>
              <div className="flex items-center gap-2">
                <IntentLetterBadge intent={overview.searchIntent} />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {overview.searchIntentBreakdown.commercialPct}% Comm · {overview.searchIntentBreakdown.informationalPct}% Info
              </div>
            </div>

            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Cost Per Click</span>
                <MetricTooltip
                  label="Cost Per Click"
                  text="Estimated Cost Per Click advertisers pay for this keyword in the selected location currency."
                />
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-[11px] font-bold">
                  $
                </span>
                <span>
                  {overview.cpcCurrencySymbol}
                  {Number(overview.cpcValue).toFixed(2)}
                </span>
              </div>
              <div
                className={`text-xs font-semibold ${
                  overview.cpcCompetitiveness === 'High'
                    ? 'text-[#DC2626]'
                    : overview.cpcCompetitiveness === 'Medium'
                      ? 'text-[#D97706]'
                      : 'text-[#16A34A]'
                }`}
              >
                {overview.cpcCompetitiveness.toUpperCase()} PAID BID
              </div>
            </div>

            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>SERP &amp; Backlinks</span>
                <MetricTooltip
                  label="SERP Features and Top Pages Backlinks"
                  text="Active rich SERP features detected alongside average backlinks held by top ranking pages."
                />
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums">
                {overview.serpFeaturesCount} <span className="text-xs font-sans text-slate-400">features</span>
              </div>
              <button
                type="button"
                onClick={() => serpSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF] hover:underline cursor-pointer"
              >
                Avg {overview.topPagesAvgBacklinks.toLocaleString()} backlinks ↓
              </button>
            </div>
          </div>

          {/* Search Volume (Total / Devices) + AI Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>
                      Monthly Search Volume ({overview.searchEngine} · {formatGeoLabel(overview.country, overview.state)})
                    </span>
                    <MetricTooltip
                      label="Monthly Search Volume"
                      text="Volume is the number of searches this particular keyword has during a month."
                    />
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2.5 mt-0.5">
                    <div className="text-2xl font-mono font-bold tabular-nums">
                      {formatCompactMonthlyVolume(overview.monthlyVolumeTotal)}
                      <span className="text-xs font-sans font-semibold text-slate-400 ml-1">/ month</span>
                    </div>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      ({overview.monthlyVolumeTotal.toLocaleString()} searches)
                    </span>
                    {typeof overview.wikimediaPageviewsTotal === 'number' && overview.wikimediaPageviewsTotal > 0 && (
                      <span className="text-[11px] font-mono text-[#638D50] dark:text-[#8BC374]">
                        Wikimedia 6mo: {overview.wikimediaPageviewsTotal.toLocaleString()} real views
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setVolumeTab('total')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      volumeTab === 'total'
                        ? 'bg-white dark:bg-[#151A33] text-[#171B35] dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setVolumeTab('devices')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      volumeTab === 'devices'
                        ? 'bg-white dark:bg-[#151A33] text-[#171B35] dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Devices
                  </button>
                </div>
              </div>

              {volumeTab === 'devices' && (
                <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono tabular-nums">
                      <span>Desktop Search</span>
                      <span className="font-bold">{overview.deviceSplit.desktopPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-[#565FEA]" style={{ width: `${overview.deviceSplit.desktopPct}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono tabular-nums">
                      <span>Mobile Search</span>
                      <span className="font-bold">{overview.deviceSplit.mobilePct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-[#FF704D]" style={{ width: `${overview.deviceSplit.mobilePct}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* 6-Month Bar Chart */}
              <div className="grid grid-cols-6 gap-3 pt-2 items-end h-36">
                {overview.volumeHistory.map((item) => {
                  const maxTotal = Math.max(...overview.volumeHistory.map((v) => v.total), 1);
                  const totalH = Math.max(18, Math.round((item.total / maxTotal) * 100));
                  const mobileH = Math.round((item.mobile / item.total) * totalH);
                  const desktopH = Math.max(4, totalH - mobileH);
                  return (
                    <div key={item.month} className="flex flex-col items-center justify-end h-full gap-1.5">
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        {item.total >= 1000 ? `${(item.total / 1000).toFixed(1)}K` : item.total}
                      </span>
                      {volumeTab === 'total' ? (
                        <div
                          className="w-full max-w-[36px] rounded-t-md bg-[#565FEA] transition-all"
                          style={{ height: `${totalH}%` }}
                          title={`${item.month}: ${item.total.toLocaleString()} searches`}
                        />
                      ) : (
                        <div className="w-full max-w-[36px] flex flex-col justify-end rounded-t-md overflow-hidden" style={{ height: `${totalH}%` }}>
                          <div className="w-full bg-[#565FEA]" style={{ height: `${Math.round((desktopH / totalH) * 100)}%` }} />
                          <div className="w-full bg-[#FF704D]" style={{ height: `${Math.round((mobileH / totalH) * 100)}%` }} />
                        </div>
                      )}
                      <span className="text-[11px] font-mono text-slate-400">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-display font-bold">AI Summary</h2>
                  <button
                    type="button"
                    onClick={() => void handleGenerateLiveAiOverview()}
                    disabled={aiOverviewLoading}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {aiOverviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Refresh via Gemini</span>
                  </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{overview.aiSummary}</p>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                Language: {overview.language} · Region: {formatGeoLabel(overview.country, overview.state)}
              </div>
            </div>
          </div>

          {/* Brands Mentioned by AI + AI Overview & Top 10 Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-5 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-display font-bold">Brands and Sources Mentioned by AI</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Domains and brands surfaced across AI answers for “{overview.keyword}”.
                </p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.brandsMentioned.map((b) => (
                  <div key={b.brand} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-sm text-[#171B35] dark:text-white">{b.brand}</div>
                      <div className="text-slate-400">{b.domain}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-semibold">{b.mentions} mentions</div>
                      <div className="text-[#638D50] dark:text-[#8BC374]">{b.sentiment}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-7 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#565FEA]" />
                  <h2 className="text-base font-display font-bold">AI Overview</h2>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {overview.aiOverview}
                </p>
              </div>
              <div className="md:col-span-5 md:border-l border-slate-100 dark:border-slate-800 md:pl-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Top Sources from AI Overview
                </h3>
                <ol className="space-y-1.5 text-xs">
                  {overview.topAiSources.slice(0, 10).map((src) => {
                    const safeHref = validateSafeUrl(src.url);
                    return (
                      <li key={src.rank} className="flex items-baseline gap-2 truncate">
                        <span className="font-mono tabular-nums text-slate-400 w-4 shrink-0">{src.rank}.</span>
                        {safeHref ? (
                          <a
                            href={safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#565FEA] dark:text-[#8E96FF] hover:underline truncate"
                            title={src.title}
                          >
                            {src.domain}
                          </a>
                        ) : (
                          <span className="truncate">{src.domain}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>

          {/* Prompts Intent · Search Intent · Click Behavior */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <div>
                <h2 className="text-sm font-display font-bold">Prompts Intent</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  User purpose behind asking AI apps
                </p>
              </div>
              {[
                { label: 'Informational', val: overview.promptsIntent.informationalPct, color: 'bg-[#565FEA]' },
                { label: 'Commercial', val: overview.promptsIntent.commercialPct, color: 'bg-[#638D50]' },
                { label: 'Transactional', val: overview.promptsIntent.transactionalPct, color: 'bg-[#FF704D]' },
                { label: 'Navigational', val: overview.promptsIntent.navigationalPct, color: 'bg-slate-400' },
              ].map((row) => (
                <div key={row.label} className="space-y-1 text-xs">
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>{row.label}</span>
                    <span>{row.val}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full ${row.color}`} style={{ width: `${row.val}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <div>
                <h2 className="text-sm font-display font-bold">Search Intent</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  User intent funnel behind web searches
                </p>
              </div>
              {[
                { label: 'Informational', val: overview.searchIntentBreakdown.informationalPct },
                { label: 'Commercial', val: overview.searchIntentBreakdown.commercialPct },
                { label: 'Transactional', val: overview.searchIntentBreakdown.transactionalPct },
                { label: 'Navigational', val: overview.searchIntentBreakdown.navigationalPct },
              ].map((step) => (
                <div key={step.label} className="space-y-1 text-xs">
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>{step.label}</span>
                    <span>{step.val}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 flex justify-center overflow-hidden">
                    <div className="h-full bg-[#565FEA] rounded-full" style={{ width: `${Math.max(12, step.val)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-display font-bold">Click Behavior</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Estimated audience click distribution
                </p>
              </div>
              <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                <div
                  className="bg-[#638D50] h-full"
                  style={{ width: `${overview.clickBehavior.organicClicksPct}%` }}
                  title={`Organic Clicks: ${overview.clickBehavior.organicClicksPct}%`}
                />
                <div
                  className="bg-[#565FEA] h-full"
                  style={{ width: `${overview.clickBehavior.paidClicksPct}%` }}
                  title={`Paid Clicks: ${overview.clickBehavior.paidClicksPct}%`}
                />
                <div
                  className="bg-[#FF704D] h-full"
                  style={{ width: `${overview.clickBehavior.noClickPct}%` }}
                  title={`No Click / AI Answer: ${overview.clickBehavior.noClickPct}%`}
                />
              </div>
              <div className="space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="text-[#638D50] dark:text-[#8BC374] font-semibold">Organic Clicks</span>
                  <span>{overview.clickBehavior.organicClicksPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#565FEA] dark:text-[#8E96FF] font-semibold">Paid Clicks</span>
                  <span>{overview.clickBehavior.paidClicksPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FF704D] font-semibold">No-Click / Zero-Click AI</span>
                  <span>{overview.clickBehavior.noClickPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Prompt Ideas + 4-Quadrant Keyword Ideas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* AI Prompt Ideas */}
            <div className="lg:col-span-6 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-display font-bold">
                    AI Prompt Ideas <span className="font-normal text-slate-400">for {overview.keyword}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real prompts users ask ChatGPT &amp; Gemini in {overview.language}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeSection('ai-prompt-ideas')}
                  className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF] hover:underline cursor-pointer shrink-0"
                >
                  Open All Prompts
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.aiPromptIdeas.map((p) => (
                  <div key={p.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">
                          {p.platform} · {p.intent}
                        </div>
                        <p className="text-sm text-[#171B35] dark:text-slate-100" dir="auto">
                          {p.prompt}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={p.loading}
                        onClick={() => void handleRunAiPrompt(p)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {p.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                        <span>Get AI Response</span>
                      </button>
                    </div>

                    {p.error && <p className="text-xs text-red-600 dark:text-red-400">{p.error}</p>}
                    {p.answer && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0D1021] text-xs space-y-2">
                        <p className="text-slate-700 dark:text-slate-200 leading-relaxed" dir="auto">
                          {p.answer}
                        </p>
                        {p.brandsMentioned && p.brandsMentioned.length > 0 && (
                          <div className="text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-[#171B35] dark:text-white">Brands Mentioned: </span>
                            {p.brandsMentioned.join(' · ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4-Card Keyword Ideas */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-display font-bold">
                    Keyword Ideas <span className="font-normal text-slate-400">for {overview.keyword}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Google Autocomplete, Questions, Prepositions &amp; Comparisons
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIdeasFilterCategory('all');
                    onChangeSection('keyword-ideas');
                  }}
                  className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF] hover:underline cursor-pointer"
                >
                  View All Ideas
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CATEGORY_META.map((cat) => {
                  const items = overview.keywordIdeas[cat.id];
                  return (
                    <div
                      key={cat.id}
                      className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="font-bold text-sm text-[#171B35] dark:text-white">{cat.title}</span>
                        <span className="font-mono text-slate-400">Vol/mo · SD</span>
                      </div>

                      <div className="space-y-2">
                        {items.slice(0, 5).map((item) => {
                          const isSaved = savedKeywordSet.has(item.keyword.toLowerCase());
                          return (
                            <div key={item.keyword} className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                  type="button"
                                  aria-label={`Save ${item.keyword} to list`}
                                  onClick={() => void handleSaveKeyword(item)}
                                  className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                                >
                                  {isSaved ? (
                                    <Check className="w-3 h-3 text-[#16A34A]" />
                                  ) : (
                                    <Plus className="w-3 h-3" />
                                  )}
                                </button>
                                <IntentLetterBadge intent={item.intent} compact />
                                <span className="truncate" title={item.keyword}>
                                  {item.keyword}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 font-mono tabular-nums shrink-0 text-slate-600 dark:text-slate-300">
                                <span title={`${item.volume.toLocaleString()} monthly searches`}>
                                  {formatCompactMonthlyVolume(item.volume)}
                                </span>
                                <DifficultySignalIndicator difficulty={item.difficulty} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIdeasFilterCategory(cat.id);
                          onChangeSection('keyword-ideas');
                        }}
                        className="text-xs font-semibold text-[#FF704D] hover:underline cursor-pointer"
                      >
                        View {items.length} &gt;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live Google Trends RSS Radar + 1-Click FAQ Schema JSON-LD */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-6 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-display font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#FF704D]" />
                    <span>Trending Search Radar</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live Google Trends RSS topics for {overview.country} · click any topic to analyse
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRefreshTrends()}
                  disabled={trendsLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {trendsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Refresh Trends</span>
                </button>
              </div>

              {(() => {
                const liveTrendsList = trendsOverride ?? overview.trendingNow ?? [];
                if (liveTrendsList.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Click Refresh Trends to load today&apos;s live regional searches from Google Trends RSS.
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {liveTrendsList.slice(0, 8).map((trend) => (
                      <button
                        key={trend.title}
                        type="button"
                        onClick={() => {
                          onChangeKeyword(trend.title);
                          void fetchOverview(trend.title);
                        }}
                        className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#565FEA] hover:bg-slate-50 dark:hover:bg-[#0D1021] transition-colors cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#171B35] dark:text-white truncate">{trend.title}</span>
                          <span className="font-mono text-[11px] text-[#FF704D] shrink-0">{trend.approxTraffic}</span>
                        </div>
                        {trend.relatedNewsTitle && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {trend.relatedNewsTitle}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {overview.faqJsonLdSnippet && (
              <div className="lg:col-span-6 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-display font-bold flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#565FEA]" />
                      <span>FAQPage Schema JSON-LD</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Deployable structured markup generated from real Questions for “{overview.keyword}”
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyFaqJsonLd(overview.faqJsonLdSnippet || '')}
                    className="px-3 py-1.5 rounded-lg bg-[#565FEA] text-white text-xs font-semibold hover:bg-[#464ED8] inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedFaq ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFaq ? 'Copied JSON-LD' : 'Copy Schema'}</span>
                  </button>
                </div>
                <pre className="flex-1 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1021] border border-slate-200 dark:border-slate-800 text-[11px] font-mono overflow-x-auto max-h-64 text-slate-700 dark:text-slate-200">
                  {overview.faqJsonLdSnippet}
                </pre>
              </div>
            )}
          </div>

          {/* Knowledge Graph Entities (Wikidata SPARQL) & Industry News Monitor (RSS Aggregator) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-display font-bold flex items-center gap-2">
                  <Network className="w-4 h-4 text-[#565FEA]" />
                  <span>Knowledge Graph Entities (Wikidata SPARQL)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Linked QID entities, industries &amp; official domains resolved for “{overview.keyword}”
                </p>
              </div>

              {overview.entityGraph && overview.entityGraph.length > 0 ? (
                <div className="space-y-2.5">
                  {overview.entityGraph.map((entity) => {
                    const safeEntityUrl = validateSafeUrl(entity.wikidataUrl);
                    const safeOfficial = entity.officialWebsite ? validateSafeUrl(entity.officialWebsite) : null;
                    return (
                      <div
                        key={entity.qid}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0D1021] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-[#171B35] dark:text-white truncate">
                            {entity.label}
                          </span>
                          {safeEntityUrl ? (
                            <a
                              href={safeEntityUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-mono text-[#565FEA] dark:text-[#8E96FF] hover:underline inline-flex items-center gap-1 shrink-0"
                            >
                              <span>{entity.qid}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-400">{entity.qid}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{entity.description}</p>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {entity.industry && <span>Industry: {entity.industry}</span>}
                          {entity.inception && <span>Founded: {entity.inception}</span>}
                          {safeOfficial && (
                            <a
                              href={safeOfficial}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#565FEA] dark:text-[#8E96FF] hover:underline inline-flex items-center gap-1"
                            >
                              <span>Official site</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No direct Wikidata entities matched “{overview.keyword}”. Try a brand name, product, or broad industry topic.
                </p>
              )}
            </div>

            <div className="lg:col-span-6 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-display font-bold flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-[#FF704D]" />
                    <span>Industry News Monitor (RSS Aggregator)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live RSS/Atom headlines from Google News &amp; custom feeds for “{overview.keyword}”
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRefreshNews()}
                  disabled={newsLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${newsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh News</span>
                </button>
              </div>

              {(() => {
                const liveNews = newsOverride ?? overview.industryNews ?? [];
                if (liveNews.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Click Refresh News to fetch live RSS &amp; Feedly headlines for this keyword.
                    </p>
                  );
                }
                return (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {liveNews.slice(0, 6).map((item, idx) => {
                      const safeUrl = validateSafeUrl(item.url);
                      return (
                        <div
                          key={`${item.title}-${idx}`}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#565FEA] transition-colors space-y-1"
                        >
                          {safeUrl ? (
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-[#171B35] dark:text-white hover:text-[#565FEA] dark:hover:text-[#8E96FF] flex items-start justify-between gap-2"
                            >
                              <span className="line-clamp-2">{item.title}</span>
                              <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                            </a>
                          ) : (
                            <p className="text-xs font-semibold text-[#171B35] dark:text-white">{item.title}</p>
                          )}
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="truncate">{item.source}</span>
                            {item.publishedAt && <span className="font-mono shrink-0">{item.publishedAt.slice(0, 16)}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Audience Age Bar Chart */}
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-display font-bold">Audience Age</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estimated age distribution for “{overview.keyword}” in {formatGeoLabel(overview.country, overview.state)}
              </p>
            </div>
            <div className="grid grid-cols-6 gap-4 items-end h-40 pt-2">
              {overview.audienceAge.map((age) => {
                const maxPct = Math.max(...overview.audienceAge.map((a) => a.pct), 1);
                const h = Math.max(12, Math.round((age.pct / maxPct) * 100));
                return (
                  <div key={age.bracket} className="flex flex-col items-center justify-end h-full gap-1.5">
                    <span className="text-xs font-mono font-bold tabular-nums">{age.pct}%</span>
                    <div
                      className="w-full max-w-[54px] rounded-t-lg bg-[#FF704D]/85 dark:bg-[#FF704D]"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{age.bracket}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search Results Table */}
          <div
            ref={serpSectionRef}
            id="serp-results-section"
            className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-display font-bold">Search Results</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {overview.searchEngine} top pages for “{overview.keyword}” · Backlinks, Visits, Authority &amp; Shares
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleExportCsvFile(
                    `serp-${overview.keyword.replace(/\W+/g, '-')}.csv`,
                    ['Position', 'Title', 'URL', 'Domain', 'Backlinks', 'Visits', 'Authority', 'Shares'],
                    overview.searchResults.map((r) => ({
                      Position: r.position,
                      Title: r.title,
                      URL: r.url,
                      Domain: r.domain,
                      Backlinks: r.backlinks,
                      Visits: r.visits,
                      Authority: r.authority,
                      Shares: r.shares,
                    }))
                  )
                }
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
                    <th className="pb-3 pr-3 font-medium">#</th>
                    <th className="pb-3 pr-4 font-medium">{overview.searchEngine} Search Results</th>
                    <th className="pb-3 pr-4 font-medium text-right">Backlinks</th>
                    <th className="pb-3 pr-4 font-medium text-right">Visits</th>
                    <th className="pb-3 pr-4 font-medium text-right">Authority</th>
                    <th className="pb-3 font-medium text-right">Shares</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {overview.searchResults.map((row) => {
                    const safeHref = validateSafeUrl(row.url);
                    return (
                      <tr key={`${row.position}-${row.url}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 pr-3 font-mono tabular-nums text-slate-400">{row.position}</td>
                        <td className="py-3 pr-4 max-w-md">
                          <div className="font-semibold text-[#171B35] dark:text-white truncate">{row.title}</div>
                          {safeHref ? (
                            <a
                              href={safeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#565FEA] dark:text-[#8E96FF] hover:underline inline-flex items-center gap-1 truncate max-w-full"
                            >
                              <span className="truncate">{row.domain}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">{row.domain}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{row.backlinks.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{row.visits.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold">{row.authority}</td>
                        <td className="py-3 text-right font-mono tabular-nums">{row.shares.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Content Ideas Table */}
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-display font-bold">Content Ideas</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  High-engagement discussions &amp; articles discovered for “{overview.keyword}”
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllContentIdeas((v) => !v)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {showAllContentIdeas ? 'Show Top 4' : `View All (${overview.contentIdeas.length})`}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Page Title / URL</th>
                    <th className="pb-3 pr-4 font-medium">Source</th>
                    <th className="pb-3 pr-4 font-medium text-right">Est. Visits</th>
                    <th className="pb-3 pr-4 font-medium text-right">Backlinks</th>
                    <th className="pb-3 font-medium text-right">Shares</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(showAllContentIdeas ? overview.contentIdeas : overview.contentIdeas.slice(0, 4)).map((c, idx) => {
                    const safeHref = validateSafeUrl(c.url);
                    return (
                      <tr key={`${c.url}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 pr-4 max-w-lg">
                          {safeHref ? (
                            <a
                              href={safeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[#171B35] dark:text-white hover:text-[#565FEA] hover:underline block truncate"
                            >
                              {c.title}
                            </a>
                          ) : (
                            <span className="font-medium block truncate">{c.title}</span>
                          )}
                          <span className="text-xs text-slate-400">{c.domain}</span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400">{c.source}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{c.estVisits.toLocaleString()}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{c.backlinks.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono tabular-nums">{c.socialShares.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: BULK KEYWORD ANALYSIS */}
      {activeSection === 'bulk-analysis' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-display font-bold">Bulk Keyword Analysis</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paste up to 25 keywords (one per line or CSV) to compare Volume, SEO Difficulty, CPC, Intent &amp; Backlinks for {formatGeoLabel(country, stateRegion)}.
                </p>
              </div>
              <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV / TXT</span>
                <input type="file" accept=".csv,.txt" onChange={handleBulkCsvUpload} className="sr-only" />
              </label>
            </div>

            <textarea
              aria-label="Bulk keywords input"
              rows={5}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Enter up to 25 keywords, one per line..."
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-mono"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={bulkLoading}
                onClick={() => void handleRunBulkAnalysis()}
                className="px-5 py-2.5 rounded-xl bg-[#565FEA] text-white text-sm font-semibold hover:bg-[#464ED8] inline-flex items-center gap-2 cursor-pointer"
              >
                {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
                <span>Analyse Bulk Keywords</span>
              </button>

              {bulkRows.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleExportCsvFile(
                      'bulk-keyword-analysis.csv',
                      ['Keyword', 'Volume', 'SEO Difficulty', 'CPC', 'Intent', 'SERP Features', 'Avg Backlinks', 'No-Click %'],
                      bulkRows.map((r) => ({
                        Keyword: r.keyword,
                        Volume: r.volume,
                        'SEO Difficulty': r.difficulty,
                        CPC: `${r.currencySymbol}${r.cpc}`,
                        Intent: r.intent,
                        'SERP Features': r.serpFeatures.join('; '),
                        'Avg Backlinks': r.topPagesAvgBacklinks,
                        'No-Click %': `${r.noClickPct}%`,
                      }))
                    )
                  }
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          {bulkRows.length > 0 && (
            <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                    <th className="pb-3 pr-4">Save</th>
                    <th className="pb-3 pr-4">Keyword</th>
                    <th className="pb-3 pr-4">Intent</th>
                    <th className="pb-3 pr-4 text-right">Volume / mo</th>
                    <th className="pb-3 pr-4 text-right">CPC</th>
                    <th className="pb-3 pr-4 text-right">PD</th>
                    <th className="pb-3 pr-4">SEO Difficulty</th>
                    <th className="pb-3 pr-4">SERP Features</th>
                    <th className="pb-3 text-right">No-Click %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bulkRows.map((row) => {
                    const isSaved = savedKeywordSet.has(row.keyword.toLowerCase());
                    return (
                      <tr key={row.keyword} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            aria-label={`Save ${row.keyword} to list`}
                            onClick={() => void handleSaveKeyword(row)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                          >
                            {isSaved ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="py-3 pr-4 font-semibold">{row.keyword}</td>
                        <td className="py-3 pr-4">
                          <IntentLetterBadge intent={row.intent} compact />
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums" title={`${row.volume.toLocaleString()} searches / month`}>
                          <span className="font-semibold">{formatCompactMonthlyVolume(row.volume)}</span>{' '}
                          <span className="text-[11px] text-slate-400">/mo</span>
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">
                          {row.currencySymbol}
                          {Number(row.cpc).toFixed(2)}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{row.paidDifficulty ?? 18}</td>
                        <td className="py-3 pr-4">
                          <DifficultySignalIndicator difficulty={row.difficulty} />
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-500">{row.serpFeatures.join(' · ')}</td>
                        <td className="py-3 text-right font-mono tabular-nums">{row.noClickPct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: KEYWORD IDEAS (UBERSUGGEST FULL MATRIX WITH VOLUME/MO, FPP, INTENT, CPC, PD, SD) */}
      {activeSection === 'keyword-ideas' && overview && (
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-display font-bold flex items-center gap-2">
                <span>
                  Keyword Ideas <span className="font-normal text-slate-500 dark:text-slate-400">{overview.keyword}</span>
                </span>
                <MetricTooltip
                  label="Keyword Ideas"
                  text="Discover search suggestions, questions, prepositions, and comparisons with monthly search volume, CPC, Paid Difficulty (PD), and SEO Difficulty."
                />
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatGeoLabel(overview.country, overview.state)} · {overview.language} · Monthly Search Volume &amp; Competition Indicators
              </p>
            </div>
          </div>

          {/* Category Tabs with Counts */}
          <div className="flex flex-wrap items-center gap-5 border-b border-slate-200 dark:border-slate-800">
            {[
              {
                id: 'all' as const,
                label: 'All Ideas',
                count:
                  overview.keywordIdeas.autocomplete.length +
                  overview.keywordIdeas.questions.length +
                  overview.keywordIdeas.prepositions.length +
                  overview.keywordIdeas.comparisons.length,
              },
              ...CATEGORY_META.map((c) => ({
                id: c.id,
                label: c.title.replace('Google ', ''),
                count: overview.keywordIdeas[c.id].length,
              })),
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setIdeasFilterCategory(tab.id)}
                className={`pb-3 text-xs font-semibold inline-flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                  ideasFilterCategory === tab.id
                    ? 'border-[#FF704D] text-[#FF704D]'
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-[#171B35] dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Multi-Filter Bar matching screenshot */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by First Page Potential (FPP)"
              value={ideasFppFilter}
              onChange={(e) => setIdeasFppFilter(e.target.value as 'all' | 'high' | 'good' | 'competitive')}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs font-medium"
            >
              <option value="all">First Page Potential (FPP)</option>
              <option value="high">High FPP (SD ≤ 25)</option>
              <option value="good">Good FPP (SD ≤ 40)</option>
              <option value="competitive">Competitive (SD &gt; 40)</option>
            </select>

            <select
              aria-label="Filter by Monthly Volume"
              value={ideasVolFilter}
              onChange={(e) => setIdeasVolFilter(e.target.value as 'all' | '100' | '500' | '1000' | '5000')}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs font-medium"
            >
              <option value="all">Volume / Month</option>
              <option value="100">100+ / mo</option>
              <option value="500">500+ / mo</option>
              <option value="1000">1,000+ / mo</option>
              <option value="5000">5,000+ / mo</option>
            </select>

            <select
              aria-label="Filter by Intent"
              value={ideasIntentFilter}
              onChange={(e) => setIdeasIntentFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs font-medium"
            >
              <option value="all">Intent (All)</option>
              <option value="Informational">I · Informational</option>
              <option value="Commercial">C · Commercial</option>
              <option value="Transactional">T · Transactional</option>
              <option value="Navigational">N · Navigational</option>
            </select>

            <select
              aria-label="Filter by SEO Difficulty"
              value={ideasSdFilter}
              onChange={(e) => setIdeasSdFilter(e.target.value as 'all' | 'easy' | 'low' | 'medium' | 'high')}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs font-medium"
            >
              <option value="all">SEO Difficulty</option>
              <option value="easy">Easy (0–20)</option>
              <option value="low">Low (21–38)</option>
              <option value="medium">Medium (39–60)</option>
              <option value="high">High (61+)</option>
            </select>

            <select
              aria-label="Filter by Cost Per Click"
              value={ideasCpcFilter}
              onChange={(e) => setIdeasCpcFilter(e.target.value as 'all' | 'low' | 'mid' | 'high')}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs font-medium"
            >
              <option value="all">Cost Per Click</option>
              <option value="low">Low (&lt; 1.50)</option>
              <option value="mid">Mid (1.50–4.00)</option>
              <option value="high">High (&gt; 4.00)</option>
            </select>

            <input
              type="text"
              value={ideasSearchFilter}
              onChange={(e) => setIdeasSearchFilter(e.target.value)}
              placeholder="Include / -Exclude words..."
              aria-label="Include or exclude keyword words"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
            />
          </div>

          {/* Selection Counter + Export / Copy / Update / Add to List Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-y border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-mono text-slate-500 dark:text-slate-400">
                {selectedIdeaKeywords.size} of {filteredIdeasList.length + 1} Selected
              </span>

              <button
                type="button"
                onClick={() => {
                  const exportSet =
                    selectedIdeaKeywords.size > 0
                      ? filteredIdeasList.filter((i) => selectedIdeaKeywords.has(i.keyword))
                      : filteredIdeasList;
                  handleExportCsvFile(
                    `keyword-ideas-${overview.keyword.replace(/\W+/g, '-')}.csv`,
                    ['Keyword', 'Intent', 'VolumePerMonth', 'CPC', 'PD', 'SEODifficulty', 'Category', 'Source'],
                    exportSet.map((i) => ({
                      Keyword: i.keyword,
                      Intent: i.intent,
                      VolumePerMonth: i.volume,
                      CPC: `${overview.cpcCurrencySymbol}${i.cpc}`,
                      PD: i.paidDifficulty ?? 18,
                      SEODifficulty: i.difficulty,
                      Category: i.category,
                      Source: i.source,
                    }))
                  );
                }}
                className="inline-flex items-center gap-1.5 font-semibold text-[#FF704D] hover:underline cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopySelectedIdeas(filteredIdeasList)}
                className="inline-flex items-center gap-1.5 font-semibold text-[#FF704D] hover:underline cursor-pointer"
              >
                {copiedSelection ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSelection ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={() => void fetchOverview(overview.keyword)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 font-semibold text-[#FF704D] hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Update</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSelectedIdeasToList(filteredIdeasList)}
                className="inline-flex items-center gap-1.5 font-semibold text-[#FF704D] hover:underline cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Add to List</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400">
              Click any column header to sort · Hover ? for metric definitions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-3 pr-2 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all visible keywords"
                      checked={
                        filteredIdeasList.length > 0 &&
                        filteredIdeasList.every((i) => selectedIdeaKeywords.has(i.keyword))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIdeaKeywords(new Set(filteredIdeasList.map((i) => i.keyword)));
                        } else {
                          setSelectedIdeaKeywords(new Set());
                        }
                      }}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="pb-3 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span>Keyword</span>
                      <MetricTooltip
                        label="Keyword"
                        text="Search phrase discovered for your seed topic across autocomplete, questions, prepositions, and comparisons."
                      />
                      <button
                        type="button"
                        aria-label="Sort by keyword"
                        onClick={() => handleToggleSortIdeas('keyword')}
                        className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </th>
                  <th className="pb-3 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span>Intent</span>
                      <MetricTooltip
                        label="Intent"
                        text="Primary searcher intent: I = Informational, C = Commercial, T = Transactional, N = Navigational."
                      />
                    </span>
                  </th>
                  <th className="pb-3 pr-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span>Volume / mo</span>
                      <MetricTooltip
                        label="Volume per month"
                        text="Volume is the number of searches this particular keyword has during a month."
                      />
                      <button
                        type="button"
                        aria-label="Sort by monthly volume"
                        onClick={() => handleToggleSortIdeas('volume')}
                        className={`p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                          ideasSortField === 'volume' ? 'text-[#FF704D]' : ''
                        }`}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </th>
                  <th className="pb-3 pr-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span>CPC</span>
                      <MetricTooltip
                        label="Cost Per Click"
                        text="Average Cost Per Click advertisers pay for clicks on this keyword in the selected market currency."
                      />
                      <button
                        type="button"
                        aria-label="Sort by CPC"
                        onClick={() => handleToggleSortIdeas('cpc')}
                        className={`p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                          ideasSortField === 'cpc' ? 'text-[#FF704D]' : ''
                        }`}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </th>
                  <th className="pb-3 pr-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span>PD</span>
                      <MetricTooltip
                        label="Paid Difficulty"
                        text="Paid Difficulty (1–100): estimated ad competition in Google Ads. Higher values indicate more competing advertisers."
                      />
                      <button
                        type="button"
                        aria-label="Sort by Paid Difficulty"
                        onClick={() => handleToggleSortIdeas('paidDifficulty')}
                        className={`p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                          ideasSortField === 'paidDifficulty' ? 'text-[#FF704D]' : ''
                        }`}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </th>
                  <th className="pb-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span>SEO Difficulty</span>
                      <MetricTooltip
                        label="SEO Difficulty"
                        text="Estimated organic ranking competition (1–100). Lower values indicate stronger First Page Potential."
                      />
                      <button
                        type="button"
                        aria-label="Sort by SEO Difficulty"
                        onClick={() => handleToggleSortIdeas('difficulty')}
                        className={`p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                          ideasSortField === 'difficulty' ? 'text-[#FF704D]' : ''
                        }`}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* YOUR KEYWORDS Highlighted Seed Row */}
                <tr className="bg-slate-50/70 dark:bg-[#0D1021]/70">
                  <td colSpan={7} className="pt-2.5 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    Your Keywords
                  </td>
                </tr>
                <tr className="bg-slate-50/40 dark:bg-[#0D1021]/40 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 pr-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${overview.keyword}`}
                      checked={selectedIdeaKeywords.has(overview.keyword)}
                      onChange={() => handleToggleSelectIdea(overview.keyword)}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Save ${overview.keyword} to list`}
                        onClick={() =>
                          void handleSaveKeyword({
                            keyword: overview.keyword,
                            volume: overview.monthlyVolumeTotal,
                            difficulty: overview.seoDifficulty,
                            cpc: overview.cpcValue,
                            intent: overview.searchIntent,
                          })
                        }
                        className="p-1 rounded border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                      >
                        {savedKeywordSet.has(overview.keyword.toLowerCase()) ? (
                          <Check className="w-3 h-3 text-[#16A34A]" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                      </button>
                      <span className="font-semibold text-[#171B35] dark:text-white">{overview.keyword}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <IntentLetterBadge intent={overview.searchIntent} />
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums" title={`${overview.monthlyVolumeTotal.toLocaleString()} searches / month`}>
                    <span className="font-semibold text-[#171B35] dark:text-white">
                      {formatCompactMonthlyVolume(overview.monthlyVolumeTotal)}
                    </span>{' '}
                    <span className="text-[11px] text-slate-400">/mo</span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-[10px] font-bold">
                        $
                      </span>
                      <span>
                        {overview.cpcCurrencySymbol}
                        {Number(overview.cpcValue).toFixed(2)}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums font-medium">
                    {overview.paidDifficulty ?? Math.min(99, Math.max(8, Math.round(overview.cpcValue * 6) + 12))}
                  </td>
                  <td className="py-3">
                    <DifficultySignalIndicator difficulty={overview.seoDifficulty} statusTag="Seed" />
                  </td>
                </tr>

                {/* Discovered Keyword Ideas */}
                {filteredIdeasList.map((item) => {
                  const isSaved = savedKeywordSet.has(item.keyword.toLowerCase());
                  const isChecked = selectedIdeaKeywords.has(item.keyword);
                  return (
                    <tr key={`${item.category}-${item.keyword}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.keyword}`}
                          checked={isChecked}
                          onChange={() => handleToggleSelectIdea(item.keyword)}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Save ${item.keyword} to list`}
                            onClick={() => void handleSaveKeyword(item)}
                            className="p-1 rounded border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                          >
                            {isSaved ? <Check className="w-3 h-3 text-[#16A34A]" /> : <Plus className="w-3 h-3" />}
                          </button>
                          <span className="font-medium text-[#171B35] dark:text-white">{item.keyword}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">
                            {item.category}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <IntentLetterBadge intent={item.intent} />
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums" title={`${item.volume.toLocaleString()} searches / month`}>
                        <span className="font-semibold text-[#171B35] dark:text-white">
                          {formatCompactMonthlyVolume(item.volume)}
                        </span>{' '}
                        <span className="text-[11px] text-slate-400">/mo</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-[10px] font-bold">
                            $
                          </span>
                          <span>
                            {overview.cpcCurrencySymbol}
                            {Number(item.cpc).toFixed(2)}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums font-medium">
                        {item.paidDifficulty ?? Math.min(99, Math.max(8, Math.round(item.cpc * 4) + 12))}
                      </td>
                      <td className="py-2.5">
                        <DifficultySignalIndicator
                          difficulty={item.difficulty}
                          statusTag={item.provenance === 'Observed' ? 'Live' : 'Est.'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {overview.faqJsonLdSnippet && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-display font-bold flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[#565FEA]" />
                    <span>Generated Schema.org FAQPage JSON-LD</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Copy and paste inside your page &lt;head&gt; for Rich Results &amp; AI Answer citation eligibility.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyFaqJsonLd(overview.faqJsonLdSnippet || '')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedFaq ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedFaq ? 'Copied!' : 'Copy JSON-LD'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1021] border border-slate-200 dark:border-slate-800 text-[11px] font-mono overflow-x-auto max-h-44 text-slate-700 dark:text-slate-200">
                {overview.faqJsonLdSnippet}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: AI PROMPT IDEAS */}
      {activeSection === 'ai-prompt-ideas' && overview && (
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div>
            <h1 className="text-lg font-display font-bold">
              AI Prompt Ideas for “{overview.keyword}”
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Test how AI engines respond and which brands get cited in {overview.language} ({formatGeoLabel(overview.country, overview.state)}).
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!customPromptInput.trim()) return;
              const customItem: AiPromptIdeaItem = {
                id: `custom-${Date.now()}`,
                prompt: customPromptInput.trim(),
                platform: 'Gemini',
                language,
                intent: 'Commercial',
              };
              setOverview((prev) =>
                prev ? { ...prev, aiPromptIdeas: [customItem, ...prev.aiPromptIdeas] } : prev
              );
              setCustomPromptInput('');
              void handleRunAiPrompt(customItem);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={customPromptInput}
              onChange={(e) => setCustomPromptInput(e.target.value)}
              placeholder={`Ask a custom ChatGPT/Gemini prompt about "${overview.keyword}"...`}
              aria-label="Custom AI prompt"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#565FEA] text-white text-xs font-semibold hover:bg-[#464ED8] cursor-pointer"
            >
              Add &amp; Run Prompt
            </button>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {overview.aiPromptIdeas.map((p) => (
              <div key={p.id} className="py-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">
                      {p.platform} · {p.intent} · {p.language}
                    </div>
                    <div className="text-sm font-medium mt-0.5" dir="auto">
                      {p.prompt}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={p.loading}
                    onClick={() => void handleRunAiPrompt(p)}
                    className="px-3.5 py-2 rounded-lg bg-[#565FEA] text-white text-xs font-semibold hover:bg-[#464ED8] inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    {p.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    <span>Get AI Response</span>
                  </button>
                </div>

                {p.error && <p className="text-xs text-red-600 dark:text-red-400">{p.error}</p>}
                {p.answer && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0D1021] text-xs space-y-2">
                    <p className="text-slate-700 dark:text-slate-200 leading-relaxed" dir="auto">
                      {p.answer}
                    </p>
                    {p.brandsMentioned && p.brandsMentioned.length > 0 && (
                      <div className="text-slate-600 dark:text-slate-300">
                        <span className="font-semibold">Brands Mentioned: </span>
                        {p.brandsMentioned.join(' · ')}
                      </div>
                    )}
                    {p.sources && p.sources.length > 0 && (
                      <div className="flex flex-wrap gap-3 pt-1">
                        {p.sources.slice(0, 4).map((s) => (
                          <a
                            key={s.url}
                            href={validateSafeUrl(s.url) || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#565FEA] dark:text-[#8E96FF] hover:underline"
                          >
                            {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 5: KEYWORD LISTS */}
      {activeSection === 'keyword-lists' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 h-fit">
            <h1 className="text-base font-display font-bold flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4 text-[#565FEA]" />
              <span>Your Keyword Lists</span>
            </h1>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (newListName.trim().length < 2) return;
                try {
                  const res = await api.createKeywordList(newListName.trim());
                  const next = [res.list, ...keywordLists];
                  setKeywordLists(next);
                  setSelectedListId(res.list.id);
                  setNewListName('');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Unable to create list');
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New list name..."
                aria-label="New keyword list name"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-[#565FEA] text-white text-xs font-semibold shrink-0 cursor-pointer"
              >
                Create
              </button>
            </form>

            <div className="space-y-1.5">
              {keywordLists.map((list) => (
                <div
                  key={list.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs ${
                    activeSavedList?.id === list.id
                      ? 'border-[#565FEA] bg-[#565FEA]/8'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    className="text-left flex-1 font-semibold truncate cursor-pointer"
                  >
                    {list.name} ({list.keywords.length})
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete list ${list.name}`}
                    onClick={async () => {
                      await api.deleteKeywordList(list.id);
                      const remaining = keywordLists.filter((l) => l.id !== list.id);
                      setKeywordLists(remaining);
                      syncSavedSet(remaining);
                      if (selectedListId === list.id) {
                        setSelectedListId(remaining[0]?.id || '');
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            {activeSavedList ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-display font-bold">{activeSavedList.name}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeSavedList.keywords.length} saved keyword(s)
                    </p>
                  </div>
                  {activeSavedList.keywords.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleExportCsvFile(
                          `${activeSavedList.name.replace(/\W+/g, '-')}.csv`,
                          ['Keyword', 'Volume', 'Difficulty', 'CPC', 'Intent', 'Country', 'Language'],
                          activeSavedList.keywords.map((k) => ({
                            Keyword: k.keyword,
                            Volume: k.volume,
                            Difficulty: k.difficulty,
                            CPC: `${k.currencySymbol}${k.cpc}`,
                            Intent: k.intent,
                            Country: k.country,
                            Language: k.language,
                          }))
                        )
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  )}
                </div>

                {activeSavedList.keywords.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Click the + button next to any keyword in AI Keyword Overview, Keyword Ideas, or Bulk Analysis to save keywords here.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                          <th className="pb-3 pr-4">Keyword</th>
                          <th className="pb-3 pr-4 text-right">Volume</th>
                          <th className="pb-3 pr-4 text-right">KD</th>
                          <th className="pb-3 pr-4 text-right">CPC</th>
                          <th className="pb-3 pr-4">Location</th>
                          <th className="pb-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {activeSavedList.keywords.map((k) => (
                          <tr key={k.keyword} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 pr-4 font-medium">{k.keyword}</td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{k.volume.toLocaleString()}</td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{k.difficulty}</td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                              {k.currencySymbol}
                              {Number(k.cpc).toFixed(2)}
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-slate-500">
                              {k.country} · {k.language}
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                type="button"
                                aria-label={`Remove ${k.keyword}`}
                                onClick={async () => {
                                  const res = await api.removeKeywordFromList(activeSavedList.id, k.keyword);
                                  const updated = keywordLists.map((l) => (l.id === res.list.id ? res.list : l));
                                  setKeywordLists(updated);
                                  syncSavedSet(updated);
                                }}
                                className="text-xs text-red-600 hover:underline cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Create your first keyword list on the left to organize keywords.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
