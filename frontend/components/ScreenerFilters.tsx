'use client';

import { useState } from 'react';
import { PRESETS } from '@/lib/screener/presets';
import type { ScreenerPreset } from '@/lib/screener/presets';

interface FiltersState {
  rsiMin: number;
  rsiMax: number;
  scoreMin: number;
  secteur: string;
  dividendMin: number;
}

export default function ScreenerFilters({
  isPremium,
  onFilterChange,
}: {
  isPremium: boolean;
  onFilterChange: (filters: ScreenerPreset['filters']) => void;
}) {
  const [filters, setFilters] = useState<FiltersState>({
    rsiMin: 0,
    rsiMax: 100,
    scoreMin: 0,
    secteur: '',
    dividendMin: 0,
  });

  const handleChange = (key: keyof FiltersState, value: number | string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // Build filters object for parent
    const filterObj: ScreenerPreset['filters'] = {
      rsiMin: newFilters.rsiMin > 0 ? newFilters.rsiMin : undefined,
      rsiMax: newFilters.rsiMax < 100 ? newFilters.rsiMax : undefined,
      scoreMin: newFilters.scoreMin > 0 ? newFilters.scoreMin : undefined,
      dividendMin: newFilters.dividendMin > 0 ? newFilters.dividendMin : undefined,
      secteur: newFilters.secteur ? newFilters.secteur : undefined,
    };
    onFilterChange(filterObj);
  };

  const applyPreset = (preset: ScreenerPreset) => {
    const newFilters: FiltersState = {
      rsiMin: preset.filters.rsiMin ?? 0,
      rsiMax: preset.filters.rsiMax ?? 100,
      scoreMin: preset.filters.scoreMin ?? 0,
      secteur: '',
      dividendMin: preset.filters.dividendMin ?? 0,
    };
    setFilters(newFilters);
    onFilterChange(preset.filters);
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-medium text-ivory">Filtres</h3>

      <div className="space-y-2">
        <label className="text-xs text-muted uppercase">RSI</label>
        <div className="flex gap-2">
          <input
            id="rsiMin"
            type="number"
            min="0"
            max="100"
            value={filters.rsiMin}
            onChange={(e) => handleChange('rsiMin', parseInt(e.target.value) || 0)}
            placeholder="Min"
            className="flex-1 bg-elevated border border-border rounded px-2 py-1 text-sm text-ivory placeholder-faint focus:outline-none focus:ring-1 focus:ring-accent transition"
            aria-label="RSI minimum"
          />
          <input
            id="rsiMax"
            type="number"
            min="0"
            max="100"
            value={filters.rsiMax}
            onChange={(e) => handleChange('rsiMax', parseInt(e.target.value) || 100)}
            placeholder="Max"
            className="flex-1 bg-elevated border border-border rounded px-2 py-1 text-sm text-ivory placeholder-faint focus:outline-none focus:ring-1 focus:ring-accent transition"
            aria-label="RSI maximum"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="scoreMin" className="text-xs text-muted uppercase">
          Score signal
        </label>
        <input
          id="scoreMin"
          type="range"
          min="0"
          max="100"
          value={filters.scoreMin}
          onChange={(e) => handleChange('scoreMin', parseInt(e.target.value) || 0)}
          className="w-full"
          aria-label="Score signal minimum"
        />
        <p className="text-xs text-faint">&gt; {filters.scoreMin}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="dividendMin" className="text-xs text-muted uppercase">
          Dividende min %
        </label>
        <input
          id="dividendMin"
          type="number"
          step="0.1"
          min="0"
          value={filters.dividendMin}
          onChange={(e) => handleChange('dividendMin', parseFloat(e.target.value) || 0)}
          placeholder="0"
          className="w-full bg-elevated border border-border rounded px-2 py-1 text-sm text-ivory placeholder-faint focus:outline-none focus:ring-1 focus:ring-accent transition"
          aria-label="Minimum dividend percentage"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted uppercase">Presets</label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) =>
            !p.isPremium || isPremium ? (
              <button
                key={p.name}
                type="button"
                className={`text-xs px-2 py-1 rounded border transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-accent/50 ${
                  p.isPremium ? 'border-accent/40 text-accent bg-accent/10 hover:border-accent/60' : 'border-border text-muted hover:border-accent/30'
                }`}
                onClick={() => applyPreset(p)}
              >
                {p.label} {p.isPremium && '🔒'}
              </button>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
