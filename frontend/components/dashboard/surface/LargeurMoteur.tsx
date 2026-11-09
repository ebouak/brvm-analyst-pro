import Link from 'next/link';
import { TeteBloc } from './Grille';

/**
 * Spec §12 — moteur de signaux. La largeur du marché (hausses, stables,
 * baisses) n'y figure plus : « Le marché aujourd'hui » et le titre de séance la
 * donnent déjà, la page la répétait trois fois.
 */
export default function LargeurMoteur({ signaux }: { signaux: Record<string, number> | null }) {
  const achats = signaux?.BUY ?? 0, ventes = signaux?.SELL ?? 0, attente = signaux?.HOLD ?? 0;
  const nbSignaux = achats + ventes + attente;
  return (
    <section aria-labelledby="t-largeur" className="py-5 lg:px-5">
      <TeteBloc id="t-largeur" titre="Moteur de signaux" />
      <div>
        {signaux === null ? (
          <p className="mt-2 text-sm text-muted">Signaux momentanément indisponibles.</p>
        ) : nbSignaux === 0 ? (
          <p className="mt-2 text-sm text-muted">Les signaux sont calculés après la clôture de la séance.</p>
        ) : (
          <>
            <p className="mt-2.5"><span className="tabular inline-flex gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs">
              {achats} achat · {ventes} vente · {attente} attente
            </span></p>
            <p className="mt-2 text-sm text-muted">
              {achats + ventes === 0
                ? `Aucune des ${nbSignaux} valeurs ne franchit le seuil d'un signal ce jour. Le moteur s'abstient quand aucune tendance n'est nette.`
                : `${achats + ventes} valeur${achats + ventes > 1 ? 's franchissent' : ' franchit'} le seuil d'un signal ce jour.`}
            </p>
          </>
        )}
        <p className="mt-2.5"><Link href="/signaux" className="text-sm text-accent-ink hover:underline">Voir tous les signaux →</Link></p>
      </div>
    </section>
  );
}
