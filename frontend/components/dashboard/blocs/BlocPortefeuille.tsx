import Link from 'next/link';
import type { ReactNode } from 'react';
import { fmtDateFR, fmtFcfa, fmtFcfaSigne, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { PortfolioState } from '@/lib/portfolio/derive';
import type { ResultatPerfJour } from '@/lib/dashboard/performanceJour';
import { contributions, syntheseValorisee, secteursValorises, echantillonner } from '@/lib/dashboard/portefeuilleBloc';
import { CadreBloc, EtatVide, Indisponible } from './Cadre';
import CourbeValeur from './CourbeValeur';

const sens = (v: number | null | undefined) => (v == null ? 'text-ivory' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-ivory');

const INVITATION = [
  { href: '/portefeuille', label: 'Créer mon portefeuille' },
  { href: '/portefeuille/import', label: 'Importer un relevé' },
  { href: '/actions', label: 'Suivre des valeurs' },
];

/**
 * Spec §4.5. `etat` : `undefined` = visiteur, `null` = lecture en erreur.
 * Aucun bouton « Vendre » : la plateforme ne passe pas d'ordres (spec §9).
 */
export default function BlocPortefeuille({
  etat, perf, variations, debutCourbe,
}: {
  etat: PortfolioState | null | undefined;
  debutCourbe: string | null;
  perf: ResultatPerfJour | null;
  variations: ReadonlyMap<string, number | null>;
}) {
  const titres = etat?.positions.filter((p) => !p.isLiquidites) ?? [];
  if (etat === null) {
    return <CadreBloc id="bloc-portefeuille" titre="Mon portefeuille" dateReference={null}><Indisponible /></CadreBloc>;
  }
  if (etat === undefined || titres.length === 0) {
    return (
      <CadreBloc id="bloc-portefeuille" titre="Mon portefeuille" dateReference={null} sansDate>
        <EtatVide message="Vous ne suivez encore aucune position." actions={INVITATION} />
      </CadreBloc>
    );
  }

  const synth = syntheseValorisee(etat.positions);
  const secteurs = secteursValorises(etat.positions);
  const contrib = contributions(etat.positions);
  const pnlPct = synth.pnlPct != null ? synth.pnlPct * 100 : null;
  const rienDeValorise = synth.valeur === 0 && synth.investi === 0;
  const listeExclus = synth.exclus.join(', ');

  return (
    <CadreBloc
      id="bloc-portefeuille"
      titre="Mon portefeuille"
      dateReference={perf?.dateMarche ?? etat.lastDate}
      legendeDate="Séance du"
      lien={{ href: '/portefeuille', label: 'Détail' }}
    >
      {synth.exclus.length > 0 && (
        <p className="mb-3 rounded-lg border border-warn/40 bg-warn/[0.06] px-3 py-2 text-xs text-warn">
          Aucun cours sur les 12 derniers mois pour {listeExclus} : position exclue des totaux.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre
          libelle={synth.exclus.length > 0 ? `Valeur (hors ${listeExclus})` : 'Valeur'}
          valeur={rienDeValorise ? '—' : `${fmtFcfa(synth.valeur)} FCFA`}
        />
        <Chiffre
          libelle="Plus-value latente"
          valeur={synth.investi === 0 ? '—' : `${fmtFcfaSigne(synth.pnl)} FCFA`}
          detail={synth.investi !== 0 && pnlPct != null ? fmtPctSigne(pnlPct, 1) : null}
          classe={sens(synth.pnl)}
        />
        <Chiffre
          libelle="Variation du jour"
          valeur={perf?.variationFcfa != null ? `${fmtFcfaSigne(perf.variationFcfa)} FCFA` : '—'}
          detail={
            perf?.portefeuillePct != null ? (
              <>
                {fmtPctSigne(perf.portefeuillePct)}
                <span className="text-muted">
                  {' · '}
                  {perf.comparable && perf.indicePct != null
                    ? `BRVM Composite ${fmtPctSigne(perf.indicePct)}`
                    : `indice non comparable (${perf.raison ?? 'indisponible'})`}
                </span>
              </>
            ) : (
              <span className="text-muted">{perf?.raison ?? 'non calculée'}</span>
            )
          }
          classe={sens(perf?.portefeuillePct)}
        />
      </div>

      <div className="mt-5">
        <CourbeValeur points={echantillonner(etat.equityCurve)} />
        <p className="mt-1 text-[11px] text-faint">
          Courbe sur la période depuis le {debutCourbe ? fmtDateFR(debutCourbe) : 'début de l’historique'} (au plus 12 mois). Trait plein : valeur au cours du
          marché · pointillés : capital investi. Suppose une détention continue depuis la date d&apos;entrée de chaque position.
          Historique complet sur la page Portefeuille.
        </p>
      </div>

      <div className="-mx-1 mt-5 overflow-x-auto" role="region" tabIndex={0} aria-label="Positions du portefeuille">
        <table className="w-full min-w-[36rem] text-sm" aria-labelledby="bloc-portefeuille">
          <thead className="text-[11px] uppercase tracking-wide text-faint">
            <tr className="border-b border-border">
              <th scope="col" className="px-1 py-2 text-left font-medium">Valeur</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Montant</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Cours</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Var. jour</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Poids</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">PRU</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Plus-value latente</th>
            </tr>
          </thead>
          <tbody>
            {etat.positions.map((p, i) => {
              const v = p.isLiquidites ? null : variations.get(p.code.trim().toUpperCase()) ?? null;
              const sansCours = !p.isLiquidites && !(p.cours > 0);
              return (
                <tr key={`${p.code}-${i}`} className="border-b border-border/40 last:border-0">
                  <th scope="row" className="px-1 py-2 text-left font-normal">
                    {p.isLiquidites ? <span className="text-muted">Liquidités</span> : (
                      <Link href={`/actions/${p.code}`} className="font-semibold text-ivory hover:text-accent-ink">{p.code}</Link>
                    )}
                  </th>
                  <td className="tabular px-1 py-2 text-right text-ivory">{sansCours ? '—' : fmtFcfa(p.valeur)}</td>
                  <td className="tabular px-1 py-2 text-right text-muted">{p.isLiquidites || sansCours ? '—' : fmtNumber(p.cours, 0)}</td>
                  <td className={`tabular px-1 py-2 text-right ${sens(v)}`}>{v != null ? fmtPctSigne(v) : '—'}</td>
                  <td className="tabular px-1 py-2 text-right text-muted">{sansCours ? '—' : `${fmtNumber(p.poids * 100, 1)} %`}</td>
                  <td className="tabular px-1 py-2 text-right text-muted">{p.isLiquidites ? '—' : fmtNumber(p.pru, 0)}</td>
                  <td className={`tabular px-1 py-2 text-right ${sens(p.pnl)}`}>
                    {p.isLiquidites || sansCours ? '—' : `${fmtFcfaSigne(p.pnl)}${p.pnlPct != null ? ` (${fmtPctSigne(p.pnlPct * 100, 1)})` : ''}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-muted">Répartition par secteur</p>
          <ul className="space-y-2">
            {secteurs.map((s) => (
              <li key={s.secteur}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">{s.secteur}</span>
                  <span className="tabular text-ivory">{fmtNumber(s.poids * 100, 1)} %</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-accent/60" style={{ width: `${Math.max(0, Math.min(100, s.poids * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-muted">Contribution à la plus-value latente</p>
          <ul className="space-y-1.5">
            {contrib.map((c, i) => (
              <li key={`${c.code}-${i}`} className="grid grid-cols-[3.5rem_1fr_1fr_5.5rem] items-center gap-1 text-xs">
                <span className="font-semibold text-ivory">{c.code}</span>
                <span className="flex justify-end">{c.pnl < 0 && <span className="h-2 rounded-l bg-down/70" style={{ width: `${c.largeur * 100}%` }} />}</span>
                <span className="flex">{c.pnl > 0 && <span className="h-2 rounded-r bg-up/70" style={{ width: `${c.largeur * 100}%` }} />}</span>
                <span className={`tabular text-right ${sens(c.pnl)}`}>{fmtFcfaSigne(c.pnl)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CadreBloc>
  );
}

function Chiffre({ libelle, valeur, detail, classe = 'text-ivory' }: { libelle: string; valeur: string; detail?: ReactNode; classe?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-bg/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-faint">{libelle}</p>
      <p className={`tabular mt-1 text-xl font-semibold ${classe}`}>{valeur}</p>
      {detail != null && <p className={`tabular mt-0.5 text-xs ${classe}`}>{detail}</p>}
    </div>
  );
}
