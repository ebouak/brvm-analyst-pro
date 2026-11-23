'use client';

import { useEffect, useState } from 'react';
import { getLatestPatternScore } from '@/lib/patterns/queries';
import type { PatternScore } from '@/lib/patterns/database';
import { fmtDateCourte, fmtNumber } from '@/lib/format';

/** « 0,42 » signé (« +0,42 », « −0,42 ») ; null → tiret. */
const signe = (v: number | null | undefined, d: number) =>
  v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNumber(Math.abs(v), d)}`;

interface PatternDiagnosticProps {
  code: string;
}

export default function PatternDiagnostic({ code }: PatternDiagnosticProps) {
  const [pattern, setPattern] = useState<PatternScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getLatestPatternScore(code);
        setPattern(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code]);

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {[80, 60, 90].map((w, i) => (
          <div key={i} className="animate-pulse h-4 bg-border rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface border border-down/30 rounded-xl p-4">
        <p className="text-sm text-down">Erreur : {error}</p>
      </div>
    );
  }

  if (!pattern || pattern.patterns_detected_count === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-muted text-sm">Aucun motif intraday détecté pour {code}</p>
      </div>
    );
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'HIGH':
        return 'bg-up/20 text-up border-up/30';
      case 'MEDIUM':
        return 'bg-warn/20 text-warn border-warn/30';
      default:
        return 'bg-down/20 text-down border-down/30';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Analyse technique intraday</h3>

      {/* ATR Section */}
      {pattern.atr_score !== null && (
        <div className={`bg-elevated/50 border rounded-lg p-4 ${getConfidenceColor(pattern.atr_confidence || 'LOW')}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-white">ATR Extrême</span>
            {pattern.atr_confidence && (
              <span className={`px-2 py-1 rounded text-xs font-bold border ${getConfidenceColor(pattern.atr_confidence)}`}>
                {pattern.atr_confidence === 'HIGH' ? 'Confiance élevée' : pattern.atr_confidence === 'MEDIUM' ? 'Confiance modérée' : 'Confiance faible'}
              </span>
            )}
          </div>
          {pattern.atr_explanation_fr && (
            <p className="text-sm text-muted mb-2">{pattern.atr_explanation_fr}</p>
          )}
          <div className="mt-2 text-xs text-muted">
            Score : <span className="font-mono font-bold text-white">{fmtNumber(pattern.atr_score, 1)}</span>
          </div>
        </div>
      )}

      {/* Consolidation Section */}
      {pattern.consolidation_score !== null && (
        <div className={`bg-elevated/50 border rounded-lg p-4 ${getConfidenceColor(pattern.consolidation_confidence || 'LOW')}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-white">Consolidation Haussière</span>
            {pattern.consolidation_confidence && (
              <span className={`px-2 py-1 rounded text-xs font-bold border ${getConfidenceColor(pattern.consolidation_confidence)}`}>
                {pattern.consolidation_confidence === 'HIGH' ? 'Confiance élevée' : pattern.consolidation_confidence === 'MEDIUM' ? 'Confiance modérée' : 'Confiance faible'}
              </span>
            )}
          </div>
          {pattern.consolidation_explanation_fr && (
            <p className="text-sm text-muted mb-2">{pattern.consolidation_explanation_fr}</p>
          )}
          <div className="mt-2 text-xs text-muted">
            Score : <span className="font-mono font-bold text-white">{fmtNumber(pattern.consolidation_score, 1)}</span>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="bg-info/10 border border-info/30 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted">Confiance globale</span>
            <div className={`font-semibold mt-1 ${
              pattern.overall_confidence === 'HIGH' ? 'text-up' :
              pattern.overall_confidence === 'MEDIUM' ? 'text-warn' :
              'text-down'
            }`}>
              {pattern.overall_confidence === 'HIGH' ? 'Élevée' :
               pattern.overall_confidence === 'MEDIUM' ? 'Modérée' :
               'Faible'}
            </div>
          </div>
          <div>
            <span className="text-muted">Score combiné</span>
            <div className="font-semibold text-info mt-1">
              {fmtNumber(pattern.combined_pattern_score, 1)}
            </div>
          </div>
          <div>
            <span className="text-muted">Motifs détectés</span>
            <div className="font-semibold text-info mt-1">{pattern.patterns_detected_count}</div>
          </div>
          {pattern.patterns_with_news_count > 0 && (
            <div>
              <span className="text-muted">Avec actualité</span>
              <div className="font-semibold text-info mt-1">{pattern.patterns_with_news_count}</div>
            </div>
          )}
          <div>
            <span className="text-muted">Effet sur la note du conseiller</span>
            <div className={`font-semibold mt-1 ${pattern.advisor_sub_score_delta && pattern.advisor_sub_score_delta > 0 ? 'text-up' : 'text-down'}`}>
              {signe(pattern.advisor_sub_score_delta, 2)}
            </div>
          </div>
          {pattern.advisor_impact_estimate !== null && (
            <div>
              <span className="text-muted">Impact sur score</span>
              <div className="font-semibold text-info mt-1">
                {fmtNumber(pattern.advisor_impact_estimate * 100, 0)} %
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Timestamp & Engine Version */}
      <div className="text-xs text-faint px-4 py-2">
        <span>Analyse du {fmtDateCourte(pattern.date_marche)}</span>
        <span className="mx-2" aria-hidden="true">·</span>
        {/* engine_version porte déjà son « v » (« v1.0.0 ») : l'affichage disait « vv1.0.0 ». */}
        <span>Moteur v{String(pattern.engine_version).replace(/^v/i, '')}</span>
      </div>
    </div>
  );
}
