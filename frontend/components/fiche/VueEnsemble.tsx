import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtNumber } from '@/lib/format';
import { nombreFr } from '@/lib/fiche/affichage';
import { montantFcfa, type LigneStat, type PointAnnuel } from '@/lib/fiche/overview';
import type { GroupesActualites } from '@/lib/fiche/overviewActualites';
import type { SeriePeriode, Periode } from '@/lib/fiche/overviewSeries';
import { CoursPeriodes } from './CoursPeriodes';
import { ActualitesValeur } from './ActualitesValeur';

export interface APropos {
  nom: string;
  code: string;
  secteur: string | null;
  pays: string | null;
  famille: string | null;
  titres: number | null;
  flottant: number | null;
  flottantPct: number | null;
  notation: { agence: string; note: string; perspective: string | null } | null;
  historiqueDepuis: string | null;
}

export interface Synthese {
  note: string | null;
  signal: string | null;
  /** Faux quand note et signal sont réservés aux abonnés. */
  signalVisible: boolean;
  combinedAlpha: number | null;
}

/**
 * Vue d'ensemble de la fiche action : statistiques clés, cours par période et
 * actualités de la valeur à gauche ; société, performance financière et
 * synthèse WESTBOURSE à droite. Mobile : une colonne, dans cet ordre-là.
 */
