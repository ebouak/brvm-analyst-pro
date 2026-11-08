'use client';

import { useEffect, useState } from 'react';
import { ANCRE_OFFICIELLES, type ActuItem, type GroupesActualites } from '@/lib/fiche/overviewActualites';

type Onglet = 'tout' | 'officielles' | 'presse';
const ONGLETS: { id: Onglet; libelle: string; vide: string }[] = [
  { id: 'tout', libelle: 'Tout', vide: 'Aucune actualité en base pour cette valeur.' },
  { id: 'officielles', libelle: 'Publications officielles', vide: 'Aucune publication officielle en base pour cette valeur.' },
  { id: 'presse', libelle: 'Presse', vide: "Aucun article de presse rattaché à cette valeur par la veille." },
];
const PAS = 10;

export function ActualitesValeur({ groupes, nom }: { groupes: GroupesActualites; nom: string }) {
  const [onglet, setOnglet] = useState<Onglet>('tout');
  const [nombre, setNombre] = useState(PAS);

  useEffect(() => {
    const lire = () => { if (window.location.hash === `#${ANCRE_OFFICIELLES}`) { setOnglet('officielles'); setNombre(PAS); } };
    lire();
    window.addEventListener('hashchange', lire);
    return () => window.removeEventListener('hashchange', lire);
  }, []);

  const liste = groupes[onglet];
  const config = ONGLETS.find((o) => o.id === onglet)!;

  return (
    <section aria-labelledby="actualites-titre" className="rounded-card border border-border bg-surface p-4 md:p-5">
      <h3 id="actualites-titre" className="text-base font-semibold text-ivory">Actualités de {nom}</h3>
      <div role="tablist" aria-label="Type d'actualité" className="-mx-1 mt-3 flex flex-wrap gap-1 border-b border-border/60 pb-2">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            id={o.id === 'officielles' ? ANCRE_OFFICIELLES : undefined}
            type="button"
            role="tab"
            aria-selected={o.id === onglet}
            onClick={() => { setOnglet(o.id); setNombre(PAS); }}
            className={`min-h-[36px] scroll-mt-28 rounded-lg px-3 text-xs transition-colors ${o.id === onglet ? 'bg-elevated text-ivory' : 'text-muted hover:text-accent-ink'}`}
          >
            {o.libelle} <span className="tabular text-faint">{groupes[o.id].length}</span>
          </button>
        ))}
      </div>

      {liste.length === 0 ? (
        <p className="py-6 text-xs text-faint">{config.vide}</p>
      ) : (
        <>
          <ul className="divide-y divide-border/40">
            {liste.slice(0, nombre).map((a) => <Element key={a.id} a={a} />)}
          </ul>
          {liste.length > nombre && (
            <button
              type="button"
              onClick={() => setNombre((n) => n + PAS)}
              className="mt-3 min-h-[40px] w-full rounded-lg border border-border text-xs text-muted transition-colors hover:border-accent hover:text-accent-ink"
            >
              Voir plus ({liste.length - nombre} restantes)
            </button>
          )}
        </>
      )}
      <p className="mt-3 text-[11px] text-faint">
        Publications officielles déposées à la BRVM, et articles de presse que la veille rattache à cette société parce qu&apos;ils la nomment.
      </p>
    </section>
  );
}

function Element({ a }: { a: ActuItem }) {
  return (
    <li className="py-3">
      {a.href ? (
        <a href={a.href} target="_blank" rel="noopener noreferrer" className="text-sm text-ivory transition-colors hover:text-accent-ink">
          {a.titre}
        </a>
      ) : (
        <p className="text-sm text-ivory">{a.titre}</p>
      )}
      <p className="mt-1 text-xs text-faint">
        {a.source} · {a.date}
        {a.nature === 'officielle' && <span className="text-faint"> · publication officielle</span>}
      </p>
    </li>
  );
}
