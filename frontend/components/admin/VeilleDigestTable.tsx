'use client';

import { useMemo } from 'react';

interface VeilleDigestItem {
  id: number;
  source: string;
  category: string;
  title: string;
  summary: string;
  url: string;
  relevance_score: number;
  sentiment: string;
  is_critical: boolean;
  created_at: string;
  tags: string[];
}

interface VeilleDigestTableProps {
  digest: VeilleDigestItem[];
  loading: boolean;
}

export default function VeilleDigestTable({
  digest,
  loading,
}: VeilleDigestTableProps) {
  const groupedBySource = useMemo(() => {
    const groups: Record<string, VeilleDigestItem[]> = {};
    digest.forEach((item) => {
      if (!groups[item.source]) {
        groups[item.source] = [];
      }
      groups[item.source].push(item);
    });
    return groups;
  }, [digest]);

  const sourceLabels: Record<string, { label: string; icon: string; color: string }> = {
    github: { label: 'GitHub', icon: '🔗', color: 'text-gray-300' },
    twitter: { label: 'Twitter/X', icon: '🐦', color: 'text-blue-400' },
    stack_overflow: { label: 'Stack Overflow', icon: '❓', color: 'text-orange-400' },
    youtube: { label: 'YouTube', icon: '📹', color: 'text-red-500' },
    rss: { label: 'RSS Feeds', icon: '📰', color: 'text-accent' },
    linkedin: { label: 'LinkedIn', icon: '💼', color: 'text-blue-600' },
  };

  const sentimentColors: Record<string, string> = {
    positive: 'text-green-400 bg-green-500/20',
    neutral: 'text-blue-400 bg-blue-500/20',
    negative: 'text-red-400 bg-red-500/20',
  };

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted">
        <div className="inline-block animate-spin mr-2">⌛</div> Chargement...
      </div>
    );
  }

  if (digest.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted">
        Aucune donnée de veille disponible pour aujourd'hui.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedBySource).map(([source, items]) => {
        const meta = sourceLabels[source] || { label: source, icon: '📡', color: 'text-accent' };

        return (
          <div key={source} className="space-y-3">
            <div className="flex items-center gap-2 px-4">
              <span className="text-xl">{meta.icon}</span>
              <h2 className="font-semibold text-accent">
                {meta.label} ({items.length})
              </h2>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`bg-surface border rounded-lg p-4 transition ${
                    item.is_critical
                      ? 'border-gold/70 bg-gold/10'
                      : 'border-border hover:border-accent/50'
                  }`}
                >
                  {/* Title and Critical Badge */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline font-semibold text-sm"
                      >
                        {item.title}
                      </a>
                    </div>
                    {item.is_critical && (
                      <div className="flex-shrink-0 bg-gold/30 text-gold px-2 py-1 rounded text-xs font-semibold">
                        🚨 CRITIQUE
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  {item.summary && (
                    <p className="text-muted text-xs mb-3 line-clamp-2">
                      {item.summary}
                    </p>
                  )}

                  {/* Metadata Row */}
                  <div className="flex items-center flex-wrap gap-3 text-xs">
                    {/* Relevance Score */}
                    <div className="flex items-center gap-1">
                      <span className="text-muted">Pertinence:</span>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-16 bg-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent transition-all"
                            style={{
                              width: `${(item.relevance_score || 0) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-accent font-semibold">
                          {((item.relevance_score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Sentiment Badge */}
                    {item.sentiment && (
                      <div
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          sentimentColors[item.sentiment] ||
                          'text-blue-400 bg-blue-500/20'
                        }`}
                      >
                        {item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1)}
                      </div>
                    )}

                    {/* Category */}
                    {item.category && (
                      <div className="text-muted bg-border px-2 py-1 rounded">
                        {item.category}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-muted ml-auto">
                      {new Date(item.created_at).toLocaleString('fr-FR')}
                    </div>
                  </div>

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-elevated text-accent px-2 py-1 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                      {item.tags.length > 4 && (
                        <span className="text-xs text-muted px-2 py-1">
                          +{item.tags.length - 4} plus
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
