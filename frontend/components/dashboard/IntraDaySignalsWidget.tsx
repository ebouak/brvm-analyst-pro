'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPatternsForDate } from '@/lib/patterns/queries';
import type { PatternScreenerData } from '@/lib/patterns/queries';

export default function IntraDaySignalsWidget() {
  const [patterns, setPatterns] = useState<PatternScreenerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPatterns = async () => {
      try {
        setLoading(true);
        setError(null);
        const today = new Date().toISOString().split('T')[0];
        const data = await getPatternsForDate(today);
        setPatterns(data.slice(0, 5)); // Show top 5 latest
      } catch (err) {
        console.error('Error loading patterns:', err);
        setError('Erreur lors du chargement des signaux');
        setPatterns([]);
      } finally {
        setLoading(false);
      }
    };

    loadPatterns();
    const interval = setInterval(loadPatterns, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-elevated rounded w-32 animate-pulse" />
          <div className="h-4 bg-elevated rounded w-12 animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-elevated/50 rounded h-9 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const atrCount = patterns.filter((p) => p.pattern_type === 'atr_extreme').length;
  const consCount = patterns.filter((p) => p.pattern_type === 'bullish_consolidation').length;

  const getPatternBadge = (patternType: string) => {
    switch (patternType) {
      case 'atr_extreme':
        return { icon: '⚡', label: 'ATR Extrême', bgClass: 'bg-up/20', textClass: 'text-up' };
      case 'bullish_consolidation':
        return { icon: '📊', label: 'Consolidation', bgClass: 'bg-info/20', textClass: 'text-info' };
      case 'breakout_impulse':
        return { icon: '🚀', label: 'Breakout', bgClass: 'bg-accent/20', textClass: 'text-accent' };
      default:
        return { icon: '•', label: patternType, bgClass: 'bg-muted/20', textClass: 'text-muted' };
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-ivory flex items-center gap-2">
          <span className="text-lg">⚡</span> Signaux Intraday
        </h3>
        <span className="text-xs bg-elevated/80 text-muted px-2 py-1 rounded-full font-medium">
          {patterns.length} détecté{patterns.length > 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="text-xs text-down bg-down/10 border border-down/20 rounded p-2">
          {error}
        </div>
      )}

      {patterns.length === 0 ? (
        <p className="text-xs text-muted italic py-2">Aucun signal détecté aujourd'hui</p>
      ) : (
        <>
          {/* Summary counts */}
          <div className="flex gap-3 text-xs border-t border-border/40 pt-3">
            {atrCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-up/10">
                <span className="text-up">⚡</span>
                <span className="text-up font-medium">{atrCount} ATR</span>
              </div>
            )}
            {consCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-info/10">
                <span className="text-info">📊</span>
                <span className="text-info font-medium">{consCount} Cons.</span>
              </div>
            )}
          </div>

          {/* Patterns list */}
          <div className="space-y-2 border-t border-border/40 pt-3">
            {patterns.map((p, idx) => {
              const badge = getPatternBadge(p.pattern_type);
              const isPositive = p.advisor_delta > 0;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-elevated/40 rounded-lg hover:bg-elevated/60 transition-colors border border-border/20"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm font-bold text-accent shrink-0">{p.code}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0 ${badge.bgClass} ${badge.textClass}`}
                    >
                      {badge.icon} {badge.label}
                    </span>
                    {p.confidence_level && (
                      <span className="text-[10px] text-muted bg-muted/10 px-1.5 py-0.5 rounded">
                        {p.confidence_level}
                      </span>
                    )}
                  </div>
                  {p.advisor_delta !== 0 && (
                    <span
                      className={`font-semibold text-sm tabular shrink-0 ml-auto pl-2 ${
                        isPositive ? 'text-up' : 'text-down'
                      }`}
                    >
                      {isPositive ? '+' : ''}{p.advisor_delta}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Footer link */}
      <div className="border-t border-border/40 pt-3 flex items-center">
        <Link
          href="/screener/intraday"
          className="text-xs text-accent hover:text-accent/80 font-medium transition-colors flex items-center gap-1"
        >
          Voir tous les patterns
          <span className="text-[10px]">→</span>
        </Link>
      </div>
    </div>
  );
}