export function VueEnsemble({
  code,
  lignes,
  series,
  jour,
  variationJour,
  periodeDefaut,
  actualites,
  apropos,
  performance,
  synthese,
}: {
  code: string;
  lignes: LigneStat[];
  series: SeriePeriode[];
  jour: ReactNode | null;
  variationJour: number | null;
  periodeDefaut: '1J' | Periode;
  actualites: GroupesActualites;
  apropos: APropos;
  /** null : analyse fondamentale verrouillée. */
  performance: { phrase: string | null; serie: PointAnnuel[] } | null;
  synthese: Synthese;
}) {
  const moitie = Math.ceil(lignes.length / 2);
  const colonnes = [lignes.slice(0, moitie), lignes.slice(moitie)];

  return (
    <section id="vue-ensemble" aria-label="Vue d'ensemble" className="scroll-mt-24 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Gauche, en haut : statistiques puis cours */}
      <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
        {lignes.length > 0 ? (
          <div className="grid gap-x-6 rounded-card border border-border bg-surface px-4 py-2 md:grid-cols-2 md:px-5">
            {colonnes.map((col, k) => (
              <dl key={k} className="divide-y divide-border/40">
                {col.map((l) => (
                  <div key={l.cle} className="flex items-baseline justify-between gap-3 py-2">
                    <dt className="text-xs text-muted">{l.libelle}</dt>
                    <dd className="min-w-0 text-right">
                      <span className="tabular text-sm text-ivory">{l.valeur}</span>
                      {l.complement && <span className="block text-[11px] text-faint">{l.complement}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface px-5 py-6">
            <p className="text-xs text-faint">Aucune statistique disponible pour cette valeur.</p>
          </div>
        )}
        <CoursPeriodes series={series} jour={jour} variationJour={variationJour} defaut={periodeDefaut} />
      </div>

      {/* Droite : la société */}
      <aside className="min-w-0 space-y-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <AProposBloc a={apropos} />
        <PerformanceBloc code={code} nom={apropos.nom} performance={performance} />
        <SyntheseBloc code={code} s={synthese} />
      </aside>

      {/* Gauche, en bas : actualités de la valeur */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <ActualitesValeur groupes={actualites} nom={apropos.nom} />
      </div>
    </section>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-muted">{libelle}</dt>
      <dd className="min-w-0 text-right text-xs text-ivory">{children}</dd>
    </div>
  );
}

function AProposBloc({ a }: { a: APropos }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-ivory">À propos de {a.nom}</h3>
      <dl className="mt-2 divide-y divide-border/40">
        <Ligne libelle="Désignation">{a.nom}</Ligne>
        <Ligne libelle="Code">{a.code}</Ligne>
        <Ligne libelle="Place de cotation">BRVM</Ligne>
        {a.secteur && <Ligne libelle="Secteur">{a.secteur}</Ligne>}
        {a.pays && <Ligne libelle="Pays">{a.pays}</Ligne>}
        {a.famille && <Ligne libelle="Famille comptable">{a.famille}</Ligne>}
        {a.titres != null && <Ligne libelle="Titres"><span className="tabular">{fmtNumber(a.titres)}</span></Ligne>}
        {a.flottant != null && (
          <Ligne libelle="Flottant">
            <span className="tabular">{fmtNumber(a.flottant)}</span>
            {a.flottantPct != null && <span className="tabular text-faint"> ({nombreFr(a.flottantPct, 1)} %)</span>}
          </Ligne>
        )}
        {a.notation && (
          <Ligne libelle="Notation financière">
            {a.notation.agence} · <span className="tabular">{a.notation.note}</span>
            {a.notation.perspective && <span className="text-faint">, perspective {a.notation.perspective.toLowerCase()}</span>}
          </Ligne>
        )}
      </dl>
      {a.historiqueDepuis && (
        <p className="mt-2 text-[11px] text-faint">Historique de cours disponible depuis le {a.historiqueDepuis}</p>
      )}
      <Link href={`/societes/${a.code}`} className="mt-3 inline-flex min-h-[36px] items-center text-xs text-accent-ink hover:underline">
        Profil complet →
      </Link>
    </div>
  );
}

function PerformanceBloc({ code, nom, performance }: { code: string; nom: string; performance: { phrase: string | null; serie: PointAnnuel[] } | null }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-ivory">Performance financière</h3>
      {performance == null ? (
        <p className="mt-2 text-xs text-muted">Les comptes publiés et leur lecture sont réservés aux abonnés.</p>
      ) : performance.serie.length === 0 && !performance.phrase ? (
        <p className="mt-2 text-xs text-faint">Aucun compte publié en base pour {nom}.</p>
      ) : (
        <>
          {performance.phrase && <p className="mt-2 text-[13px] leading-relaxed text-muted">{performance.phrase}</p>}
          {performance.serie.length >= 2 && <Barres serie={performance.serie} />}
        </>
      )}
      <Link
        href={`/actions/${code}/financials`}
        className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-border px-3 text-xs text-ivory transition-colors hover:border-accent hover:text-accent-ink"
      >
        États financiers
      </Link>
    </div>
  );
}

/** CA et résultat net par exercice : barres groupées, ligne de zéro, jetons du thème. */
function Barres({ serie }: { serie: PointAnnuel[] }) {
  const W = 280, H = 120;
  const valeurs = serie.flatMap((p) => [p.chiffreAffaires, p.resultatNet]).filter((v): v is number => v != null);
  const haut = Math.max(0, ...valeurs), bas = Math.min(0, ...valeurs);
  const etendue = haut - bas || 1;
  const y = (v: number) => ((haut - v) / etendue) * H;
  const zero = y(0);
  const pas = W / serie.length, larg = Math.min(16, pas * 0.3);
  const barre = (v: number | null, cx: number, fill: string, titre: string) =>
    v == null ? null : (
      <rect x={cx} y={Math.min(y(v), zero)} width={larg} height={Math.max(1, Math.abs(y(v) - zero))} style={{ fill }}>
        <title>{titre}</title>
      </rect>
    );
  const resume = serie
    .map((p) => `${p.exercice} : chiffre d'affaires ${p.chiffreAffaires != null ? montantFcfa(p.chiffreAffaires) : 'non publié'}, résultat net ${p.resultatNet != null ? montantFcfa(p.resultatNet) : 'non publié'}`)
    .join(' ; ');
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[120px] w-full" role="img" aria-label={resume}>
        <line x1={0} x2={W} y1={zero} y2={zero} strokeWidth={1} style={{ stroke: 'rgb(var(--color-border-strong))' }} />
        {serie.map((p, i) => {
          const centre = i * pas + pas / 2;
          return (
            <g key={p.exercice}>
              {barre(p.chiffreAffaires, centre - larg - 1, 'rgb(var(--color-accent))', `${p.exercice} · chiffre d'affaires ${p.chiffreAffaires != null ? montantFcfa(p.chiffreAffaires) : ''}`)}
              {barre(p.resultatNet, centre + 1, 'rgb(var(--color-faint))', `${p.exercice} · résultat net ${p.resultatNet != null ? montantFcfa(p.resultatNet) : ''}`)}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${serie.length}, minmax(0, 1fr))` }}>
        {serie.map((p) => <span key={p.exercice} className="tabular text-center text-[11px] text-faint">{p.exercice}</span>)}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-sm bg-accent" />Chiffre d&apos;affaires</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-sm bg-faint" />Résultat net</span>
      </figcaption>
    </figure>
  );
}

function SyntheseBloc({ code, s }: { code: string; s: Synthese }) {
  const rien = !s.signalVisible && s.combinedAlpha == null;
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <h3 className="text-base font-semibold text-ivory">Synthèse WESTBOURSE</h3>
      {rien ? (
        <p className="mt-2 text-xs text-muted">Note technique, signal et Combined Alpha sont réservés aux abonnés.</p>
      ) : (
        <dl className="mt-2 divide-y divide-border/40">
          {s.signalVisible && <Ligne libelle="Note technique">{s.note ? <span className="tabular">{s.note}</span> : <span className="text-faint">non notée</span>}</Ligne>}
          {s.signalVisible && <Ligne libelle="Signal">{s.signal ?? <span className="text-faint">non calculé</span>}</Ligne>}
          <Ligne libelle="Combined Alpha">
            {s.combinedAlpha != null ? <span className="tabular">{Math.round(s.combinedAlpha)}/100</span> : <span className="text-faint">non calculé</span>}
          </Ligne>
        </dl>
      )}
      {!s.signalVisible && !rien && <p className="mt-2 text-[11px] text-faint">Note technique et signal réservés aux abonnés.</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <a href="#titre" className="inline-flex min-h-[36px] items-center text-accent-ink hover:underline">Lecture technique →</a>
        <Link href={`/actions/${code}/quant`} className="inline-flex min-h-[36px] items-center text-accent-ink hover:underline">Fiche Quant →</Link>
      </div>
      <p className="mt-1 text-[11px] text-faint">Constats calculés sur les données en base, pas un conseil d&apos;investissement.</p>
    </div>
  );
}
