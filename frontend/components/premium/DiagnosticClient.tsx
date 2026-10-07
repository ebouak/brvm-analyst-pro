'use client';
import { useState, useEffect, useMemo, useDeferredValue, type ReactNode } from 'react';
import { MARQUE_ECHEC, MESSAGE_ECHEC } from '@/lib/diagnostic/echec';

/** Même durée que MAX_AGE_MS de la route : au-delà, le rapport est régénéré. */
const AGE_MAX_MS = 7 * 24 * 3600 * 1000;

/** Gras en ligne : « **texte** » → <strong>. Le reste est rendu tel quel. */
function enLigne(texte: string): ReactNode[] {
  return texte.split(/(\*\*[^*]+\*\*)/g).map((morceau, i) =>
    /^\*\*[^*]+\*\*$/.test(morceau)
      ? <strong key={i} className="font-semibold text-white">{morceau.slice(2, -2)}</strong>
      : morceau,
  );
}

interface Props {
  code: string;
  cachedMarkdown: string | null;
  cachedAt: string | null;
  /**
   * Graphiques rendus au serveur, rangés par numéro de section du rapport
   * (« 3 » = rentabilité…). Chacun s'insère sous le titre de sa section ; ceux
   * dont le titre n'apparaît pas sont regroupés à la fin — aucun ne se perd.
   */
  graphiques?: Record<string, ReactNode>;
}

/** « ## 3. ANALYSE… », « ### **7. VALORISATION** » → « 3 », « 7 ». */
function numeroSection(ligne: string): string | null {
  const m = /^#{1,6}\s*\**\s*(\d{1,2})[.)]/.exec(ligne);
  return m ? String(Number(m[1])) : null;
}

export default function DiagnosticClient({ code, cachedMarkdown, cachedAt, graphiques = {} }: Props) {
  const [markdown, setMarkdown] = useState(cachedMarkdown ?? '');
  const [dateRapport, setDateRapport] = useState<string | null>(cachedAt);
  const [loading, setLoading] = useState(false);
  // Un rapport de plus de 7 jours n'est plus « actualisé chaque semaine » : il
  // reste affiché (mieux qu'un écran vide) le temps que le nouveau arrive.
  const perime = !!cachedAt && Date.now() - new Date(cachedAt).getTime() > AGE_MAX_MS;
  const [error, setError] = useState<string | null>(null);

  async function generate(force = false) {
    setLoading(true);
    setError(null);
    // On NE VIDE PAS le rapport en cours. Une régénération qui échoue laissait
    // l'écran vide alors qu'un rapport valide existait toujours en base : la
    // personne perdait ce qu'elle lisait pour rien. Le contenu n'est remplacé
    // qu'à l'arrivée du premier morceau du nouveau.
    const precedent = markdown;
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
        const j = await res.json() as { markdown?: string; generated_at?: string };
        setMarkdown(j.markdown ?? '');
        if (j.generated_at) setDateRapport(j.generated_at);
        return;
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        if (buf.includes(MARQUE_ECHEC)) {
          // Panne déclarée par le serveur : un message pour la personne, et le
          // rapport précédent reste à l'écran plutôt que d'être effacé.
          setError(MESSAGE_ECHEC);
          setMarkdown(precedent);
          return;
        }
        // Tronque à un éventuel marqueur partiel (il commence par un octet
        // nul) : sans cela un fragment du marqueur s'afficherait une frame.
        setMarkdown(buf.split('\u0000')[0] ?? '');
      }
      // Rapport neuf, complet : sa date est celle du jour.
      if (buf && !buf.includes(MARQUE_ECHEC)) setDateRapport(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Sans rapport, ou avec un rapport périmé : le serveur ne régénère que
    // si son propre cache a plus de 7 jours (force = false).
    if (!cachedMarkdown || perime) void generate(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // rerender-use-deferred-value : pendant le streaming, on diffère le rendu lourd
  // du markdown pour garder l'UI réactive ; useMemo évite de re-parser à chaque render.
  const deferredMarkdown = useDeferredValue(markdown);
  const { rendu: renderedMarkdown, restants } = useMemo(() => {
    const places = new Set<string>();
    const rendu = deferredMarkdown.split('\n').flatMap((line, i) => {
      const n = numeroSection(line.trimEnd());
      const el = rendreLigne(line, i);
      if (n && graphiques[n] && !places.has(n)) {
        places.add(n);
        return [el, <div key={`g${n}`}>{graphiques[n]}</div>];
      }
      return [el];
    });
    const restants = Object.keys(graphiques).filter((n) => !places.has(n)).sort((a, b) => Number(a) - Number(b));
    return { rendu, restants };
  }, [deferredMarkdown, graphiques]);

  function rendreLigne(line: string, i: number): ReactNode {
        const l = line.trimEnd();
        if (/^#\s/.test(l)) return <h2 key={i} className="text-lg font-semibold text-white mt-2 mb-3">{enLigne(l.replace(/^#\s+/, ''))}</h2>;
        if (l.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-white mt-6 mb-2 border-b border-border pb-1">{enLigne(l.slice(3))}</h2>;
        if (/^#{3,6}\s/.test(l)) return <h3 key={i} className="text-sm font-semibold text-white mt-4 mb-1">{enLigne(l.replace(/^#{3,6}\s+/, ''))}</h3>;
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(l.trim())) return <hr key={i} className="my-4 border-border" />;
        if (/^\s*[-*]\s/.test(l)) return <li key={i} className="text-sm text-muted ml-4 list-disc leading-relaxed">{enLigne(l.replace(/^\s*[-*]\s+/, ''))}</li>;
        if (l.trimStart().startsWith('|')) {
          // Ligne de séparation d'un tableau (|---|---|) : rien à afficher.
          if (/^\|?[\s:|-]+\|?$/.test(l.trim())) return null;
          return <p key={i} className="text-xs text-muted font-mono whitespace-pre overflow-x-auto">{l.replace(/\*\*/g, '')}</p>;
        }
        if (l.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm text-muted leading-relaxed">{enLigne(l)}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {dateRapport && (
          <p className="text-xs text-faint">
            Rapport du {new Date(dateRapport).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {loading && perime && ' · mise à jour en cours…'}
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
              <span aria-hidden="true">↓</span> PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => void generate(true)}
            disabled={loading}
            aria-label={cachedMarkdown ? 'Regénérer le diagnostic' : 'Générer le diagnostic'}
            className="px-3 py-1.5 text-xs rounded-lg bg-up text-bg font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-up/50"
          >
            {loading ? 'Génération…' : cachedMarkdown ? '↺ Regénérer' : '✦ Générer le diagnostic'}
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
          {restants.length > 0 && (
            <>
              <h2 className="text-base font-semibold text-white mt-6 mb-2 border-b border-border pb-1">Graphiques complémentaires</h2>
              {restants.map((n) => <div key={`r${n}`}>{graphiques[n]}</div>)}
            </>
          )}
        </div>
      )}

      {!markdown && Object.keys(graphiques).length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-2">Les chiffres en graphiques</h2>
          {Object.keys(graphiques).sort((a, b) => Number(a) - Number(b)).map((n) => <div key={`v${n}`}>{graphiques[n]}</div>)}
        </div>
      )}

      {!loading && !markdown && !error && (
        <div className="bg-surface border border-border rounded-xl p-10 text-center space-y-2">
          <p className="text-muted text-sm">Aucun diagnostic disponible pour {code}.</p>
          <p className="text-faint text-xs">Cliquez sur &quot;Générer le diagnostic&quot; pour lancer l&apos;analyse.</p>
        </div>
      )}
    </div>
  );
}
