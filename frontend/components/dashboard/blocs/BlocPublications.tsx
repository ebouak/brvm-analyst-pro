import type { PublicationBloc } from '@/lib/dashboard/publications';
import { CadreBloc, EtatVide, Indisponible } from './Cadre';
import FiltresPublications from './FiltresPublications';

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
        <FiltresPublications items={items} />
      )}
    </CadreBloc>
  );
}
