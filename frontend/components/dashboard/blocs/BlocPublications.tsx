import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';
import type { PublicationBloc } from '@/lib/dashboard/publications';
import { CadreBloc, EtatVide, Indisponible, Pastille } from './Cadre';

/** Spec §4.2 — documents des émetteurs (sources officielles), 7 derniers jours. */
export default function BlocPublications({ items, depuis }: { items: PublicationBloc[] | null; depuis: string }) {
  return (
    <CadreBloc id="bloc-publications" titre="Publications · 7 jours" dateReference={depuis} legendeDate="Depuis le">
      {items === null ? (
        <Indisponible />
      ) : items.length === 0 ? (
        <EtatVide message="Aucune publication d'émetteur ces 7 derniers jours." actions={[{ href: '/actualites', label: "Voir l'actualité" }]} />
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((p) => (
            <li key={`${p.code}-${p.date}-${p.url ?? p.libelle}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tabular text-xs text-muted">{fmtDateFR(p.date)}</span>
                <Pastille>{p.typeLibelle}</Pastille>
                {p.mienne && <Pastille accent>Détenue</Pastille>}
                <Link href={`/actions/${p.code}`} className="text-xs font-semibold text-accent-ink hover:underline">{p.code}</Link>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm text-ivory">{p.libelle}</p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-accent-ink hover:underline">
                    Document ↗
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
