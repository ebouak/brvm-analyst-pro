import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';
import type { PublicationBloc } from '@/lib/dashboard/publications';
import { CadreBloc, EtatVide, Indisponible, Pastille } from './Cadre';

/** Spec §4.2 — documents des émetteurs (sources officielles), 7 derniers jours. */
export default function BlocPublications({ items, depuis, portefeuilleIndisponible = false }: { items: PublicationBloc[] | null; depuis: string; portefeuilleIndisponible?: boolean }) {
  return (
    <CadreBloc id="bloc-publications" titre="Publications · 7 jours" dateReference={depuis} legendeDate="Depuis le">
      {portefeuilleIndisponible && (
        <p className="mb-3 text-xs text-muted">Vos positions n&apos;ont pas pu être lues : les valeurs détenues ne sont pas signalées.</p>
      )}
      {items === null ? (
        <Indisponible />
      ) : items.length === 0 ? (
        <EtatVide message="Aucune publication d'émetteur ces 7 derniers jours." />
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((p, i) => (
            <li key={`${p.code}-${p.date}-${p.url ?? p.libelle}-${i}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-xs text-muted">{fmtDateFR(p.date)}</span>
                <Pastille>{p.typeLibelle}</Pastille>
                {p.mienne && <Pastille accent>Détenue</Pastille>}
                <Link href={`/actions/${p.code}`} className="text-xs font-semibold text-accent-ink hover:underline">{p.code}</Link>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 break-words text-sm text-ivory">{p.libelle}</p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Document : ${p.libelle} (nouvel onglet)`} className="shrink-0 text-xs text-accent-ink hover:underline">
                    Document <span aria-hidden>↗</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CadreBloc>
  );
}
