'use client';

import { useEffect } from 'react';
import { useQueryStates, parseAsFloat, parseAsString } from 'nuqs';
import { PRESETS } from '@/lib/screener/presets';
import type { ScreenerPreset } from '@/lib/screener/presets';

/**
 * Les filtres vivent dans l'URL, plus dans un `useState` local.
 *
 * Avant, un utilisateur qui avait construit « les banques dont le RSI est sous
 * 40 avec un dividende supérieur à 5 % » ne pouvait ni partager sa sélection,
 * ni la mettre en favori, ni la retrouver après un rechargement. C'est
 * exactement ce qu'on attend d'un screener.
 *
 * `clearOnDefault` garde l'URL propre : un filtre laissé à sa valeur par
 * défaut ne s'écrit pas dans la barre d'adresse.
 * `history: 'replace'` évite d'empiler une entrée d'historique par cran de
 * curseur déplacé — sinon le bouton Retour devient inutilisable.
 */
const PARSEURS = {
  rsiMin: parseAsFloat.withDefault(0),
  rsiMax: parseAsFloat.withDefault(100),
  scoreMin: parseAsFloat.withDefault(0),
  secteur: parseAsString.withDefault(''),
  dividendMin: parseAsFloat.withDefault(0),
};

interface FiltersState {
  rsiMin: number;
  rsiMax: number;
  scoreMin: number;
  secteur: string;
  dividendMin: number;
}

/** Traduit l'état brut en filtres : une valeur par défaut vaut « pas de filtre ». */
function versFiltres(f: FiltersState): ScreenerPreset['filters'] {
  return {
    rsiMin: f.rsiMin > 0 ? f.rsiMin : undefined,
    rsiMax: f.rsiMax < 100 ? f.rsiMax : undefined,
    scoreMin: f.scoreMin > 0 ? f.scoreMin : undefined,
    dividendMin: f.dividendMin > 0 ? f.dividendMin : undefined,
    secteur: f.secteur ? f.secteur : undefined,
  };
}

export default function ScreenerFilters({
  isPremium,
  onFilterChange,
}: {
  isPremium: boolean;
  onFilterChange: (filters: ScreenerPreset['filters']) => void;
}) {
  const [filters, setFilters] = useQueryStates(PARSEURS, {
    history: 'replace',
    clearOnDefault: true,
  });

  // Remontée à l'ouverture : une URL partagée arrive avec ses filtres déjà
  // posés, et le parent doit les appliquer sans attendre une interaction.
  useEffect(() => {
    onFilterChange(versFiltres(filters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.rsiMin, filters.rsiMax, filters.scoreMin, filters.secteur, filters.dividendMin]);

  const handleChange = (key: keyof FiltersState, value: number | string) => {
    void setFilters({ [key]: value } as Partial<FiltersState>);
  };

  const applyPreset = (preset: ScreenerPreset) => {
    // Un préréglage écrit l'URL comme n'importe quel filtre : la sélection
    // obtenue reste partageable. `onFilterChange` n'est pas appelé ici —
    // l'effet ci-dessus s'en charge dès que l'URL a changé, sinon le parent
    // recevrait deux fois le même filtre.
    void setFilters({
      rsiMin: preset.filters.rsiMin ?? 0,
      rsiMax: preset.filters.rsiMax ?? 100,
      scoreMin: preset.filters.scoreMin ?? 0,
      secteur: '',
      dividendMin: preset.filters.dividendMin ?? 0,
    });
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
