'use client';

import { useEffect, useState } from 'react';
import { getPatternStats } from '@/lib/patterns/queries';

interface PatternStats {
  totalPatterns: number;
  byType: Record<string, number>;
  byConfidence: Record<string, number>;
  codesWithPatterns: number;
}

export default function PatternSummaryWidget() {
  const [stats, setStats] = useState<PatternStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const patternStats = await getPatternStats(today);
        setStats(patternStats);
      } catch (error) {
        console.error('Error loading pattern stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="h-5 bg-elevated rounded w-32 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between items-center p-2 bg-elevated/50 rounded h-8 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const atrCount = stats.byType['atr_extreme'] || 0;
  const consCount = stats.byType['bullish_consolidation'] || 0;
  const breakoutCount = stats.byType['breakout_impulse'] || 0;
  const highConfidenceCount = stats.byConfidence['HIGH'] || 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-ivory flex items-center gap-2">
          <span className="text-lg">📊</span> État des Motifs
        </h3>
      </div>

      {/* Stats Grid */}
      <div className="space-y-3">
        {/* Total patterns */}
        <div className="flex justify-between items-center p-3 bg-elevated/40 rounded-lg border border-border/20">
          <span className="text-sm text-muted">Total Motifs</span>
          <span className="font-mono font-bold text-lg text-ivory">{stats.totalPatterns}</span>
        </div>

        {/* By pattern type */}
        <div className="border-t border-border/40 pt-3">
          <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wide">Par Type</p>
          <div className="space-y-2">
            {atrCount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-up text-xs">⚡</span>
                  <span className="text-muted">ATR Extrême</span>
                </div>
                <span className="font-mono font-bold text-up">{atrCount}</span>
              </div>
            )}
            {consCount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-info text-xs">📊</span>
                  <span className="text-muted">Consolidation</span>
                </div>
                <span className="font-mono font-bold text-info">{consCount}</span>
              </div>
            )}
            {breakoutCount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-accent text-xs">🚀</span>
                  <span className="text-muted">Breakout</span>
                </div>
                <span className="font-mono font-bold text-accent">{breakoutCount}</span>
              </div>
            )}
            {atrCount === 0 && consCount === 0 && breakoutCount === 0 && (
              <p className="text-xs text-muted italic">Aucun motif détecté</p>
            )}
          </div>
        </div>

        {/* By confidence */}
        <div className="border-t border-border/40 pt-3">
          <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wide">Confiance</p>
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="text-up text-xs">✓</span>
              <span className="text-muted">Haute Confiance</span>
            </div>
            <span className="font-mono font-bold text-up">{highConfidenceCount}</span>
          </div>
        </div>

        {/* Unique codes */}
        <div className="border-t border-border/40 pt-3 flex justify-between items-center p-3 bg-elevated/40 rounded-lg border border-border/20">
          <span className="text-sm text-muted">Codes Concernés</span>
          <span className="font-mono font-bold text-lg text-accent">{stats.codesWithPatterns}</span>
        </div>
      </div>
    </div>
  );
}
