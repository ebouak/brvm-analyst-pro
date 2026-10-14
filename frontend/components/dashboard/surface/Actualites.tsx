import Link from 'next/link';
import { fmtDateFR } from '@/lib/format';
import type { Actualite } from '@/lib/dashboard/chargement';
import { TeteBloc } from './Grille';

const sure = (u: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

export default function Actualites({ items }: { items: Actualite[] | null }) {
  return (
    <section aria-labelledby="t-actus" className="py-5 lg:px-5">
      <TeteBloc id="t-actus" titre="Actualités" droite={<Link href="/actualites" className="text-xs text-accent-ink hover:underline">Toutes</Link>} />
      {items === null ? <p className="text-sm text-muted">Actualités momentanément indisponibles.</p> : items.length === 0 ? <p className="text-sm text-muted">Aucune actualité récente.</p> : (
        <ul>
          {items.map((n, i) => {
            const url = sure(n.source_url);
            return (
              <li key={`${n.date_publication}-${i}`} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 border-t border-border py-2 text-[13.5px] first:border-t-0 first:pt-0">
                <time dateTime={n.date_publication} className="tabular text-[11.5px] leading-relaxed text-faint">{fmtDateFR(n.date_publication.slice(0, 10)).slice(0, 5)}</time>
                {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="break-words text-ivory hover:text-accent-ink">{n.titre}</a> : <span className="break-words text-ivory">{n.titre}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
