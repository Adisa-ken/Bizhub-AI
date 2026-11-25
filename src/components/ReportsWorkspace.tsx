import { useState } from 'react';
import { Download, FileSpreadsheet, Plus, Printer, Share2, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatExportCsv } from '../lib/intelligence';
import type { PlanConfig, ResearchProject, SavedReport } from '../types';

interface ReportsWorkspaceProps {
  brandName: string;
  plan: PlanConfig;
  projects: ResearchProject[];
  reports: SavedReport[];
  onReportsChanged: () => Promise<void>;
}

export function ReportsWorkspace({
  brandName,
  plan,
  projects,
  reports,
  onReportsChanged,
}: ReportsWorkspaceProps) {
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [newTitle, setNewTitle] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [whiteLabel, setWhiteLabel] = useState(plan.whiteLabelReports);
  const [agencyBrand, setAgencyBrand] = useState(brandName);
  const [creating, setCreating] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0];
  const linkedProject = projects.find((p) => p.id === activeReport?.projectId) || projects[0];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setError(null);
    setCreating(true);
    try {
      const res = await api.createReport({
        projectId,
        title: newTitle.trim() || `${projects.find((p) => p.id === projectId)?.title || 'Research'} Report`,
        whiteLabel: whiteLabel && plan.whiteLabelReports,
        brandName: agencyBrand.trim() || brandName,
      });
      setNewTitle('');
      await onReportsChanged();
      setSelectedReportId(res.report.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create report');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!linkedProject) return;
    const cols = ['Module', 'Item', 'Metric', 'Comparison', 'Provenance'];
    const rows = [
      ...linkedProject.intelligence.socialNetworks.map((s) => ({
        Module: 'Social Network',
        Item: s.platform,
        Metric: `${s.audiencePct}%`,
        Comparison: `${s.marketAvgPct}% avg (${s.indexMultiplier}x)`,
        Provenance: s.provenance,
      })),
      ...linkedProject.intelligence.keywords.map((k) => ({
        Module: 'Keyword',
        Item: k.keyword,
        Metric: k.searchVolume,
        Comparison: `KD ${k.difficulty} / CPC $${k.cpcUsd}`,
        Provenance: k.provenance,
      })),
    ];
    const csv = formatExportCsv(cols, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeReport?.title || 'report').replace(/\W+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = () => {
    if (!linkedProject) return;
    const tableRows = linkedProject.intelligence.keywords
      .map(
        (k) =>
          `<tr><td>${k.keyword}</td><td>${k.searchVolume}</td><td>${k.difficulty}</td><td>${k.cpcUsd}</td><td>${k.intent}</td><td>${k.provenance}</td></tr>`
      )
      .join('');
    const html = `<html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>Keyword</th><th>Volume</th><th>KD</th><th>CPC</th><th>Intent</th><th>Provenance</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeReport?.title || 'report').replace(/\W+/g, '-').toLowerCase()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!activeReport) return;
    const shareUrl = `${window.location.origin}/?report=${encodeURIComponent(activeReport.shareSlug)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus(`Shareable link copied: ${shareUrl}`);
    } catch {
      setShareStatus(`Shareable link ready: ${shareUrl}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Builder Bar */}
      <form
        onSubmit={handleGenerate}
        className="no-print bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-display font-bold">Research Reports &amp; Exports</h1>
            <p className="text-xs text-slate-500">
              Generate executive briefs with PDF print view, CSV, Excel export, shareable links, and agency white-labeling
            </p>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <label htmlFor="report-project" className="block text-xs font-medium mb-1">
              Source Research Project
            </label>
            <select
              id="report-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="report-title" className="block text-xs font-medium mb-1">
              Report Title
            </label>
            <input
              id="report-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Q4 Client Audience & SEO Brief"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="report-brand" className="block text-xs font-medium mb-1">
              Header Brand
            </label>
            <input
              id="report-brand"
              type="text"
              value={agencyBrand}
              onChange={(e) => setAgencyBrand(e.target.value)}
              disabled={!plan.whiteLabelReports}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm disabled:opacity-50"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 px-4 rounded-xl bg-[#565FEA] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#464ED8] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Report
            </button>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={whiteLabel}
            disabled={!plan.whiteLabelReports}
            onChange={(e) => setWhiteLabel(e.target.checked)}
          />
          Enable Branded Agency White-Label Header {!plan.whiteLabelReports && '(Available on Pro / Agency plans)'}
        </label>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved Reports List */}
        <aside className="no-print lg:col-span-4 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 h-fit">
          <h2 className="text-sm font-display font-bold px-2 py-1">Saved Reports ({reports.length})</h2>
          {reports.map((rep) => (
            <div
              key={rep.id}
              className={`p-3 rounded-xl border transition-colors flex items-start justify-between gap-2 ${
                activeReport?.id === rep.id
                  ? 'border-[#565FEA] bg-[#565FEA]/5'
                  : 'border-slate-200/70 dark:border-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedReportId(rep.id)}
                className="text-left min-w-0 flex-1 cursor-pointer"
              >
                <div className="text-xs font-semibold truncate">{rep.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {rep.brandName} · {new Date(rep.createdAt).toLocaleDateString()}
                </div>
              </button>
              <button
                type="button"
                aria-label={`Delete report ${rep.title}`}
                onClick={async () => {
                  await api.deleteReport(rep.id);
                  await onReportsChanged();
                }}
                className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </aside>

        {/* Report Preview & Export */}
        {activeReport && linkedProject && (
          <div className="lg:col-span-8 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6">
            <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">
                {activeReport.whiteLabel ? `White-Label Brand: ${activeReport.brandName}` : activeReport.brandName}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-[#171B35] dark:bg-[#565FEA] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  PDF / Print
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
              </div>
            </div>

            {shareStatus && (
              <div className="no-print p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
                {shareStatus}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#565FEA] dark:text-[#8E96FF]">
                {activeReport.brandName} · Research Date {new Date(activeReport.createdAt).toLocaleDateString()}
              </p>
              <h2 className="text-2xl font-display font-bold">{activeReport.title}</h2>
              <p className="text-xs text-slate-500">Confidence &amp; Sources: {activeReport.confidenceLabel}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Executive Summary</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeReport.executiveSummary}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400">Audience Size</span>
                <div className="font-mono font-bold mt-1">{linkedProject.intelligence.summary.estimatedAudienceSize}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400">Top Social Platform</span>
                <div className="font-bold mt-1">{linkedProject.intelligence.summary.topPlatform}</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400">Keyword Opp. Index</span>
                <div className="font-mono font-bold mt-1">{linkedProject.intelligence.summary.avgKeywordOpportunity}/100</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400">AI Search Visibility</span>
                <div className="font-mono font-bold mt-1">{linkedProject.intelligence.summary.aiVisibilityIndex}/100</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Marketing Recommendations</h3>
              <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                {activeReport.marketingRecommendations.map((rec) => (
                  <li key={rec}>· {rec}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Top Keyword Opportunities</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                    <th className="pb-2">Keyword</th>
                    <th className="pb-2 text-right">Volume</th>
                    <th className="pb-2 text-right">KD</th>
                    <th className="pb-2">Intent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {linkedProject.intelligence.keywords.slice(0, 5).map((kw) => (
                    <tr key={kw.keyword}>
                      <td className="py-2 font-medium">{kw.keyword}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{kw.searchVolume.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{kw.difficulty}</td>
                      <td className="py-2">{kw.intent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
