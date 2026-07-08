'use client';

import { useState, useEffect } from 'react';
import { getPatternsForDate } from '@/lib/patterns/queries.js';
import type { PatternScreenerData } from '@/lib/patterns/queries.js';

interface IntraDayPatternsTableProps {
  dateMarche?: string;
  onPatternSelect?: (pattern: PatternScreenerData) => void;
}

export default function IntraDayPatternsTable({
  dateMarche = new Date().toISOString().split('T')[0],
  onPatternSelect,
}: IntraDayPatternsTableProps) {
  const [patterns, setPatterns] = useState<PatternScreenerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    patternType?: string;
    confidence?: string;
  }>({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const loadPatterns = async () => {
      setLoading(true);
      const data = await getPatternsForDate(dateMarche);

      // Apply filters
      const filtered = data.filter((p) => {
        if (filter.patternType && p.pattern_type !== filter.patternType) return false;
        if (filter.confidence && p.confidence_level !== filter.confidence) return false;
        return true;
      });

      setPatterns(filtered);
      setLoading(false);
    };

    loadPatterns();
  }, [dateMarche, filter]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      getPatternsForDate(dateMarche).then((data) => {
        const filtered = data.filter((p) => {
          if (filter.patternType && p.pattern_type !== filter.patternType) return false;
          if (filter.confidence && p.confidence_level !== filter.confidence) return false;
          return true;
        });
        setPatterns(filtered);
      });
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [dateMarche, filter, autoRefresh]);

  const getPatternBadge = (type: string) => {
    const configs: Record<string, { icon: string; label: string; color: string }> = {
      atr_extreme: { icon: '⚡', label: 'ATR Extrême', color: 'bg-up text-white' },
      bullish_consolidation: { icon: '📊', label: 'Consolidation', color: 'bg-info text-white' },
    };
    const config = configs[type] || { icon: '◈', label: type, color: 'bg-muted text-ivory' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors: Record<string, string> = {
      HIGH: 'bg-up',
      MEDIUM: 'bg-warn',
      LOW: 'bg-down',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium text-white ${colors[confidence] || 'bg-muted'}`}>
        {confidence}
      </span>
    );
  };

  const formatAdvisorDelta = (delta: number) => {
    const sign = delta > 0 ? '+' : '';
    const color = delta > 0 ? 'text-up' : delta < 0 ? 'text-down' : 'text-muted';
    return <span className={`tabular font-medium ${color}`}>{sign}{delta.toFixed(1)}</span>;
  };

  if (loading) {
    return (
      <div className="text-center text-muted py-8">Chargement des patterns...</div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center">
        <p className="text-muted mb-2">◈ Aucun pattern détecté</p>
        <p className="text-xs text-faint">Aucun pattern valide pour {dateMarche}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-4">
          <select
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-ivory"
            value={filter.patternType || ''}
            onChange={(e) => setFilter({ ...filter, patternType: e.target.value || undefined })}
          >
            <option value="">Tous les types</option>
            <option value="atr_extreme">ATR Extrême</option>
            <option value="bullish_consolidation">Consolidation</option>
          </select>

          <select
            className="bg-surface border border-border rounded px-3 py-2 text-sm text-ivory"
            value={filter.confidence || ''}
            onChange={(e) => setFilter({ ...filter, confidence: e.target.value || undefined })}
          >
            <option value="">Tous les niveaux</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>

        <button
          className={`px-3 py-2 rounded text-xs font-medium border transition-colors ${
            autoRefresh
              ? 'bg-accent text-bg border-accent'
              : 'bg-surface border-border text-muted hover:text-ivory'
          }`}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? '🔄 Auto (30s)' : '⏸ Manuel'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-elevated/50 border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-medium">Code</th>
              <th className="text-left py-3 px-4 font-medium">Pattern</th>
              <th className="text-left py-3 px-4 font-medium">Confiance</th>
              <th className="text-left py-3 px-4 font-medium">Qualité</th>
              <th className="text-left py-3 px-4 font-medium">Δ Conseiller</th>
              <th className="text-left py-3 px-4 font-medium">N détections</th>
              <th className="text-left py-3 px-4 font-medium">Justification</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((pattern, idx) => (
              <tr
                key={idx}
                className="border-b border-border hover:bg-elevated/50 cursor-pointer transition"
                onClick={() => onPatternSelect?.(pattern)}
              >
                <td className="py-3 px-4 font-medium text-accent">{pattern.code}</td>
                <td className="py-3 px-4">{getPatternBadge(pattern.pattern_type)}</td>
                <td className="py-3 px-4">{getConfidenceBadge(pattern.confidence_level)}</td>
                <td className="py-3 px-4 tabular">{(pattern.quality_score * 100).toFixed(0)}%</td>
                <td className="py-3 px-4">{formatAdvisorDelta(pattern.advisor_delta)}</td>
                <td className="py-3 px-4 tabular text-center">
                  <span className="bg-surface px-2 py-1 rounded text-xs">
                    {pattern.detected_count}
                  </span>
                </td>
                <td className="py-3 px-4 text-muted text-xs truncate max-w-xs">{pattern.explanation_fr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats footer */}
      <div className="flex justify-between items-center text-xs text-muted">
        <p>Total: {patterns.length} pattern(s) détecté(s)</p>
        <p>Mise à jour: {new Date().toLocaleTimeString('fr-FR')}</p>
      </div>

      {/* Help text */}
      <div className="bg-elevated/30 border border-border/50 rounded-lg p-4 space-y-2 text-xs text-muted">
        <p>
          <strong>⚡ ATR Extrême:</strong> Pics de volatilité où le prix franchit 3× l'ATR (Average True Range).
        </p>
        <p>
          <strong>📊 Consolidation:</strong> Patterns de resserrement haussier avec 3+ bougies à corps serrés.
        </p>
        <p>
          <strong>Δ Conseiller:</strong> Ajustement au score Conseiller (-5 à +5). Positif = signal haussier.
        </p>
      </div>
    </div>
  );
}
