import { fmtNumber, fmtPctSigne, fmtDateFR } from '@/lib/format';
import type { IndiceAfricain } from '@/lib/dashboard/chargement';
import { TeteBloc } from './Grille';

const PLACE: Record<string, string> = { NGXASI: 'NGX All-Share · Nigeria', NSENASI: 'NSE All-Share · Kenya', GSECI: 'GSE Composite · Ghana' };
const JOUR = 86_400_000;
const ton = (v: number | null) => (v == null ? 'text-faint' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');

/** Spec §12 — Afrique · vue régionale ; une donnée ancienne est signalée DANS LA FORME. */
export default function Afrique({ indices, composite, dateSeance }: {
  indices: IndiceAfricain[] | null; composite: { valeur: number | null; variation: number | null }; dateSeance: string;
}) {
  const ageDe = (d: string) => Math.round((Date.parse(`${dateSeance}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / JOUR);
  const perimee = (d: string) => ageDe(d) > 7;
  const datesPerimees = (indices ?? []).map((a) => a.date_marche).filter(perimee).sort();
  const plusAncienne = datesPerimees[0] ?? null;
  const age = plusAncienne ? ageDe(plusAncienne) : null;
  return (
    <section aria-label="Indices pan-africains" className="py-5 lg:px-5">
      <TeteBloc id="t-afr" titre="Afrique · vue régionale" droite={<span className="overline text-faint">Source AFX</span>} />
      {plusAncienne && age != null && (
        <p className="mb-2.5 inline-flex rounded-md border border-warn/45 bg-warn/[0.09] px-2 py-1 text-[11.5px] text-warn">
          Source indisponible : données du {fmtDateFR(plusAncienne)}, il y a {age} jour{age > 1 ? 's' : ''}
        </p>
      )}
      <ul className="text-[13px]">
        <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 py-2">
          <span className="min-w-0">BRVM Composite · UEMOA<small className="block text-[11px] text-faint">{fmtDateFR(dateSeance).slice(0, 5)}</small></span>
          <span className="tabular text-ivory">{composite.valeur != null ? fmtNumber(composite.valeur, 2) : '—'}</span>
          <span className={`tabular ${ton(composite.variation)}`}>{composite.variation != null ? fmtPctSigne(composite.variation) : '—'}</span>
        </li>
        {(indices ?? []).map((a) => (
          <li key={a.code} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 border-t border-border py-2 ${perimee(a.date_marche) ? 'opacity-60' : ''}`}>
            <span className="min-w-0">{PLACE[a.code] ?? a.libelle ?? a.code}<small className="block text-[11px] text-faint">au {fmtDateFR(a.date_marche).slice(0, 5)}</small></span>
            <span className="tabular text-ivory">{a.valeur != null ? fmtNumber(Number(a.valeur), 2) : '—'}</span>
            <span className={`tabular ${ton(a.variation_pct != null ? Number(a.variation_pct) : null)}`}>{a.variation_pct != null ? fmtPctSigne(Number(a.variation_pct)) : '—'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">Indices en devise locale : comparables en variation, pas en niveau.</p>
    </section>
  );
}
