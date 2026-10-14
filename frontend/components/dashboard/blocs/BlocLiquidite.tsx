import Link from 'next/link';
import { fmtFcfa, fmtNumber, fmtDateFR } from '@/lib/format';
import { PARTICIPATION_VOLUME, SEUIL_ALERTE_SEANCES } from '@/lib/dashboard/liquidite';
import { lignesLiquiditePositions, extremesLiquidite, fourchetteTexte, type LiquiditeSource } from '@/lib/dashboard/liquiditeBloc';
import { CadreBloc, EtatVide, Indisponible } from './Cadre';

/**
 * Spec §4.3. Actif : ses positions, durée THÉORIQUE INDICATIVE. Débutant :
 * les valeurs les plus faciles et les plus difficiles à échanger.
 */
export default function BlocLiquidite({
  donnees, positions, dateSeance,
}: {
  donnees: { dateMarche: string; lignes: LiquiditeSource[] } | null;
  positions: { code: string; valeur: number | null }[];
  dateSeance: string;
}) {
  const ancienne = donnees != null && donnees.dateMarche !== '' && donnees.dateMarche < dateSeance;
  return (
    <CadreBloc
      id="bloc-liquidite"
      titre={positions.length > 0 ? 'Liquidité de mes positions' : 'Liquidité du marché'}
      dateReference={donnees?.dateMarche || null}
      ancienne={ancienne}
      lien={{ href: '/liquidite', label: 'Méthode et classement' }}
    >
      {donnees === null ? (
        <Indisponible />
      ) : donnees.lignes.length === 0 ? (
        <EtatVide message="Liquidité non mesurée pour le moment." />
      ) : positions.length > 0 ? (
        <Positions donnees={donnees} positions={positions} />
      ) : (
        <Marche lignes={donnees.lignes} />
      )}
    </CadreBloc>
  );
}

function Positions({ donnees, positions }: { donnees: { dateMarche: string; lignes: LiquiditeSource[] }; positions: { code: string; valeur: number | null }[] }) {
  const lignes = lignesLiquiditePositions(positions, donnees.lignes);
  return (
    <>
      <div className="-mx-1 overflow-x-auto">
        <table aria-labelledby="bloc-liquidite" className="w-full min-w-[30rem] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-faint">
            <tr className="border-b border-border">
              <th scope="col" className="px-1 py-2 text-left font-medium">Valeur</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Position</th>
              <th scope="col" className="px-1 py-2 text-center font-medium">Classe</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Fourchette</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Échanges moy. 30 j</th>
              <th scope="col" className="px-1 py-2 text-right font-medium">Durée théorique</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.code} className="border-b border-border/40 last:border-0">
                <th scope="row" className="px-1 py-2 text-left font-normal"><Link href={`/actions/${l.code}`} className="font-semibold text-ivory hover:text-accent-ink">{l.code}</Link></th>
                <td className="tabular px-1 py-2 text-right text-muted">{l.valeurPosition != null ? fmtFcfa(l.valeurPosition) : '—'}</td>
                {l.mesuree ? (
                  <>
                    <td className="px-1 py-2 text-center text-ivory">{l.classe ?? '—'}</td>
                    <td className="tabular px-1 py-2 text-right text-muted">{l.fourchette ?? '—'}</td>
                    <td className="tabular px-1 py-2 text-right text-muted">{l.valeurMoyenne30j != null ? fmtFcfa(l.valeurMoyenne30j) : '—'}</td>
                    <td className="tabular px-1 py-2 text-right">
                      {l.duree.seances == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={l.duree.alerte ? 'rounded-full border border-warn/50 px-2 py-0.5 text-warn' : 'text-ivory'}>
                          {fmtNumber(l.duree.seances, 0)} séance{l.duree.seances > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className="px-1 py-2 text-right text-xs text-muted">Liquidité non mesurée pour cette valeur.</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-faint">
        Durée théorique indicative, en supposant que vos ventes représentent {fmtNumber(PARTICIPATION_VOLUME * 100, 0)} % des échanges
        quotidiens moyens (30 séances au {fmtDateFR(donnees.dateMarche)}). Au-delà de {SEUIL_ALERTE_SEANCES} séances, la ligne est signalée.
        Ce n&apos;est pas une garantie d&apos;exécution.{lignes.some((l) => l.fourchette?.startsWith('≈')) && ' « ≈ » : fourchette estimée faute de carnet publié.'}
      </p>
    </>
  );
}

function Marche({ lignes }: { lignes: LiquiditeSource[] }) {
  const { faciles, difficiles } = extremesLiquidite(lignes, 5);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ListeExtremes titre="Les plus faciles à échanger" items={faciles} />
        <ListeExtremes titre="Les plus difficiles à échanger" items={difficiles} />
      </div>
      <p className="mt-3 text-[11px] leading-snug text-faint">
        La fourchette est l&apos;écart entre le meilleur prix d&apos;achat et le meilleur prix de vente : plus elle est étroite, moins il en
        coûte d&apos;entrer ou de sortir. Une valeur peu échangée peut être difficile à vendre au prix affiché.
      </p>
    </>
  );
}

function ListeExtremes({ titre, items }: { titre: string; items: LiquiditeSource[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold text-muted">{titre}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted">Aucune valeur notée.</p>
      ) : (
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r.code} className="flex items-baseline justify-between gap-2 text-sm">
            <Link href={`/actions/${r.code}`} className="font-semibold text-ivory hover:text-accent-ink">{r.code}</Link>
            <span className="tabular min-w-0 text-xs text-muted">
              classe {r.classe ?? '—'} · fourchette {fourchetteTexte(r.spread_pct, r.spread_source) ?? 'non mesurée'}
            </span>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
