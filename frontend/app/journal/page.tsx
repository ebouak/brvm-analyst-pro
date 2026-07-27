import Link from 'next/link';
import { loadTheses } from '@/lib/journal/queries';
import { computeBilan } from '@/lib/journal/bilan';
import CloturerButton from '@/components/journal/CloturerButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Journal de décision' };

const pct = (x: number | null) =>
  x == null ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1).replace('.', ',')} %`;

const VERDICT_LABEL: Record<string, string> = {
  jouee: 'Jouée', invalidee: 'Invalidée', abandonnee: 'Abandonnée',
};

export default async function JournalPage() {
  const theses = await loadTheses();
  const actives = theses.filter((t) => t.statut === 'active');
  const cloturees = theses.filter((t) => t.statut === 'cloturee');

  // Stats honnêtes : décompte des verdicts, jamais estimé.
  const stats: Record<string, number> = { jouee: 0, invalidee: 0, abandonnee: 0 };
  for (const t of cloturees) if (t.verdict) stats[t.verdict] = (stats[t.verdict] ?? 0) + 1;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Journal de décision</h1>
          <p className="text-sm text-muted mt-1">
            Vos thèses d’investissement et leur bilan a posteriori. Apprendre de ses choix,
            confirmés comme démentis.
          </p>
        </div>

        {cloturees.length > 0 && (
          <div className="flex gap-4 text-xs text-muted">
            <span><span className="text-up font-semibold">{stats.jouee ?? 0}</span> jouées</span>
            <span><span className="text-down font-semibold">{stats.invalidee ?? 0}</span> invalidées</span>
            <span><span className="text-faint font-semibold">{stats.abandonnee ?? 0}</span> abandonnées</span>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted">Thèses actives</h2>
          {actives.length === 0 ? (
            <p className="text-sm text-muted rounded-xl border border-border bg-surface p-6 text-center">
              Aucune thèse active. Rédigez-en une depuis la fiche d’une action.
            </p>
          ) : actives.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <Link href={`/actions/${t.code}`} className="font-semibold text-white hover:text-accent">
                  {t.code}
                </Link>
                <span className="text-[11px] text-muted uppercase">{t.stance}</span>
              </div>
              <p className="text-sm text-muted mt-1.5 whitespace-pre-wrap">{t.these}</p>
              {t.cours_reference != null && (
                <p className="text-[11px] text-faint mt-1">
                  Référence : {t.cours_reference} FCFA
                  {t.objectif != null && ` · Objectif : ${t.objectif} FCFA`}
                </p>
              )}
              <CloturerButton id={t.id} />
            </div>
          ))}
        </section>

        {cloturees.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-muted">Historique</h2>
            {cloturees.map((t) => {
              const bilan = t.cours_cloture != null
                ? computeBilan(
                    {
                      stance: t.stance,
                      coursReference: t.cours_reference,
                      objectif: t.objectif,
                      coursCloture: t.cours_cloture,
                    },
                    t.verdict ?? '',
                  )
                : null;
              return (
                <div key={t.id} className="rounded-xl border border-border/60 bg-surface/60 p-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/actions/${t.code}`} className="font-semibold text-white hover:text-accent">
                      {t.code}
                    </Link>
                    <span className="text-[11px] text-muted">
                      {t.verdict ? VERDICT_LABEL[t.verdict] : '—'}
                      {bilan && ` · ${pct(bilan.performancePct)}`}
                    </span>
                  </div>
                  {t.bilan && <p className="text-sm text-muted mt-1.5 whitespace-pre-wrap">{t.bilan}</p>}
                  {bilan && bilan.verdictCoherent === false && (
                    <p className="text-[11px] text-warn mt-1">
                      ⓘ Le verdict « jouée » ne concorde pas avec l’évolution réelle du cours.
                    </p>
                  )}
                  <p className="text-[11px] text-faint mt-1">
                    Clôturée le {t.cloturee_le?.slice(0, 10) ?? '—'}
                    {t.cours_cloture != null && ` · cours ${t.cours_cloture} FCFA`}
                  </p>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
