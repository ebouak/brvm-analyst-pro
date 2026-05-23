import Link from 'next/link';

export interface DividendYield {
  code: string;
  designation: string | null;
  montant: number;
  cours: number | null;
  rendementPct: number | null;
}

export default function YieldComparison({
  avgBondYtm,
  dividendYields,
}: {
  avgBondYtm: number | null;
  dividendYields: DividendYield[];
}) {
  const top = dividendYields
    .filter((d) => d.rendementPct != null)
    .sort((a, b) => (b.rendementPct ?? 0) - (a.rendementPct ?? 0))
    .slice(0, 8);

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">Comparatif rendements : obligations vs dividendes actions</h3>
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div>
          <div className="text-xs text-muted">YTM obligataire moyen</div>
          <div className="tabular text-xl text-up">{avgBondYtm != null ? avgBondYtm.toFixed(2) + '%' : '—'}</div>
        </div>
        <div className="text-muted text-xs">
          Rendement dividende = dernier dividende connu / cours actuel.
        </div>
      </div>
      {top.length === 0 ? (
        <p className="text-xs text-muted">
          Aucun dividende ingéré. Lancez <code className="text-up">npm run dividends:mock</code> (ou <code className="text-up">dividends</code>) côté scraper.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border">
            <tr>
              <th className="px-2 py-1.5 text-left">Action</th>
              <th className="px-2 py-1.5 text-right">Dividende</th>
              <th className="px-2 py-1.5 text-right">Cours</th>
              <th className="px-2 py-1.5 text-right">Rendement</th>
              <th className="px-2 py-1.5 text-right">vs YTM moy.</th>
            </tr>
          </thead>
          <tbody>
            {top.map((d) => {
              const spread = avgBondYtm != null && d.rendementPct != null ? d.rendementPct - avgBondYtm : null;
              return (
                <tr key={d.code} className="border-b border-border/40">
                  <td className="px-2 py-1.5">
                    <Link href={`/actions/${d.code}`} className="hover:text-up">{d.code}</Link>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular">{d.montant.toLocaleString('fr-FR')}</td>
                  <td className="px-2 py-1.5 text-right tabular">{d.cours != null ? d.cours.toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular text-up">{d.rendementPct != null ? d.rendementPct.toFixed(2) + '%' : '—'}</td>
                  <td className={`px-2 py-1.5 text-right tabular ${spread == null ? 'text-muted' : spread >= 0 ? 'text-up' : 'text-down'}`}>
                    {spread != null ? (spread >= 0 ? '+' : '') + spread.toFixed(2) + ' pts' : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
