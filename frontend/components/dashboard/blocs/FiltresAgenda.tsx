'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtNumber } from '@/lib/format';
import type { ItemAgenda } from '@/lib/dashboard/agenda';
import { PastilleStatut, Pastille } from './Cadre';
import OngletsFiltre, { type Onglet } from './OngletsFiltre';

const jourCourt = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const FILTRES: Record<string, (it: ItemAgenda) => boolean> = {
  tous: () => true,
  miennes: (it) => it.mienne,
  dividendes: (it) => it.type === 'detachement' || it.type === 'paiement',
  assemblees: (it) => it.type === 'assemblee',
  fermes: (it) => it.type === 'fermeture',
};

/** Liste d'agenda filtrable. Props sérialisables (quantités en objet simple, pas en Map). */
export default function FiltresAgenda({
  items, quantites, max = 8,
}: {
  items: ItemAgenda[];
  quantites: Record<string, number>;
  aujourdhui: string;
  max?: number;
}) {
  const [actif, setActif] = useState('tous');
  const onglets: Onglet[] = [{ cle: 'tous', libelle: 'Tous' }];
  if (items.some((i) => i.mienne)) onglets.push({ cle: 'miennes', libelle: 'Mes valeurs' });
  onglets.push({ cle: 'dividendes', libelle: 'Dividendes' });
  if (items.some((i) => i.type === 'assemblee')) onglets.push({ cle: 'assemblees', libelle: 'Assemblées' });
  onglets.push({ cle: 'fermes', libelle: 'Jours fermés' });

  const liste = items.filter(FILTRES[actif] ?? FILTRES.tous).slice(0, max);

  return (
    <>
      <OngletsFiltre onglets={onglets} actif={actif} onChange={setActif} label="Filtrer l'agenda" />
      {liste.length === 0 ? (
        <p className="py-3 text-sm text-muted">Aucun élément pour ce filtre.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {liste.map((it, i) => {
            const n = it.code ? quantites[it.code] : undefined;
            return (
              <li key={`${it.type}-${it.code ?? ''}-${it.date}-${it.parAction ?? ''}-${i}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular w-24 shrink-0 text-xs text-muted">{jourCourt(it.date)}</span>
                  <PastilleStatut statut={it.statut} />
                  {it.mienne && <Pastille accent>Détenue</Pastille>}
                  {it.code ? (
                    <Link href={`/actions/${it.code}`} title={it.titre} className="min-w-0 truncate text-sm text-ivory hover:text-accent-ink">{it.titre}</Link>
                  ) : (
                    <span title={it.titre} className="min-w-0 truncate text-sm text-ivory">{it.titre}</span>
                  )}
                </div>
                {it.parAction != null && (
                  <p className="text-xs text-muted sm:pl-[6.5rem]">
                    <span className="tabular text-ivory">{fmtNumber(it.parAction, 2)} FCFA</span> par action
                    {it.baseFiscale === 'net' ? ' (net)' : it.baseFiscale === 'brut' ? ' (brut)' : ' · base fiscale non précisée'}
                    {it.totalIndicatif != null && n != null && (
                      <>
                        {' · '}total indicatif <span className="tabular text-ivory">{fmtNumber(it.totalIndicatif, 0)} FCFA</span> pour vos{' '}
                        {fmtNumber(n, 0)} titres, {it.type === 'paiement' ? "s'ils étaient détenus" : "s'ils sont détenus"} à la date de détachement
                      </>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
