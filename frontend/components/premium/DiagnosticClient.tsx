'use client';
import { useState, useEffect, useMemo, useDeferredValue } from 'react';

interface Props {
  code: string;
  cachedMarkdown: string | null;
  cachedAt: string | null;
}

export default function DiagnosticClient({ code, cachedMarkdown, cachedAt }: Props) {
  const [markdown, setMarkdown] = useState(cachedMarkdown ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(force = false) {
    setLoading(true);
    setError(null);
    setMarkdown('');
    try {
      const res = await fetch(`/api/diagnostic/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? `Erreur ${res.status}`);
        return;
      }

      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const j = await res.json() as { markdown?: string };
        setMarkdown(j.markdown ?? '');
        return;
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setMarkdown(buf);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!cachedMarkdown) void generate(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // rerender-use-deferred-value : pendant le streaming, on diffère le rendu lourd
  // du markdown pour garder l'UI réactive ; useMemo évite de re-parser à chaque render.
  const deferredMarkdown = useDeferredValue(markdown);
  const renderedMarkdown = useMemo(
    () =>
      deferredMarkdown.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-white mt-6 mb-2 border-b border-border pb-1">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-white mt-4 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith('- ')) return <li key={i} className="text-sm text-muted ml-4 list-disc">{line.slice(2)}</li>;
        if (line.startsWith('| ')) return <p key={i} className="text-xs text-muted font-mono whitespace-pre">{line}</p>;
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm text-muted leading-relaxed">{line}</p>;
      }),
    [deferredMarkdown],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {cachedAt && (
          <p className="text-xs text-faint">
            Rapport du {new Date(cachedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        )}
        <div className="flex gap-2 ml-auto">
          {markdown && (
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Imprimer le diagnostic en PDF"
              className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-white hover:border-up/40 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-up/50"
            >
              <span aria-hidden="true">🖨</span> PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => void generate(true)}
            disabled={loading}
            aria-label={cachedMarkdown ? 'Regénérer le diagnostic' : 'Générer le diagnostic'}
            className="px-3 py-1.5 text-xs rounded-lg bg-up text-bg font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-up/50"
          >
            {loading ? '⏳ Génération…' : cachedMarkdown ? '↺ Regénérer' : '✦ Générer le diagnostic'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-surface border border-down/30 rounded-xl p-4 text-sm text-down">{error}</div>
      )}

      {loading && !markdown && (
        <div className="space-y-3 p-6">
          {[80, 60, 90, 70, 50].map((w, i) => (
            <div key={i} className="animate-pulse h-3 bg-border rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {markdown && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-1 print:bg-white print:text-black print:border-0">
          {renderedMarkdown}
        </div>
      )}

      {!loading && !markdown && !error && (
        <div className="bg-surface border border-border rounded-xl p-10 text-center space-y-2">
          <p className="text-muted text-sm">Aucun diagnostic disponible pour {code}.</p>
          <p className="text-faint text-xs">Cliquez sur &quot;Générer le diagnostic&quot; pour lancer l&apos;analyse IA.</p>
        </div>
      )}
    </div>
  );
}
