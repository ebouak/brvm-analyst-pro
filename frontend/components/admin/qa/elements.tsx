import Link from 'next/link';
import { LIBELLE_VERDICT, type Verdict } from '@/lib/qa/verdict';
import type { ArtefactLigne, ResultatLigne, TentativeLigne } from '@/lib/qa/lecture';

/**
 * Briques d'affichage de /admin/qualite (composants serveur, sans état).
 * Couleur ET libellé texte pour chaque statut : l'information ne repose
 * jamais sur la seule couleur.
 */

const DASH = '—';

export function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

export function fmtDuree(ms: number | null): string {
  if (ms == null) return DASH;
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

const STYLE_VERDICT: Record<Verdict, string> = {
  succes: 'border-up/40 bg-up/10 text-up',
  intermittent: 'border-warn/40 bg-warn/10 text-warn',
  echec: 'border-down/40 bg-down/10 text-down',
  aucun_test: 'border-warn/40 bg-warn/10 text-warn',
  erreur_infra: 'border-down/40 bg-down/10 text-down',
  interrompu: 'border-down/40 bg-down/10 text-down',
  en_cours: 'border-accent/40 bg-accent/10 text-accent',
  incomplet: 'border-warn/40 bg-warn/10 text-warn',
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE_VERDICT[verdict]}`}>
      {LIBELLE_VERDICT[verdict]}
    </span>
  );
}

const STATUT_FINAL: Record<ResultatLigne['statut_final'], { libelle: string; style: string }> = {
  reussi: { libelle: 'Réussi', style: 'text-up' },
  echoue: { libelle: 'Échoué', style: 'text-down font-semibold' },
  intermittent: { libelle: 'Intermittent', style: 'text-warn' },
  ignore: { libelle: 'Ignoré', style: 'text-faint' },
};

export function StatutFinal({ statut }: { statut: ResultatLigne['statut_final'] }) {
  const s = STATUT_FINAL[statut];
  return <span className={s.style}>{s.libelle}</span>;
}

const STATUT_TENTATIVE: Record<TentativeLigne['statut'], string> = {
  passed: 'Réussie',
  failed: 'Échouée',
  timedOut: 'Délai dépassé',
  skipped: 'Ignorée',
  interrupted: 'Interrompue',
};
export const libelleTentative = (s: TentativeLigne['statut']) => STATUT_TENTATIVE[s];

export function Commit({ sha, depot = 'ebouak/brvm-analyst-pro' }: { sha: string; depot?: string }) {
  return (
    <a
      href={`https://github.com/${depot}/commit/${sha}`}
      className="tabular text-accent hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      title={sha}
    >
      {sha.slice(0, 7)}
    </a>
  );
}

const NOM_ARTEFACT: Record<ArtefactLigne['type'], string> = {
  capture: 'Capture',
  trace: 'Trace Playwright',
  video: 'Vidéo',
  rapport_html: 'Rapport HTML (.zip)',
};

/** Lien vers une pièce jointe : uniquement par la route admin (URL signée de 5 min). */
export function LienArtefact({ a }: { a: ArtefactLigne }) {
  const nom = NOM_ARTEFACT[a.type];
  if (a.statut === 'televerse') {
    return (
      <a href={`/api/admin/qa/artefacts/${a.id}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
        {nom}
      </a>
    );
  }
  return (
    <span className="text-faint" title={a.statut === 'purge' ? 'Conservation de 30 jours écoulée' : "La CI ne l'a pas téléversée"}>
      {nom} — {a.statut === 'purge' ? 'purgé' : 'indisponible'}
    </span>
  );
}

export function Pagination({ page, total, parPage, lien }: { page: number; total: number; parPage: number; lien: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / parPage));
  if (pages <= 1) return null;
  const bouton = 'rounded-lg border border-border px-3 py-1.5 text-xs';
  return (
    <nav className="flex items-center justify-between text-xs text-muted" aria-label="Pagination de l'historique">
      {page > 1 ? <Link href={lien(page - 1)} className={`${bouton} hover:text-ivory`}>← Plus récentes</Link> : <span />}
      <span className="tabular">Page {page} / {pages}</span>
      {page < pages ? <Link href={lien(page + 1)} className={`${bouton} hover:text-ivory`}>Plus anciennes →</Link> : <span />}
    </nav>
  );
}

export function Alerte({ ton, titre, children }: { ton: 'info' | 'attention' | 'erreur'; titre: string; children?: React.ReactNode }) {
  const style = { info: 'border-accent/30 bg-accent/[0.06]', attention: 'border-warn/40 bg-warn/[0.07]', erreur: 'border-down/40 bg-down/[0.07]' }[ton];
  return (
    <div role={ton === 'erreur' ? 'alert' : 'status'} className={`rounded-card border px-4 py-3 text-sm ${style}`}>
      <p className="font-medium text-ivory">{titre}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}
