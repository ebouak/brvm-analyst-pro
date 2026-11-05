import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtDateFR, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { ExtremesSecteurs, LargeurSeance } from '@/lib/marche/marcheDuJour';
import type { RendementObligataire } from '@/lib/marche/chargement';
import { CadreBloc } from './Cadre';

const sens = (v: number) => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-ivory');

/**
 * « Le marché aujourd'hui » : trois portes chiffrées vers Secteurs, Heatmap et
 * Obligations (composant serveur, aucun état). Chaque chiffre est celui de la
 * page de destination (voir lib/marche/marcheDuJour.ts). Une donnée absente
 * est dite telle quelle : la porte reste ouverte, sans chiffre inventé.
 */
export default function BlocMarcheDuJour({
  dateMarche, secteurs, largeur, obligations,
}: {
  dateMarche: string;
  secteurs: ExtremesSecteurs | null;
  largeur: LargeurSeance | null;
  obligations: RendementObligataire | null;
}) {
  const total = largeur ? largeur.hausses + largeur.baisses + largeur.stables : 0;
  return (
    <CadreBloc id="bloc-marche-du-jour" titre="Le marché aujourd’hui" dateReference={dateMarche} legendeDate="Séance du">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Porte href="/secteurs" rubrique="Secteurs" action="Classement des secteurs">
          {secteurs ? (
            <dl className="space-y-1.5 text-sm">
              <Extreme libelle="Meilleur" secteur={secteurs.meilleur.secteur} variation={secteurs.meilleur.variation} />
              <Extreme libelle="Pire" secteur={secteurs.pire.secteur} variation={secteurs.pire.variation} />
            </dl>
          ) : (
            <Absent>Variation sectorielle indisponible pour cette séance.</Absent>
          )}
          {secteurs && <p className="mt-1.5 text-[11px] text-faint">Variation moyenne du jour, {secteurs.nbSecteurs} secteurs</p>}
        </Porte>

        <Porte href="/heatmap" rubrique="Heatmap" action="Voir la carte du marché">
          {largeur ? (
            <>
              <p className="tabular text-sm">
                <span className="font-semibold text-up">{largeur.hausses}</span>
                <span className="text-muted"> hausse{largeur.hausses > 1 ? 's' : ''} · </span>
                <span className="font-semibold text-down">{largeur.baisses}</span>
                <span className="text-muted"> baisse{largeur.baisses > 1 ? 's' : ''} · </span>
                <span className="font-semibold text-ivory">{largeur.stables}</span>
                <span className="text-muted"> stable{largeur.stables > 1 ? 's' : ''}</span>
              </p>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                <span className="h-full bg-up/70" style={{ width: `${(largeur.hausses / total) * 100}%` }} />
                <span className="h-full bg-border-strong" style={{ width: `${(largeur.stables / total) * 100}%` }} />
                <span className="h-full bg-down/70" style={{ width: `${(largeur.baisses / total) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-faint">{total} valeurs à variation connue</p>
            </>
          ) : (
            <Absent>Variations de la séance indisponibles.</Absent>
          )}
        </Porte>

        <Porte href="/obligations" rubrique="Obligations" action="Marché obligataire">
          {obligations ? (
            <>
              <p className="text-sm">
                <span className="text-muted">Rendement moyen (YTM) </span>
                <span className="tabular font-semibold text-ivory">{fmtNumber(obligations.ytmMoyen, 2)} %</span>
              </p>
              <p className="mt-1.5 text-[11px] text-faint">
                Moyenne sur <span className="tabular">{obligations.nbAvecYtm}</span> des{' '}
                <span className="tabular">{obligations.nbActives}</span> obligations actives (YTM calculable)
                {obligations.dateMarche !== dateMarche && (
                  <span className="text-warn"> · séance du {fmtDateFR(obligations.dateMarche)}</span>
                )}
              </p>
            </>
          ) : (
            <Absent>Rendement obligataire indisponible.</Absent>
          )}
        </Porte>
      </ul>
    </CadreBloc>
  );
}

function Porte({ href, rubrique, action, children }: { href: string; rubrique: string; action: string; children: ReactNode }) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        className="group flex h-full min-h-[44px] flex-col rounded-xl border border-border/60 bg-bg/40 p-3 transition-colors hover:border-accent/40 hover:bg-accent/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="text-[11px] text-faint">{rubrique}</span>
        <div className="mt-1.5 flex-1">{children}</div>
        <span className="mt-2 text-xs font-semibold text-accent-ink group-hover:underline">
          {action} <span aria-hidden>→</span>
        </span>
      </Link>
    </li>
  );
}

function Extreme({ libelle, secteur, variation }: { libelle: string; secteur: string; variation: number }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <dt className="shrink-0 text-xs text-muted">{libelle}</dt>
      <dd className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-ivory" title={secteur}>{secteur}</span>
        {/* Même arrondi que /secteurs (toFixed sur la valeur binaire) : sans lui,
            −0,855 s'affichait −0,86 ici et −0,85 là-bas pour le même secteur. */}
        <span className={`tabular shrink-0 font-semibold ${sens(variation)}`}>{fmtPctSigne(Number(variation.toFixed(2)))}</span>
      </dd>
    </div>
  );
}

function Absent({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
