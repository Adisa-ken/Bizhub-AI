import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Globe, KeyRound, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import {
  getGoogleAccessToken,
  getGoogleUser,
  initGoogleAuth,
  signInWithGoogleSearchConsole,
  signOutGoogleSearchConsole,
} from '../lib/googleAuth';
import type { DataSourceProvider, PlanConfig, SubscriptionPlanId, UserAccount, Workspace } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SettingsPanelProps {
  user: UserAccount;
  plans: PlanConfig[];
  workspaces: Workspace[];
  onRefreshDashboard: () => Promise<void>;
  onLogout: () => void;
}

export function SettingsWorkspace({
  user,
  plans,
  workspaces,
  onRefreshDashboard,
  onLogout,
}: SettingsPanelProps) {
  const [providers, setProviders] = useState<DataSourceProvider[]>([]);
  const [brandName, setBrandName] = useState(user.brandName);
  const [displayName, setDisplayName] = useState(user.name);
  const [newWsName, setNewWsName] = useState('');
  const [credentialDrafts, setCredentialDrafts] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gscToken, setGscToken] = useState<string | null>(() => getGoogleAccessToken());
  const [gscEmail, setGscEmail] = useState<string | null>(() => getGoogleUser()?.email ?? null);
  const [gscSites, setGscSites] = useState<{ siteUrl: string; permissionLevel: string }[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [gscRows, setGscRows] = useState<
    { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }[]
  >([]);
  const [gscLoading, setGscLoading] = useState(false);

  const loadProviders = async () => {
    try {
      const res = await api.getProviders();
      setProviders(res.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load API providers');
    }
  };

  const loadGscSites = async (token: string) => {
    setGscLoading(true);
    try {
      const res = await api.getGscSites(token);
      setGscSites(res.sites);
      if (res.sites[0]?.siteUrl) {
        setSelectedSite(res.sites[0].siteUrl);
        const analytics = await api.getGscAnalytics(token, res.sites[0].siteUrl);
        setGscRows(analytics.rows);
      } else {
        setGscRows([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Google Search Console sites');
    } finally {
      setGscLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
    const unsub = initGoogleAuth(
      (gUser, token) => {
        setGscToken(token);
        setGscEmail(gUser.email);
      },
      () => {
        setGscToken(null);
        setGscEmail(null);
        setGscSites([]);
        setGscRows([]);
      }
    );
    return () => unsub();
  }, []);

  const handleConnectGsc = async () => {
    setError(null);
    setGscLoading(true);
    try {
      const res = await signInWithGoogleSearchConsole();
      setGscToken(res.accessToken);
      setGscEmail(res.user.email);
      setStatusMsg(`Connected Google Search Console as ${res.user.email || 'Google user'}.`);
      await loadGscSites(res.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Search Console sign-in failed');
    } finally {
      setGscLoading(false);
    }
  };

  const handleDisconnectGsc = async () => {
    await signOutGoogleSearchConsole();
    setGscToken(null);
    setGscEmail(null);
    setGscSites([]);
    setGscRows([]);
    setStatusMsg('Disconnected Google Search Console session.');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.updateProfile({ name: displayName, brandName });
      await onRefreshDashboard();
      setStatusMsg('Profile and platform brand name updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setError(null);
    try {
      await api.createWorkspace({
        name: newWsName.trim(),
        organisationName: workspaces[0]?.organisationName || 'Agency Team',
        industry: user.onboarding.industry,
      });
      setNewWsName('');
      await onRefreshDashboard();
      setStatusMsg('New workspace created and activated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create workspace');
    }
  };

  const handleSwitchPlan = async (planId: SubscriptionPlanId) => {
    setError(null);
    try {
      await api.updateProfile({ subscriptionPlan: planId });
      await onRefreshDashboard();
      setStatusMsg(`Subscription switched to ${planId.toUpperCase()} (Stripe billing ready for live checkout).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change plan');
    }
  };

  const handleExportAccount = async () => {
    const data = await api.exportAccountData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audiencepulse-my-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
          {statusMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Brand Name, Profile & Multi-Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveProfile}
          className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-base font-display font-bold">Profile &amp; Editable Brand Name</h2>
          <div>
            <label htmlFor="settings-display-name" className="block text-xs font-medium mb-1">
              Your Name
            </label>
            <input
              id="settings-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label htmlFor="settings-brand-name" className="block text-xs font-medium mb-1">
              Platform Brand Name (White-Label / Custom Name)
            </label>
            <input
              id="settings-brand-name"
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#565FEA] text-white text-xs font-semibold hover:bg-[#464ED8] cursor-pointer"
          >
            Save Profile &amp; Brand
          </button>
        </form>

        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-display font-bold">Workspaces ({workspaces.length})</h2>
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
              >
                <div>
                  <div className="font-semibold">{ws.name}</div>
                  <div className="text-slate-400">{ws.organisationName} · {ws.industry}</div>
                </div>
                {user.workspaceId === ws.id ? (
                  <span className="font-semibold text-[#638D50] dark:text-[#8BC374]">Active</span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await api.updateProfile({ workspaceId: ws.id });
                      await onRefreshDashboard();
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Switch
                  </button>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleCreateWorkspace} className="flex gap-2">
            <input
              type="text"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="New client workspace name..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-[#565FEA] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </form>
        </div>
      </div>

      {/* Subscription Plans */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-bold">Subscription &amp; Monetisation Tiers</h2>
            <p className="text-xs text-slate-500">
              Free tier requires no payment. Paid tiers are ready for Stripe checkout activation.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isCurrent = user.subscriptionPlan === p.id;
            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border flex flex-col justify-between ${
                  isCurrent ? 'border-[#565FEA] bg-[#565FEA]/5' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{p.name}</span>
                    <span className="font-mono font-bold text-sm">${p.monthlyPriceUsd}/mo</span>
                  </div>
                  <p className="text-xs text-slate-500">{p.monthlyCredits} credits · {p.maxCompetitors} rivals · {p.maxWorkspaces} workspaces</p>
                </div>
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleSwitchPlan(p.id)}
                  className={`mt-4 w-full py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-default'
                      : 'bg-[#565FEA] text-white hover:bg-[#464ED8]'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : `Switch to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Free & Open-Source Data Source Adapters */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-display font-bold">Free Data Sources &amp; Open-Source Adapters (Zero Paid Keys)</h2>
          <p className="text-xs text-slate-500">
            Built-in live public adapters (Google Suggest, Reddit JSON, HN Algolia, Wikimedia, Site Inspector) run immediately at $0 cost. Optional free-tier keys and self-hosted URLs stay strictly server-side.
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {providers.map((prov) => {
            const showInput =
              prov.requiresKey ||
              prov.category === 'Open-Source Self-Hosted' ||
              prov.id === 'pagespeed-free' ||
              prov.id === 'rss-news-free';
            return (
              <div key={prov.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-sm text-[#171B35] dark:text-white">{prov.name}</span>
                    <span className="text-[#638D50] dark:text-[#8BC374] font-semibold">· {prov.costLabel}</span>
                    <span className="text-slate-400">· {prov.category}</span>
                    <span className="text-slate-400">· Status: {prov.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{prov.notes}</p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-400">
                    Usage: {prov.usageCount} calls · Errors: {prov.errorCount} · Mode: {prov.mode === 'live-free' ? 'Live Free Endpoint' : 'Free Demonstration'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {prov.id === 'gsc-free' ? (
                    gscToken ? (
                      <button
                        type="button"
                        onClick={() => void loadGscSites(gscToken)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Sync GSC Sites
                      </button>
                    ) : (
                      <GoogleSignInButton onClick={handleConnectGsc} disabled={gscLoading} />
                    )
                  ) : showInput ? (
                    <>
                      <input
                        type={prov.category === 'Open-Source Self-Hosted' ? 'url' : 'password'}
                        value={credentialDrafts[prov.id] || ''}
                        onChange={(e) => setCredentialDrafts((d) => ({ ...d, [prov.id]: e.target.value }))}
                        placeholder={prov.hasCredential ? 'Saved on server (update)' : prov.credentialLabel}
                        aria-label={`Optional free config for ${prov.name}`}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs w-52"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          try {
                            const cred = credentialDrafts[prov.id];
                            await api.updateProvider(prov.id, { credentialValue: cred || undefined, enabled: true });
                            setCredentialDrafts((d) => ({ ...d, [prov.id]: '' }));
                            await loadProviders();
                            setStatusMsg(`${prov.name} saved on server.`);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Unable to save provider');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Save
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        const res = await api.testProvider(prov.id, gscToken);
                        await loadProviders();
                        const latencyTag = typeof res.latencyMs === 'number' && res.latencyMs > 0 ? ` (${res.latencyMs}ms)` : '';
                        setStatusMsg(`${prov.name}${latencyTag}: ${res.testResult}`);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Test request failed');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#565FEA] text-white text-xs font-semibold hover:bg-[#464ED8] cursor-pointer"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        await api.updateProvider(prov.id, { enabled: !prov.enabled });
                        await loadProviders();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Unable to toggle provider');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    {prov.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Google Search Console Inspector */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-display font-bold flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#565FEA]" />
              Google Search Console (Live First-Party SEO Data)
            </h2>
            <p className="text-xs text-slate-500">
              {gscToken
                ? `Connected as ${gscEmail || 'Google User'} · Read-only Search Console access active in session memory.`
                : 'Sign in with Google to read verified properties, clicks, impressions, CTR, and average query rankings.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {gscToken ? (
              <>
                <button
                  type="button"
                  onClick={() => void loadGscSites(gscToken)}
                  disabled={gscLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Sites
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnectGsc()}
                  className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold cursor-pointer"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <GoogleSignInButton onClick={handleConnectGsc} disabled={gscLoading} />
            )}
          </div>
        </div>

        {gscToken && gscSites.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="gsc-site-select" className="text-xs font-semibold">
                Verified Property:
              </label>
              <select
                id="gsc-site-select"
                value={selectedSite}
                onChange={async (e) => {
                  const next = e.target.value;
                  setSelectedSite(next);
                  setGscLoading(true);
                  try {
                    const analytics = await api.getGscAnalytics(gscToken, next);
                    setGscRows(analytics.rows);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Unable to query property');
                  } finally {
                    setGscLoading(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs"
              >
                {gscSites.map((s) => (
                  <option key={s.siteUrl} value={s.siteUrl}>
                    {s.siteUrl} ({s.permissionLevel})
                  </option>
                ))}
              </select>
            </div>

            {gscRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                      <th className="pb-2 pr-3">Query</th>
                      <th className="pb-2 pr-3">Page</th>
                      <th className="pb-2 pr-3 text-right">Clicks</th>
                      <th className="pb-2 pr-3 text-right">Impressions</th>
                      <th className="pb-2 pr-3 text-right">CTR</th>
                      <th className="pb-2 text-right">Avg. Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {gscRows.map((row, idx) => (
                      <tr key={`${row.query}-${idx}`}>
                        <td className="py-2 pr-3 font-medium">{row.query}</td>
                        <td className="py-2 pr-3 text-slate-500 max-w-xs truncate">{row.page}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{row.clicks}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{row.impressions}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{row.ctr}%</td>
                        <td className="py-2 text-right font-mono tabular-nums">{row.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {gscLoading ? 'Loading Search Console query metrics...' : 'No Search Console query rows returned for the last 28 days on this property.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Privacy Controls */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-display font-bold">Privacy &amp; Data Controls</h2>
          <p className="text-xs text-slate-500">Export your workspace JSON archive or permanently delete your account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportAccount}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export My Data
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await api.deleteAccount();
                onLogout();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to delete account');
              }
            }}
            className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminConsole({ onRefreshDashboard }: { onRefreshDashboard: () => Promise<void> }) {
  const [adminStatus, setAdminStatus] = useState<{
    isAdmin: boolean;
    adminClaimed: boolean;
    envPasscodeConfigured: boolean;
  } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.getAdminOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadAdmin = async () => {
    setError(null);
    try {
      const status = await api.getAdminStatus();
      setAdminStatus(status);
      if (status.isAdmin) {
        const ov = await api.getAdminOverview();
        setOverview(ov);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin status');
    }
  };

  useEffect(() => {
    void loadAdmin();
  }, []);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.claimAdmin(passcode);
      setPasscode('');
      await onRefreshDashboard();
      await loadAdmin();
      setMsg('Administrator access activated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid administrator passcode');
    }
  };

  if (!adminStatus?.isAdmin) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-[#565FEA]">
          <Shield className="w-5 h-5" />
          <h1 className="text-lg font-display font-bold">Administrator Access</h1>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {adminStatus?.envPasscodeConfigured
            ? 'Enter the configured ADMIN_PASSCODE to access user management, plan credit limits, and system health.'
            : adminStatus?.adminClaimed
              ? 'Enter your administrator passcode to unlock the Admin Console.'
              : 'First-run setup: choose an administrator passcode (min 6 characters) to claim the Admin Console for this instance.'}
        </p>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <form onSubmit={handleClaim} className="space-y-3">
          <div>
            <label htmlFor="admin-passcode" className="block text-xs font-medium mb-1">
              Administrator Passcode
            </label>
            <input
              id="admin-passcode"
              type="password"
              required
              minLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter or set admin passcode"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-[#565FEA] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            Unlock Admin Console
          </button>
        </form>
      </div>
    );
  }

  if (!overview) {
    return <div className="text-sm text-slate-500">Loading administrator metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {msg}
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-red-50 text-xs text-red-600">{error}</div>}

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Users', value: overview.metrics.totalUsers },
          { label: 'Active Users', value: overview.metrics.activeUsers },
          { label: 'Research Requests', value: overview.metrics.researchRequests },
          { label: 'API Errors', value: overview.metrics.apiErrors },
          { label: 'Est. MRR', value: `$${overview.metrics.estMrrUsd}` },
          { label: 'System Health', value: overview.metrics.systemHealth },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-4"
          >
            <div className="text-xs text-slate-500">{card.label}</div>
            <div className="text-xl font-mono font-bold tabular-nums mt-1">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Configurable Plan Limits */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-display font-bold">Configurable Subscription Limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="pb-2">Plan</th>
                <th className="pb-2">Monthly Credits</th>
                <th className="pb-2">Max Competitors</th>
                <th className="pb-2">Max Workspaces</th>
                <th className="pb-2">White-Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.plans.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 font-semibold">{p.name}</td>
                  <td className="py-2.5">
                    <input
                      type="number"
                      defaultValue={p.monthlyCredits}
                      aria-label={`${p.name} monthly credits`}
                      onBlur={async (e) => {
                        const val = Number(e.target.value);
                        if (val >= 1 && val !== p.monthlyCredits) {
                          await api.updateAdminPlan(p.id, { monthlyCredits: val });
                          await loadAdmin();
                          await onRefreshDashboard();
                          setMsg(`${p.name} credit limit updated.`);
                        }
                      }}
                      className="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent font-mono"
                    />
                  </td>
                  <td className="py-2.5 font-mono">{p.maxCompetitors}</td>
                  <td className="py-2.5 font-mono">{p.maxWorkspaces}</td>
                  <td className="py-2.5">{p.whiteLabelReports ? 'Enabled' : 'Disabled'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 overflow-x-auto">
        <h2 className="text-base font-display font-bold">User Management</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
              <th className="pb-2">User</th>
              <th className="pb-2">Email</th>
              <th className="pb-2">Plan</th>
              <th className="pb-2">Credits Used</th>
              <th className="pb-2">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {overview.users.map((u) => (
              <tr key={u.id}>
                <td className="py-2.5 font-semibold">{u.name}</td>
                <td className="py-2.5 text-slate-500">{u.email}</td>
                <td className="py-2.5">
                  <select
                    aria-label={`Plan for ${u.email}`}
                    value={u.subscriptionPlan}
                    onChange={async (e) => {
                      await api.updateAdminUser(u.id, { subscriptionPlan: e.target.value as SubscriptionPlanId });
                      await loadAdmin();
                      setMsg(`Updated plan for ${u.email}.`);
                    }}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021]"
                  >
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="agency">Agency</option>
                  </select>
                </td>
                <td className="py-2.5 font-mono">{u.creditsUsed}</td>
                <td className="py-2.5 uppercase">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
