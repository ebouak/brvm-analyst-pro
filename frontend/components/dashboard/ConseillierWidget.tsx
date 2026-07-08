'use client';

import { useEffect, useState } from 'react';
import type { EnrichedAdvisorResult } from '@/lib/conseiller.js';
import PatternEnrichmentBadge from '@/components/advisor/PatternEnrichmentBadge.js';

interface ConseillierWidgetProps {
  code: string;
  title?: string;
}

const LABEL: Record<'acheter' | 'conserver' | 'vendre', string> = {
  acheter: 'Acheter',
  conserver: 'Conserver',
  vendre: 'Vendre',
};

const BADGE: Record<'acheter' | 'conserver' | 'vendre', string> = {
  acheter: 'bg-up/15 text-up border-up/30',
  conserver: 'bg-gold/10 text-gold border-gold/25',
  vendre: 'bg-down/15 text-down border-down/30',
};

/**
 * Display enriched advisor recommendation for an instrument
 * Fetches recommendation and pattern data from API
 */
export default function ConseillierWidget({
  code,
  title = 'Recommandation',
}: ConseillierWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [advisor, setAdvisor] = useState<EnrichedAdvisorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/advisor/recommend?code=${code}`);
        if (!response.ok) {
          throw new Error('Failed to fetch recommendation');
        }
        const data = await response.json();
        setAdvisor(data);
      } catch (err) {
        console.error('Error fetching recommendation:', err);
        setError('Unable to load recommendation');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchRecommendation();
    }
  }, [code]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 animate-pulse">
        <div className="h-6 bg-elevated rounded w-1/3 mb-2" />
        <div className="h-4 bg-elevated rounded w-1/2" />
      </div>
    );
  }

  if (error || !advisor) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        {error || 'Données insuffisantes'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-muted mb-2">{title}</h3>
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`rounded-md border px-3 py-1 text-sm font-bold ${BADGE[advisor.action]}`}
          >
            {LABEL[advisor.action]}
          </span>
          <span className="text-xs text-muted">
            Conviction {advisor.conviction}%
          </span>
        </div>
      </div>

      {/* Conviction bar */}
      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full ${
              advisor.action === 'acheter'
                ? 'bg-up'
                : advisor.action === 'vendre'
                  ? 'bg-down'
                  : 'bg-gold'
            }`}
            style={{ width: `${advisor.conviction}%` }}
          />
        </div>
      </div>

      {/* Narrative explanation */}
      <p className="text-xs leading-relaxed text-white/80">
        {advisor.narrative}
      </p>

      {/* Pattern enrichment badge if patterns exist */}
      {advisor.patternEnrichment.has_patterns && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <PatternEnrichmentBadge {...advisor.patternEnrichment} />
        </div>
      )}

      {/* Breakdown factors */}
      {advisor.breakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <p className="text-[10px] uppercase tracking-wider text-faint mb-2">
            Détail du calcul
          </p>
          <div className="space-y-1.5">
            {advisor.breakdown.map((factor, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-muted">{factor.label}</span>
                  <span
                    className={`font-semibold ${
                      factor.points > 0
                        ? 'text-up'
                        : factor.points < 0
                          ? 'text-down'
                          : 'text-faint'
                    }`}
                  >
                    {factor.points > 0 ? '+' : ''}
                    {factor.points}
                  </span>
                </div>
                <p className="text-[10px] leading-snug text-faint">
                  {factor.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
