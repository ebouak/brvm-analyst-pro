import Link from 'next/link';
import { fmtNumber } from '@/lib/format';
import type { ItemAgenda } from '@/lib/dashboard/agenda';
import { CadreBloc, EtatVide, Indisponible, PastilleStatut, Pastille } from './Cadre';

const jourCourt = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Spec §4.1. Dividende PAR ACTION et TOTAL INDICATIF toujours distincts ;
 * « net » seulement si la source le dit. `items === null` : lecture en erreur.
 */
export default function BlocAgenda({
  items, aujourdhui, quantites,
}: {
  items: ItemAgenda[] | null;
  aujourdhui: string;
  quantites: ReadonlyMap<string, number>;
}) {
  const liste = (items ?? []).slice(0, 8);
  return (
    <CadreBloc id="bloc-agenda" titre="Agenda · 30 jours" dateReference={aujourdhui} legendeDate="À partir du" lien={{ href: '/calendrier', label: 'Calendrier complet' }}>
      {items === null ? (
        <Indisponible />
      ) : liste.length === 0 ? (
        <EtatVide
          message="Aucun dividende ni assemblée annoncés dans les 30 prochains jours."
          actions={[{ href: '/calendrier', label: 'Voir le calendrier complet' }]}
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {liste.map((it, i) => {
            const n = it.code ? quantites.get(it.code) : undefined;
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
                        {fmtNumber(n, 0)} titres, {it.type === 'paiement' ? 's&apos;ils étaient détenus' : 's&apos;ils sont détenus'} à la date de détachement
                      </>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </CadreBloc>
  );
}
