import { useState } from 'react';
import type { SocialNetworkMetric } from '../types';

export function AudienceComparisonChart({
  data,
  selectedPlatform,
  onSelectPlatform,
}: {
  data: SocialNetworkMetric[];
  selectedPlatform?: string;
  onSelectPlatform?: (platform: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="space-y-3" role="region" aria-label="Audience versus market average social network chart">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#565FEA]" aria-hidden="true" />
            This Audience %
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
            Market Average %
          </span>
        </div>
        <span>Index &ge; 1.15x indicates strong over-indexing</span>
      </div>

      <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
        {data.map((item) => {
          const isSelected = selectedPlatform === item.platform;
          const isHovered = hovered === item.platform;
          return (
            <button
              key={item.platform}
              type="button"
              onClick={() => onSelectPlatform?.(item.platform)}
              onMouseEnter={() => setHovered(item.platform)}
              onMouseLeave={() => setHovered(null)}
              className={`w-full text-left py-2.5 px-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-[#565FEA] ${
                isSelected
                  ? 'bg-[#565FEA]/8 dark:bg-[#565FEA]/15'
                  : isHovered
                    ? 'bg-slate-100/80 dark:bg-slate-800/50'
                    : ''
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono tabular-nums text-slate-400 w-5">#{item.rank}</span>
                  <span className="text-sm font-semibold text-[#171B35] dark:text-slate-100 truncate">
                    {item.platform}
                  </span>
                  {item.recommended && (
                    <span className="text-[11px] font-medium text-[#565FEA] dark:text-[#8E96FF]">
                      · Recommended
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs font-mono tabular-nums">
                  <span className="font-semibold text-[#171B35] dark:text-white">{item.audiencePct}%</span>
                  <span className="text-slate-400">vs {item.marketAvgPct}% avg</span>
                  <span
                    className={`font-semibold ${
                      item.indexMultiplier >= 1.15
                        ? 'text-[#638D50] dark:text-[#8BC374]'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.indexMultiplier}x
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#565FEA] transition-all duration-300"
                    style={{ width: `${Math.min(100, item.audiencePct)}%` }}
                  />
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-300 dark:bg-slate-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, item.marketAvgPct)}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TrendLineChart({
  series,
  label,
  accentColor = '#565FEA',
}: {
  series: { label: string; value: number }[];
  label: string;
  accentColor?: string;
}) {
  const width = 460;
  const height = 140;
  const padX = 24;
  const padY = 18;
  const maxVal = Math.max(...series.map((s) => s.value), 10);
  const minVal = Math.max(0, Math.min(...series.map((s) => s.value)) - 8);
  const range = Math.max(1, maxVal - minVal);

  const points = series.map((item, idx) => {
    const x = padX + (idx / Math.max(1, series.length - 1)) * (width - padX * 2);
    const y = height - padY - ((item.value - minVal) / range) * (height - padY * 2);
    return { x, y, ...item };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `M ${points[0].x},${height - padY} L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L ${
          points[points.length - 1].x
        },${height - padY} Z`
      : '';

  return (
    <div className="w-full" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
        <defs>
          <linearGradient id={`grad-${label.replace(/\W+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth="1"
        />
        {areaPath && <path d={areaPath} fill={`url(#grad-${label.replace(/\W+/g, '')})`} />}
        {polyline && (
          <polyline
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
          />
        )}
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="3.5" fill={accentColor} />
            <text
              x={p.x}
              y={height - 2}
              textAnchor="middle"
              className="fill-slate-400 text-[10px] font-mono"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function BreakdownBarList({
  items,
}: {
  items: { label: string; primaryPct: number; secondaryPct?: number; subtitle?: string }[];
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium text-[#171B35] dark:text-slate-100 truncate">{item.label}</span>
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
              {item.primaryPct}%
              {typeof item.secondaryPct === 'number' && (
                <span className="text-slate-400"> · {item.secondaryPct}% avg</span>
              )}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#565FEA]"
              style={{ width: `${Math.min(100, item.primaryPct)}%` }}
            />
          </div>
          {item.subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.subtitle}</p>}
        </div>
      ))}
    </div>
  );
}
