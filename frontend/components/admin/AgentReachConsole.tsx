'use client';

import { useState } from 'react';

type Source = 'github' | 'twitter' | 'stackoverflow' | 'youtube' | 'rss' | 'linkedin';

interface SearchResult {
  title: string;
  summary: string;
  url: string;
  tags: string[];
  source: string;
}

export default function AgentReachConsole() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<Source | null>(null);

  const sources: Array<{ id: Source; label: string; icon: string }> = [
    { id: 'github', label: 'GitHub', icon: '🔗' },
    { id: 'twitter', label: 'Twitter', icon: '🐦' },
    { id: 'stackoverflow', label: 'Stack Overflow', icon: '❓' },
    { id: 'youtube', label: 'YouTube', icon: '📹' },
    { id: 'rss', label: 'RSS', icon: '📰' },
    { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  ];

  const handleSearch = async (source: Source) => {
    if (!query.trim()) {
      setError('Veuillez entrer une requête de recherche');
      return;
    }

    setLoading(true);
    setError(null);
    setActiveSource(source);

    try {
      const response = await fetch('/api/admin/agent-reach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Erreur lors de la recherche (${response.status})`
        );
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <label className="block text-sm font-semibold mb-2 text-accent">
          Requête de Recherche
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && activeSource) {
              handleSearch(activeSource);
            }
          }}
          placeholder="Ex: 'BRVM intraday patterns', 'RSI indicator', 'trading consolidation'"
          className="w-full px-3 py-2 bg-elevated border border-border rounded-lg text-white placeholder-muted focus:outline-none focus:border-accent"
        />
        <p className="text-xs text-muted mt-2">
          Entrez votre requête, puis sélectionnez une source pour explorer
        </p>
      </div>

      {/* Source Buttons */}
      <div>
        <p className="text-sm font-semibold mb-3 text-muted">Choisir une Source</p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {sources.map((source) => (
            <button
              key={source.id}
              onClick={() => {
                if (query.trim()) {
                  handleSearch(source.id);
                } else {
                  setError('Veuillez entrer une requête de recherche');
                }
              }}
              disabled={loading || !query.trim()}
              className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg text-sm font-medium transition ${
                activeSource === source.id
                  ? 'bg-accent/30 border border-accent text-accent'
                  : 'bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-lg">{source.icon}</span>
              <span className="text-xs">{source.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted">
          <div className="inline-block animate-spin mr-2">⌛</div>
          Recherche en cours sur {activeSource}...
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="font-semibold text-accent">
              Résultats: {results.length} trouvé(s)
            </h3>
          </div>

          <div className="space-y-2">
            {results.map((result, idx) => (
              <div
                key={idx}
                className="bg-surface border border-border rounded-lg p-4 hover:border-accent/50 transition"
              >
                {/* Title and Source */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-semibold text-sm flex-1"
                  >
                    {result.title}
                  </a>
                  <div className="text-xs bg-elevated text-muted px-2 py-1 rounded flex-shrink-0">
                    {result.source}
                  </div>
                </div>

                {/* Summary */}
                {result.summary && (
                  <p className="text-muted text-xs mb-3 line-clamp-2">
                    {result.summary}
                  </p>
                )}

                {/* Tags */}
                {result.tags && result.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-elevated text-accent px-2 py-1 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                    {result.tags.length > 4 && (
                      <span className="text-xs text-muted">
                        +{result.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && activeSource && results.length === 0 && !error && (
        <div className="bg-surface border border-border rounded-lg p-6 text-center text-muted">
          Aucun résultat trouvé. Essayez une autre requête ou une autre source.
        </div>
      )}

      {/* Info Box */}
      <div className="bg-elevated border border-border rounded-lg p-4">
        <p className="text-xs text-muted leading-relaxed">
          💡 <strong>Conseil:</strong> Le système Agent Reach recherche sur GitHub (repos BRVM), Twitter
          (hashtags #BRVM), Stack Overflow (tags techniques), YouTube (tutoriels), RSS (news financières)
          et LinkedIn (intelligence concurrentielle).
        </p>
      </div>
    </div>
  );
}
