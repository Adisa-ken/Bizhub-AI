import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  FileText,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { AudienceIntelligence } from './components/AudienceIntelligence';
import { AuthOnboardingModal } from './components/AuthOnboardingModal';
import { CompetitorIntelligence } from './components/CompetitorIntelligence';
import { CopilotWorkspace } from './components/CopilotWorkspace';
import { DashboardOverview } from './components/DashboardOverview';
import { LandingPage } from './components/LandingPage';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { AdminConsole, SettingsWorkspace } from './components/SettingsAndAdmin';
import { SeoToolkit } from './components/SeoToolkit';
import { api, setAuthToken, type DashboardSummaryResponse } from './lib/api';
import { ALL_STATES_LABEL, GLOBAL_COUNTRY_LABEL } from './lib/geoAndEngines';
import type { PlanConfig, ResearchProject, SavedReport, UserAccount } from './types';

type DashboardTab =
  | 'overview'
  | 'audience'
  | 'seo'
  | 'competitors'
  | 'copilot'
  | 'reports'
  | 'settings'
  | 'admin';

const NAV_ITEMS: { id: DashboardTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'audience', label: 'Audience Engine', icon: Users },
  { id: 'seo', label: 'SEO Toolkit', icon: BarChart3 },
  { id: 'competitors', label: 'Competitors', icon: Globe },
  { id: 'copilot', label: 'AI Copilot', icon: Bot },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'API & Settings', icon: Settings },
  { id: 'admin', label: 'Admin Console', icon: Shield },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummaryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [copilotPromptDraft, setCopilotPromptDraft] = useState<string | undefined>(undefined);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{
    mode: 'login' | 'register' | 'onboarding';
    prefillQuery?: string;
  } | null>(null);
  const [sharedReportView, setSharedReportView] = useState<{
    report: SavedReport;
    project?: ResearchProject;
  } | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const loadDashboard = async () => {
    const data = await api.getDashboardSummary();
    setDashboard(data);
    setPlans(data.plans);
    if (!activeProjectId && data.projects[0]) {
      setActiveProjectId(data.projects[0].id);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.getPlans();
        setPlans(res.plans);
      } catch {
        // Ignore initial public plan fetch errors
      }

      const params = new URLSearchParams(window.location.search);
      const reportSlug = params.get('report');
      if (reportSlug) {
        try {
          const shared = await api.getPublicReport(reportSlug);
          setSharedReportView(shared);
          return;
        } catch {
          setBannerError('Requested shared report was not found.');
        }
      }

      if (params.get('autostart') === '1') {
        try {
          const demo = await api.demoLogin();
          setAuthToken(demo.token);
          await loadDashboard();
        } catch (err) {
          setBannerError(err instanceof Error ? err.message : 'Unable to start demo');
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstantDemo = async (prefillQuery?: string) => {
    setBannerError(null);
    try {
      const res = await api.demoLogin();
      setAuthToken(res.token);
      if (prefillQuery && prefillQuery.trim() && prefillQuery.trim() !== 'B2B SaaS Growth Leaders') {
        const created = await api.createProject({
          query: prefillQuery.trim(),
          country: GLOBAL_COUNTRY_LABEL,
          state: ALL_STATES_LABEL,
          searchEngine: 'All Engines',
          language: 'English',
          industry: 'B2B SaaS & Marketing',
        });
        await loadDashboard();
        setActiveProjectId(created.project.id);
        setActiveTab('audience');
      } else {
        await loadDashboard();
        setActiveTab('overview');
      }
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to start demo workspace');
    }
  };

  const handleAuthSuccess = async (user: UserAccount) => {
    setAuthModal(null);
    await loadDashboard();
    if (!user.onboarding.completed) {
      setAuthModal({ mode: 'onboarding' });
    }
  };

  const handleGlobalSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim() || !dashboard) return;
    setBannerError(null);
    try {
      const created = await api.createProject({
        query: globalSearch.trim(),
        country: GLOBAL_COUNTRY_LABEL,
        state: ALL_STATES_LABEL,
        searchEngine: 'All Engines',
        language: dashboard.user.onboarding.preferredLanguage || 'English',
        industry: dashboard.user.onboarding.industry || 'B2B SaaS & Marketing',
      });
      setGlobalSearch('');
      await loadDashboard();
      setActiveProjectId(created.project.id);
      setActiveTab('audience');
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Unable to run global research');
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setDashboard(null);
    setActiveTab('overview');
    setProfileMenuOpen(false);
  };

  // Public Shareable Report View
  if (sharedReportView) {
    const { report, project } = sharedReportView;
    return (
      <div className="min-h-screen bg-[#F5F6FA] dark:bg-[#0D1021] text-[#171B35] dark:text-slate-100 p-6">
        <div className="max-w-4xl mx-auto bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <p className="text-xs font-semibold text-[#565FEA]">{report.brandName} · Shared Intelligence Report</p>
              <h1 className="text-2xl font-display font-bold mt-1">{report.title}</h1>
            </div>
            <button
              type="button"
              onClick={() => {
                setSharedReportView(null);
                window.history.replaceState({}, '', '/');
              }}
              className="px-4 py-2 rounded-xl bg-[#565FEA] text-white text-xs font-semibold cursor-pointer"
            >
              Open Platform
            </button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{report.executiveSummary}</p>
          {project && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400">Audience Size</span>
                <div className="font-mono font-bold mt-1">{project.intelligence.summary.estimatedAudienceSize}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400">Top Platform</span>
                <div className="font-bold mt-1">{project.intelligence.summary.topPlatform}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400">Keyword Opp.</span>
                <div className="font-mono font-bold mt-1">{project.intelligence.summary.avgKeywordOpportunity}/100</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400">AI Visibility</span>
                <div className="font-mono font-bold mt-1">{project.intelligence.summary.aiVisibilityIndex}/100</div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Recommendations</h2>
            <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              {report.marketingRecommendations.map((rec) => (
                <li key={rec}>· {rec}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated Landing Page
  if (!dashboard) {
    return (
      <>
        {bannerError && (
          <div className="bg-red-600 text-white text-xs text-center py-2 px-4">{bannerError}</div>
        )}
        <LandingPage
          brandName="Bizhub AI"
          plans={plans}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onOpenAuth={(mode, prefillQuery) => setAuthModal({ mode, prefillQuery })}
          onInstantDemo={handleInstantDemo}
        />
        {authModal && (
          <AuthOnboardingModal
            initialMode={authModal.mode}
            prefillQuery={authModal.prefillQuery}
            onClose={() => setAuthModal(null)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </>
    );
  }

  const activeProject =
    dashboard.projects.find((p) => p.id === activeProjectId) || dashboard.projects[0];
  const unreadCount = dashboard.notifications.filter((n) => !n.read).length;
  const brandName = dashboard.user.brandName && dashboard.user.brandName !== 'AudiencePulse AI'
    ? dashboard.user.brandName
    : 'Bizhub AI';

  return (
    <div className="min-h-screen bg-[#F5F6FA] dark:bg-[#0D1021] text-[#171B35] dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`no-print hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11152B] transition-all duration-200 shrink-0 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          {!sidebarCollapsed && (
            <span className="font-display font-bold text-base tracking-tight truncate">{brandName}</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav aria-label="Workspace Navigation" className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#565FEA] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-[#171B35] dark:text-white truncate">
              {dashboard.workspaces.find((w) => w.id === dashboard.user.workspaceId)?.name || 'Primary Workspace'}
            </div>
            <div>
              {dashboard.plan.name} Plan · {dashboard.user.creditsUsed}/{dashboard.plan.monthlyCredits} credits
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-10 w-64 bg-white dark:bg-[#11152B] h-full p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <span className="font-display font-bold text-base">{brandName}</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                        activeTab === item.id ? 'bg-[#565FEA] text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Header */}
        <header className="no-print h-16 bg-white dark:bg-[#11152B] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <Menu className="w-4 h-4" />
            </button>

            <form onSubmit={handleGlobalSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="global-research-search" className="sr-only">
                Global research search
              </label>
              <input
                id="global-research-search"
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search audience, keyword, or domain and press Enter..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F5F6FA] dark:bg-[#0D1021] text-xs sm:text-sm"
              />
            </form>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setProfileMenuOpen(false);
                }}
                aria-label="Notifications"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 rounded-full bg-[#FF704D] text-white text-[10px] font-mono">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-4 z-40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Notifications</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.markAllNotificationsRead();
                        await loadDashboard();
                      }}
                      className="text-[11px] text-[#565FEA] hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {dashboard.notifications.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0D1021] text-xs space-y-0.5">
                        <div className="font-semibold">{n.title}</div>
                        <div className="text-slate-500 dark:text-slate-400">{n.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((o) => !o);
                  setNotifOpen(false);
                }}
                aria-label={`Account menu for ${dashboard.user.name}`}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="w-5 h-5 rounded-md bg-[#565FEA] text-white inline-flex items-center justify-center text-[11px] font-bold sm:hidden">
                  {dashboard.user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline truncate max-w-[110px]">{dashboard.user.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-2 z-40 space-y-1 text-xs">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-semibold truncate">{dashboard.user.email}</div>
                    <div className="text-slate-400">{dashboard.plan.name} Plan</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('settings');
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    API &amp; Workspace Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('admin');
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Admin Console
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {bannerError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            {bannerError}
          </div>
        )}

        {/* Active Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <DashboardOverview
              user={dashboard.user}
              plan={dashboard.plan}
              projects={dashboard.projects}
              reports={dashboard.reports}
              watchlist={dashboard.watchlist}
              trackedKeywords={dashboard.trackedKeywords}
              onStartResearch={async (payload) => {
                const res = await api.createProject(payload);
                await loadDashboard();
                setActiveProjectId(res.project.id);
                setActiveTab('audience');
              }}
              onOpenProject={(proj) => {
                setActiveProjectId(proj.id);
                setActiveTab('audience');
              }}
              onDeleteProject={async (id) => {
                await api.deleteProject(id);
                await loadDashboard();
              }}
              onNavigateTab={(tab, prompt) => {
                if (prompt) setCopilotPromptDraft(prompt);
                setActiveTab(tab);
              }}
            />
          )}

          {activeTab === 'audience' && activeProject && (
            <AudienceIntelligence
              projects={dashboard.projects}
              activeProject={activeProject}
              onSelectProject={(proj) => setActiveProjectId(proj.id)}
              onProjectUpdated={(updated) => {
                setDashboard((prev) =>
                  prev
                    ? {
                        ...prev,
                        projects: prev.projects.map((p) => (p.id === updated.id ? updated : p)),
                      }
                    : prev
                );
              }}
              onAskCopilot={(prompt) => {
                setCopilotPromptDraft(prompt);
                setActiveTab('copilot');
              }}
              onCreateReportFromProject={async (proj) => {
                await api.createReport({
                  projectId: proj.id,
                  title: `${proj.title} — Intelligence Report`,
                  whiteLabel: dashboard.plan.whiteLabelReports,
                  brandName,
                });
                await loadDashboard();
                setActiveTab('reports');
              }}
            />
          )}

          {activeTab === 'seo' && (
            <SeoToolkit
              defaultTarget={activeProject?.query || 'bizhub.ai'}
              defaultCountry={activeProject?.country}
              defaultState={activeProject?.state}
              onCreditsUpdated={() => void loadDashboard()}
            />
          )}

          {activeTab === 'competitors' && (
            <CompetitorIntelligence
              initialDomains={dashboard.watchlist}
              plan={dashboard.plan}
              contextQuery={activeProject?.query || 'B2B SaaS'}
            />
          )}

          {activeTab === 'copilot' && (
            <CopilotWorkspace
              projects={dashboard.projects}
              activeProject={activeProject}
              initialPrompt={copilotPromptDraft}
              onClearInitialPrompt={() => setCopilotPromptDraft(undefined)}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onCreditsUpdated={() => void loadDashboard()}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsWorkspace
              brandName={brandName}
              plan={dashboard.plan}
              projects={dashboard.projects}
              reports={dashboard.reports}
              onReportsChanged={loadDashboard}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsWorkspace
              user={dashboard.user}
              plans={dashboard.plans}
              workspaces={dashboard.workspaces}
              onRefreshDashboard={loadDashboard}
              onLogout={handleLogout}
            />
          )}

          {activeTab === 'admin' && <AdminConsole onRefreshDashboard={loadDashboard} />}
        </main>
      </div>

      {authModal && (
        <AuthOnboardingModal
          initialMode={authModal.mode}
          initialUser={dashboard.user}
          prefillQuery={authModal.prefillQuery}
          onClose={() => setAuthModal(null)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
