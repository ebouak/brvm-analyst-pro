import type { ReactNode } from 'react';
import { fmtNumber } from '@/lib/format';
import { nombreFr } from '@/lib/fiche/affichage';
import type { LigneStat } from '@/lib/fiche/overview';
import type { SeriePeriode, Periode } from '@/lib/fiche/overviewSeries';
import { CoursPeriodes } from './CoursPeriodes';

/**
 * Blocs de l'ancienne « Vue d'ensemble », répartis par la fiche en note d'analyse
 * (spec v2 § 5.1) : `StatsEtCours` ouvre la Synthèse, `AProposBloc` complète
 * l'Identité dans la rubrique Société. La performance financière et la synthèse
 * WESTBOURSE, qui répétaient les Résultats et « Ce que disent nos indicateurs »,
 * ne sont plus rendues ici.
 */

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

/** Statistiques clés puis cours par période. */
export function StatsEtCours({
  lignes,
  series,
  jour,
  variationJour,
  periodeDefaut,
}: {
  lignes: LigneStat[];
  series: SeriePeriode[];
  jour: ReactNode | null;
  variationJour: number | null;
  periodeDefaut: '1J' | Periode;
}) {
  const moitie = Math.ceil(lignes.length / 2);
  const colonnes = [lignes.slice(0, moitie), lignes.slice(moitie)];

  return (
    <div className="min-w-0 space-y-5">
      {lignes.length > 0 ? (
        <div className="grid gap-x-6 rounded-card border border-border bg-surface px-4 py-2 md:grid-cols-2 md:px-5">
          {colonnes.map((col, k) => (
            <dl key={k} className="divide-y divide-border/40">
              {col.map((l) => (
                <div key={l.cle} className="flex items-baseline justify-between gap-3 py-2">
                  <dt className="text-xs text-muted">{l.libelle}</dt>
                  <dd className="min-w-0 text-right">
                    <span className={`text-sm text-ivory ${/\d/.test(l.valeur) ? 'tabular' : ''}`}>{l.valeur}</span>
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

/** Le titre en chiffres de référentiel : désignation, place, secteur, titres, flottant. */
export function AProposBloc({ a }: { a: APropos }) {
  return (
    <div>
      <dl className="divide-y divide-border/40">
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
            {a.notation.agence}, <span className="tabular">{a.notation.note}</span>
            {a.notation.perspective && <span className="text-faint">, perspective {a.notation.perspective.toLowerCase()}</span>}
          </Ligne>
        )}
      </dl>
      {a.historiqueDepuis && (
        <p className="mt-2 text-[11px] text-faint">Historique de cours disponible depuis le {a.historiqueDepuis}</p>
      )}
    </div>
  );
}
