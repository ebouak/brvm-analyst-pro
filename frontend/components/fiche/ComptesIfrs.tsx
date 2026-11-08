import { fmtDateCourte } from '@/lib/format';
import type { ComparatifIfrs } from '@/lib/fiche/comptesIfrs';

/**
 * Comptes IFRS publiés aussi par la société, à côté des comptes SYSCOHADA.
 * Les ratios principaux de la page restent SYSCOHADA ; ce tableau les met en
 * regard, sans les remplacer.
 */
export default function ComptesIfrs({ c }: { c: ComparatifIfrs }) {
  return (
    <div className="mt-4 rounded-card border border-border bg-surface p-4">
      <h3 className="mb-1 text-sm font-medium">Comptes IFRS (publiés aussi par la société)</h3>
      <p className="mb-3 text-xs text-muted">
        Exercice {c.exercice}. Les ratios de la page sont calculés sur les comptes SYSCOHADA ; les deux référentiels ne se mélangent pas.
        {c.surPartDuGroupe && ' BPA et ROE IFRS sur la part du groupe.'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3 text-left font-normal">Poste</th>
              <th scope="col" className="px-3 py-2 text-right font-normal">SYSCOHADA</th>
              <th scope="col" className="py-2 pl-3 text-right font-normal">IFRS</th>
            </tr>
          </thead>
          <tbody>
            {c.lignes.map((l) => (
              <tr key={l.libelle} className="border-b border-border/40 last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-muted">{l.libelle}</th>
                <td className="tabular px-3 py-2 text-right">{l.syscohada}</td>
                <td className="tabular py-2 pl-3 text-right">{l.ifrs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-faint">
        Source :{' '}
        <a href={c.source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {c.source.titre ?? 'états financiers IFRS (PDF)'}
        </a>
        , vérifié le {fmtDateCourte(c.source.verifieLe)}.
      </p>
      {c.sika && <p className="mt-1 text-xs text-faint">{c.sika}</p>}
    </div>
  );
}
