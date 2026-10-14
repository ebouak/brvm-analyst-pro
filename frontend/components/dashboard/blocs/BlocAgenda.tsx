import type { ItemAgenda } from '@/lib/dashboard/agenda';
import { CadreBloc, EtatVide, Indisponible } from './Cadre';
import FiltresAgenda from './FiltresAgenda';

/**
 * Spec §4.1. Dividende PAR ACTION et TOTAL INDICATIF toujours distincts ;
 * « net » seulement si la source le dit. `items === null` : lecture en erreur.
 * Les quantités sont un objet simple (une Map ne traverse pas la frontière serveur→client).
 */
export default function BlocAgenda({
  items, aujourdhui, quantites, portefeuilleIndisponible = false,
}: {
  portefeuilleIndisponible?: boolean;
  items: ItemAgenda[] | null;
  aujourdhui: string;
  quantites: Record<string, number>;
}) {
  const liste = items ?? [];
  return (
    <CadreBloc id="bloc-agenda" titre="Agenda · 30 jours" dateReference={aujourdhui} legendeDate="À partir du" lien={{ href: '/calendrier', label: 'Calendrier complet' }}>
      {portefeuilleIndisponible && (
        <p className="mb-3 text-xs text-muted">Vos positions n&apos;ont pas pu être lues : les valeurs détenues ne sont pas signalées.</p>
      )}
      {items === null ? (
        <Indisponible />
      ) : liste.length === 0 ? (
        <EtatVide
          message="Aucun dividende ni assemblée annoncés dans les 30 prochains jours."
          actions={[{ href: '/calendrier', label: 'Voir le calendrier complet' }]}
        />
      ) : (
        <FiltresAgenda items={liste} quantites={quantites} aujourdhui={aujourdhui} />
      )}
    </CadreBloc>
  );
}
