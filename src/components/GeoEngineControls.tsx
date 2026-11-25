import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin, Plus, X } from 'lucide-react';
import {
  ALL_STATES_LABEL,
  COUNTRIES,
  formatSelectedStates,
  getStatesForCountry,
  GLOBAL_COUNTRY_LABEL,
  parseSelectedStates,
  SEARCH_ENGINE_GROUPS,
} from '../lib/geoAndEngines';

interface CountrySelectProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  onChange: (nextCountry: string) => void;
  className?: string;
}

export function CountrySelect({
  id,
  ariaLabel = 'Country',
  value,
  onChange,
  className = '',
}: CountrySelectProps) {
  const hasExactOption = COUNTRIES.some((c) => c.name === value);

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs ${className}`}
    >
      {!hasExactOption && value && <option value={value}>{value}</option>}
      {COUNTRIES.map((c) => (
        <option key={c.name} value={c.name}>
          {c.code ? `${c.name} (${c.code})` : c.name}
        </option>
      ))}
    </select>
  );
}

interface StateMultiSelectorProps {
  id?: string;
  ariaLabel?: string;
  country: string;
  value: string;
  onChange: (nextState: string) => void;
  className?: string;
}

export function StateMultiSelector({
  id,
  ariaLabel = 'Select states or regions',
  country,
  value,
  onChange,
  className = '',
}: StateMultiSelectorProps) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [customStateInput, setCustomStateInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const presetStates = getStatesForCountry(country);
  const selectedStates = parseSelectedStates(value);
  const isGlobal = !country || country === GLOBAL_COUNTRY_LABEL;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const filteredPresets = presetStates.filter((st) =>
    st.toLowerCase().includes(filterText.trim().toLowerCase())
  );

  const toggleState = (stateName: string) => {
    const exists = selectedStates.some((s) => s.toLowerCase() === stateName.toLowerCase());
    const next = exists
      ? selectedStates.filter((s) => s.toLowerCase() !== stateName.toLowerCase())
      : [...selectedStates, stateName];
    onChange(formatSelectedStates(next));
  };

  const addCustomState = () => {
    const clean = customStateInput.trim();
    if (!clean) return;
    if (!selectedStates.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      onChange(formatSelectedStates([...selectedStates, clean]));
    }
    setCustomStateInput('');
  };

  const displayLabel =
    selectedStates.length === 0
      ? ALL_STATES_LABEL
      : selectedStates.length <= 2
        ? selectedStates.join(', ')
        : `${selectedStates[0]}, ${selectedStates[1]} +${selectedStates.length - 2}`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs flex items-center justify-between gap-2 text-left cursor-pointer hover:border-[#565FEA]/60 transition-colors"
      >
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
          <MapPin className="w-3.5 h-3.5 text-[#565FEA] shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 sm:min-w-[270px] mt-1.5 z-40 bg-white dark:bg-[#151A33] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
              {isGlobal ? 'Regions / States (Any Country)' : `${country} States & Regions`}
            </span>
            <button
              type="button"
              onClick={() => {
                onChange(ALL_STATES_LABEL);
                setOpen(false);
              }}
              className="text-[11px] font-semibold text-[#565FEA] hover:underline shrink-0 cursor-pointer"
            >
              All States
            </button>
          </div>

          {selectedStates.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedStates.map((st) => (
                <span
                  key={st}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#565FEA]/10 text-[#565FEA] dark:text-[#8E96FF] text-[11px] font-medium"
                >
                  {st}
                  <button
                    type="button"
                    aria-label={`Remove state ${st}`}
                    onClick={() => toggleState(st)}
                    className="hover:text-red-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {presetStates.length > 0 && (
            <>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={`Filter ${presetStates.length} states/regions...`}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
              <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1">
                {filteredPresets.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-1">No matching state preset. Add custom below.</p>
                ) : (
                  filteredPresets.map((st) => {
                    const checked = selectedStates.some((s) => s.toLowerCase() === st.toLowerCase());
                    return (
                      <label
                        key={st}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleState(st)}
                          className="rounded border-slate-300 text-[#565FEA]"
                        />
                        <span className="truncate">{st}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </>
          )}

          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <span className="block text-[10px] text-slate-400">
              {presetStates.length > 0
                ? 'Or add any custom state, city, or region:'
                : 'Type any state, province, or city of your choice:'}
            </span>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customStateInput}
                onChange={(e) => setCustomStateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomState();
                  }
                }}
                placeholder="e.g., Lagos, Austin, Bavaria..."
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
              <button
                type="button"
                onClick={addCustomState}
                className="px-2.5 py-1.5 rounded-lg bg-[#565FEA] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SearchEngineSelectProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  onChange: (nextEngine: string) => void;
  className?: string;
  includeAllOption?: boolean;
}

export function SearchEngineSelect({
  id,
  ariaLabel = 'Search engine',
  value,
  onChange,
  className = '',
  includeAllOption = false,
}: SearchEngineSelectProps) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D1021] text-xs ${className}`}
    >
      {includeAllOption && <option value="All Engines">All Search Engines</option>}
      {SEARCH_ENGINE_GROUPS.map((group) => (
        <optgroup key={group.group} label={group.group}>
          {group.engines.map((engine) => (
            <option key={engine} value={engine}>
              {engine}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
