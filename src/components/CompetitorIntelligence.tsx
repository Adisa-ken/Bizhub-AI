import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { CompetitorSnapshot, PlanConfig } from '../types';

interface CompetitorIntelligenceProps {
  initialDomains: string[];
  plan: PlanConfig;
  contextQuery: string;
}

export function CompetitorIntelligence({ initialDomains, plan, contextQuery }: CompetitorIntelligenceProps) {
  const [domains, setDomains] = useState<string[]>(initialDomains.slice(0, 5));
  const [newDomain, setNewDomain] = useState('');
  const [comparison, setComparison] = useState<CompetitorSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runComparison = async (domainList: string[]) => {
    if (domainList.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.compareCompetitors({ domains: domainList, contextQuery });
      setComparison(res.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to compare competitors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runComparison(domains);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxAllowed = Math.min(5, plan.maxCompetitors);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!cleaned) return;
    if (domains.includes(cleaned)) {
      setError('This domain is already in your comparison.');
      return;
    }
    if (domains.length >= 5) {
      setError('Maximum 5 competitors can be compared simultaneously.');
      return;
    }
    if (domains.length >= maxAllowed) {
      setError(`Your ${plan.name} plan allows up to ${maxAllowed} competitors. Upgrade or adjust limits in Admin.`);
      return;
    }
    const next = [...domains, cleaned];
    setDomains(next);
    setNewDomain('');
    void runComparison(next);
  };

  const handleRemove = (target: string) => {
    const next = domains.filter((d) => d !== target);
    setDomains(next);
    if (next.length > 0) {
      void runComparison(next);
    } else {
      setComparison([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-display font-bold">Competitor Intelligence Matrix</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Compare up to 5 competitor domains side-by-side ({domains.length} / {maxAllowed} active on {plan.name} plan)
            </p>
          </div>
          {loading && <span className="text-xs text-[#565FEA]">Refreshing metrics...</span>}
        </div>

        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2.5">
          <label htmlFor="competitor-domain-input" className="sr-only">
            Add competitor domain
          </label>
          <input
            id="competitor-domain-input"
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="Enter competitor domain (e.g., similarweb.com or moz.com)"
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#565FEA] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#464ED8] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Competitor
          </button>
        </form>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {domains.map((dom) => (
            <div
              key={dom}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              <span>{dom}</span>
              <button
                type="button"
                onClick={() => handleRemove(dom)}
                aria-label={`Remove competitor ${dom}`}
                className="text-slate-400 hover:text-red-500 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-Side Comparison Table */}
      {comparison.length > 0 && (
        <div className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-base font-display font-bold mb-4">Traffic, Authority &amp; Overlap Benchmark</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                <th className="pb-3 font-medium">Metric</th>
                {comparison.map((c) => (
                  <th key={c.domain} className="pb-3 font-semibold text-[#171B35] dark:text-white text-right">
                    {c.domain}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-3 text-slate-500">Organic Traffic Est. / mo</td>
                {comparison.map((c) => (
                  <td key={c.domain} className="py-3 text-right font-mono tabular-nums font-semibold">
                    {c.organicTrafficEst.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 text-slate-500">Domain Authority</td>
                {comparison.map((c) => (
                  <td key={c.domain} className="py-3 text-right font-mono tabular-nums">
                    {c.domainAuthority} / 100
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 text-slate-500">Paid Traffic Est. / mo</td>
                {comparison.map((c) => (
                  <td key={c.domain} className="py-3 text-right font-mono tabular-nums">
                    {c.paidTrafficEst.toLocaleString()}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 text-slate-500">Backlinks / Ref. Domains</td>
                {comparison.map((c) => (
                  <td key={c.domain} className="py-3 text-right font-mono tabular-nums">
                    {c.backlinksEst.toLocaleString()} ({c.referringDomainsEst.toLocaleString()})
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 text-slate-500">Audience Overlap</td>
                {comparison.map((c) => (
                  <td key={c.domain} className="py-3 text-right font-mono tabular-nums font-semibold text-[#565FEA] dark:text-[#8E96FF]">
                    {c.audienceOverlapPct}%
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 text-slate-500">Live Website &amp; Index Telemetry</td>
                {comparison.map((c) => (
                  <td key={c.domain} className="py-3 text-right text-xs font-mono tabular-nums">
                    {c.liveSignals ? (
                      <div className="space-y-0.5">
                        <div className={c.liveSignals.statusCode >= 200 && c.liveSignals.statusCode < 400 ? 'text-[#16A34A] font-semibold' : 'text-amber-600'}>
                          HTTP {c.liveSignals.statusCode} · {c.liveSignals.responseMs}ms
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          CC: {c.liveSignals.commonCrawlPages} URLs · HN: {c.liveSignals.hnMentions}
                        </div>
                        {typeof c.liveSignals.subdomainsCount === 'number' && (
                          <div className="text-slate-500 dark:text-slate-400">
                            {c.liveSignals.sslValid ? `TLS ${c.liveSignals.sslExpiryDays ?? 0}d` : 'TLS Check'} · {c.liveSignals.subdomainsCount} sub
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">Baseline</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Competitor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {comparison.map((c) => (
          <div
            key={c.domain}
            className="bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-display font-bold">{c.domain}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {c.liveSignals?.authoritySource ? `${c.provenance} · ${c.liveSignals.authoritySource}` : c.provenance}
              </span>
            </div>

            {c.liveSignals && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[#0D1021] text-xs font-mono tabular-nums">
                  <div>
                    <div className="text-[11px] text-slate-400 font-sans">HTTP / TTFB</div>
                    <div className="font-semibold">
                      {c.liveSignals.statusCode} · {c.liveSignals.responseMs}ms
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-sans">Schema JSON-LD</div>
                    <div className={c.liveSignals.hasJsonLd ? 'text-[#16A34A] font-semibold' : 'text-slate-500'}>
                      {c.liveSignals.hasJsonLd ? 'Detected' : 'Missing'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-sans">SSL &amp; Expiry</div>
                    <div className={c.liveSignals.sslValid ? 'text-[#16A34A] font-semibold' : 'text-slate-500'}>
                      {c.liveSignals.sslValid ? `Valid · ${c.liveSignals.sslExpiryDays ?? 0}d` : 'Checked'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-sans">crt.sh Subdomains</div>
                    <div className="font-semibold">{c.liveSignals.subdomainsCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-sans">CC / HN</div>
                    <div className="font-semibold">{c.liveSignals.commonCrawlPages} / {c.liveSignals.hnMentions}</div>
                  </div>
                </div>
                {c.liveSignals.sampleSubdomains && c.liveSignals.sampleSubdomains.length > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    Subdomains (crt.sh): {c.liveSignals.sampleSubdomains.slice(0, 5).join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">Top Keywords &amp; Best Pages</p>
              <div className="space-y-1.5 text-xs">
                {c.topKeywords.map((kw) => (
                  <div key={kw.keyword} className="flex items-center justify-between">
                    <span>{kw.keyword}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      Pos #{kw.position} · {kw.volume.toLocaleString()} vol
                    </span>
                  </div>
                ))}
                {c.bestPages.slice(0, 2).map((pg) => (
                  <div key={pg.path} className="flex items-center justify-between text-slate-500">
                    <span className="truncate">{pg.path}</span>
                    <span className="font-mono tabular-nums shrink-0">{pg.estTraffic.toLocaleString()} visits</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-[#638D50] dark:text-[#8BC374]">Market Opportunities</p>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {c.marketOpportunities.map((opp) => (
                  <li key={opp}>· {opp}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
