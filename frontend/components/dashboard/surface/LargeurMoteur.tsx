import Link from 'next/link';
import { TeteBloc } from './Grille';

/** Spec §12 — largeur du marché (variations connues) et moteur de signaux. */
export default function LargeurMoteur({ hausses, baisses, stables, signaux }: {
  hausses: number | null; baisses: number | null; stables: number | null; signaux: Record<string, number> | null;
}) {
  const connue = hausses != null && baisses != null && stables != null && hausses + baisses + stables > 0;
  const total = connue ? hausses + baisses + stables : 0;
  const achats = signaux?.BUY ?? 0, ventes = signaux?.SELL ?? 0, attente = signaux?.HOLD ?? 0;
  const nbSignaux = achats + ventes + attente;
  return (
    <section aria-labelledby="t-largeur" className="py-5 lg:px-5">
      <TeteBloc id="t-largeur" titre="Largeur du marché" droite={connue ? <span className="overline text-faint">{total} valeurs</span> : undefined} />
      {connue ? (
        <>
          <div className="my-1 flex h-2.5 gap-0.5 overflow-hidden rounded" aria-hidden>
            <span className="block bg-up" style={{ flex: hausses }} />
            <span className="block bg-muted/50" style={{ flex: stables }} />
            <span className="block bg-down" style={{ flex: baisses }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {([['Hausses', hausses, 'text-up'], ['Stables', stables, 'text-muted'], ['Baisses', baisses, 'text-down']] as const).map(([l, nb, t]) => (
              <div key={l} className="rounded-lg bg-surface px-3 py-2.5">
                <dt className="overline text-faint">{l}</dt>
                <dd className={`tabular mt-1.5 text-[22px] leading-none ${t}`}>{nb}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="text-sm text-muted">Largeur du marché non mesurée pour cette séance.</p>
      )}
      <div className="mt-4 border-t border-border pt-4">
        <p className="overline text-faint">Moteur de signaux</p>
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
