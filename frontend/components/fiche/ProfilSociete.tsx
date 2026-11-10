import type React from 'react';
import { fmtDateCourte } from '@/lib/format';
import { libelleSource, type ProfilSociete as Profil } from '@/lib/fiche/profilSociete';
import { DonneeAbsente } from './DonneeAbsente';

/**
 * Profil de la société, découpé en blocs que la fiche place chacun dans sa
 * sous-section (rubrique Société, spec v2 § 5.2). Données retenues sur source
 * officielle seulement (migration 0201). Direction et actionnariat se rendent
 * TOUJOURS : leur absence est dite (« Pas encore collecté »), jamais tue.
 */

const LIEN = 'rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const PROSE = 'max-w-[65ch] text-sm leading-relaxed text-ivory/90 [text-wrap:pretty]';

function Source({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LIEN}>
      {libelleSource(url)}
    </a>
  );
}

function Paire({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-1.5">
      <dt className="text-xs text-muted">{libelle}</dt>
      <dd className="min-w-0 [overflow-wrap:break-word] text-sm text-ivory/90">{children}</dd>
    </div>
  );
}

const dateLongue = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function ProfilPresentation({ profil }: { profil: Profil | null }) {
  return profil?.presentation ? <p className={PROSE}>{profil.presentation}</p> : null;
}

export function ProfilHistorique({ profil }: { profil: Profil | null }) {
  return profil?.historique ? <p className={PROSE}>{profil.historique}</p> : null;
}

export function ProfilListe({ items, ton }: { items: string[]; ton: 'fort' | 'doux' }) {
  if (items.length === 0) return null;
  return (
    <ul className={`space-y-1.5 text-sm ${ton === 'fort' ? 'text-ivory/90' : 'text-muted'}`}>
      {items.map((m) => (
        <li key={m} className="flex gap-2">
          <span aria-hidden className={`mt-2 h-px w-3 shrink-0 ${ton === 'fort' ? 'bg-border-strong' : 'bg-border'}`} />
          {m}
        </li>
      ))}
    </ul>
  );
}

/** Constats calculés par la page depuis NOS comptes et dividendes (lib/fiche/pointsCles). */
export function PointsCles({ points }: { points: string[] }) {
  if (points.length === 0) return null;
  return (
    <div>
      <ul className="space-y-1.5 text-sm text-ivory/90">
        {points.map((p) => (
          <li key={p} className="tabular-nums flex gap-2">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-accent" />
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-faint">Calculés à partir des comptes et des dividendes affichés sur cette fiche.</p>
    </div>
  );
}

export function ProfilDirection({ profil }: { profil: Profil | null }) {
  const dirigeants = profil?.dirigeants ?? [];
  if (dirigeants.length === 0) return <DonneeAbsente etat="non_collecte" />;
  return (
    <dl className="divide-y divide-border/60 rounded-card border border-border bg-surface px-4">
      {dirigeants.map((d) => (
        <div key={d.nom + d.fonction} className="py-2.5">
          <dt className="text-xs text-muted">{d.fonction}</dt>
          <dd className="text-sm text-ivory">{d.nom}</dd>
          <dd className="text-xs text-faint">
            {d.depuis && <>Depuis {d.depuis}, </>}source <Source url={d.source} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfilActionnariat({ profil }: { profil: Profil | null }) {
  const a = profil?.actionnariat ?? null;
  if (!a) return <DonneeAbsente etat="non_collecte" />;
  const somme = a.lignes.reduce((s, l) => s + l.pct, 0);
  const reste = Math.round((100 - somme) * 100) / 100;
  const pctMax = Math.max(a.lignes[0]?.pct ?? 0, reste);
  const lignes = [
    ...a.lignes.map((l, i) => ({ nom: l.nom, pct: l.pct, calcule: false, fort: i === 0 })),
    ...(reste >= 0.5 ? [{ nom: 'Flottant et autres (calculé)', pct: reste, calcule: true, fort: false }] : []),
  ];
  const fmt = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <ul className="space-y-2.5">
        {lignes.map((l) => (
          <li key={l.nom}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={`min-w-0 [overflow-wrap:break-word] ${l.calcule ? 'text-muted' : 'text-ivory/90'}`}>{l.nom}</span>
              <span className="tabular shrink-0 text-ivory">{fmt(l.pct)} %</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-border/60" aria-hidden>
              <div
                className={`h-full rounded-full [width:var(--part)] ${l.fort ? 'bg-accent' : l.calcule ? 'bg-border-strong' : 'bg-muted/50'}`}
                style={{ '--part': `${((l.pct / pctMax) * 100).toFixed(0)}%` } as React.CSSProperties}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-faint">
        Répartition au {a.date}, source <Source url={a.source} />.
        {reste >= 0.5 && <> La ligne « Flottant et autres » est le complément à 100 % des participations publiées.</>}
      </p>
    </div>
  );
}

export function ProfilIdentite({ profil }: { profil: Profil | null }) {
  const identite = profil?.identite ?? null;
  if (!identite) return null;
  return (
    <dl className="divide-y divide-border/60">
      {identite.raisonSociale && <Paire libelle="Raison sociale">{identite.raisonSociale}</Paire>}
      {identite.isin && <Paire libelle="Code ISIN"><span className="tabular">{identite.isin}</span></Paire>}
      {identite.introduction && <Paire libelle="Cotée depuis le">{dateLongue(identite.introduction)}</Paire>}
      {identite.capital && (
        <Paire libelle="Capital social">
          <span className="tabular">{identite.capital.montant.toLocaleString('fr-FR')} FCFA</span>
          <span className="block text-xs text-faint">nominal de {identite.capital.nominal.toLocaleString('fr-FR')} FCFA par action</span>
        </Paire>
      )}
      {identite.siege && <Paire libelle="Siège">{identite.siege}</Paire>}
      {identite.fractionnements.length > 0 && (
        <Paire libelle="Fractionnements">
          <ul className="space-y-1">
            {identite.fractionnements.map((f) => <li key={f.date}>{dateLongue(f.date)} : {f.parite}</li>)}
          </ul>
        </Paire>
      )}
    </dl>
  );
}

export function NoteSources({ profil }: { profil: Profil | null }) {
  if (!profil) return null;
  const { identite, siteWeb, verifieLe } = profil;
  return (
    <p className="text-xs text-faint">
      Dirigeants et actionnariat ne sont repris que de sources officielles (BRVM, société) ; profil vérifié le {fmtDateCourte(verifieLe)}.
      {identite && <> Identité : fiche de la société sur le site de la BRVM ; le capital n&apos;est affiché que s&apos;il concorde avec le nombre d&apos;actions en circulation.</>}
      {siteWeb && <> Site de la société : <a href={siteWeb} target="_blank" rel="noopener noreferrer" className={LIEN}>{libelleSource(siteWeb)}</a>.</>}
    </p>
  );
}
