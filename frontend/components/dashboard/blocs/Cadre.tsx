import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtDateFR } from '@/lib/format';
import type { StatutAgenda } from '@/lib/dashboard/agenda';

/** Cadre commun d'un bloc : titre, date de référence TOUJOURS visible, lien. */
export function CadreBloc({
  id, titre, dateReference, legendeDate = 'Données du', ancienne = false, sansDate = false, lien, children,
}: {
  id: string;
  titre: string;
  dateReference: string | null;
  legendeDate?: string;
  /** Donnée plus ancienne que la séance affichée : signalée dans la forme (spec §4). */
  ancienne?: boolean;
  /** États d'invitation (aucune donnée à dater) : pas de pastille de date. */
  sansDate?: boolean;
  lien?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="h-full min-w-0 rounded-panel border border-border bg-surface p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="font-display text-lg text-ivory">{titre}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {!sansDate && (
            <span
              className={`tabular rounded-full border px-2 py-0.5 text-[11px] ${ancienne ? 'border-warn/50 text-warn' : 'border-border text-muted'}`}
            >
              {dateReference ? `${legendeDate} ${fmtDateFR(dateReference)}` : 'Date non disponible'}
            </span>
          )}
          {lien && (
            <Link href={lien.href} className="text-xs font-semibold text-accent-ink hover:underline">
              {lien.label} →
            </Link>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

/** État vide orienté action (spec §4.0) : toujours une phrase, jamais un cadre vide. */
export function EtatVide({ message, actions = [] }: { message: string; actions?: { href: string; label: string }[] }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-bg/30 px-4 py-6 text-center">
      <p className="text-sm text-muted">{message}</p>
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="rounded-full border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent/10">
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Lecture en erreur : distincte d'une liste vide. */
export function Indisponible() {
  return <EtatVide message="Données momentanément indisponibles. Réessayez dans quelques minutes." />;
}

const STATUTS: Record<StatutAgenda, { libelle: string; classe: string }> = {
  officiel: { libelle: 'Officiel', classe: 'border-up/40 text-up' },
  annonce: { libelle: 'Annoncé', classe: 'border-warn/40 text-warn' },
  fermeture: { libelle: 'Bourse fermée', classe: 'border-border-strong text-muted' },
};

export function PastilleStatut({ statut }: { statut: StatutAgenda }) {
  const s = STATUTS[statut];
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.classe}`}>{s.libelle}</span>;
}

/** Pastille neutre (type de publication, « Détenue »…). */
export function Pastille({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${accent ? 'border-accent/50 text-accent-ink' : 'border-border-strong text-muted'}`}>
      {children}
    </span>
  );
}
