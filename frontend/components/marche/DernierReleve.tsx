import Link from 'next/link';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { heureMaj } from '@/lib/realtime/recomposer';
import type { ComparaisonReleves } from '@/lib/realtime/dernierReleve';

/**
 * « Dernier relevé » : ce qui a bougé entre les deux derniers relevés de la
 * collecte, et qui RESTE affiché jusqu'au suivant (verdict Fable du
 * 2026-11-23 : la persistance, pas l'intensité).
 *
 * Ton neutre, liste plafonnée, nombre de titres toujours donné quand il est
 * lisible : sur un titre peu échangé, une seule transaction peut faire un
 * « grand » mouvement. Données de marché seulement, jamais les positions de la
 * personne mises en avant.
 */

const phraseTitre = (d: ComparaisonReleves) => {
  const h = heureMaj(new Date(d.instant));
  const hp = heureMaj(new Date(d.instantPrecedent));
  const n = d.mouvements.length;
  if (n === 0) return `Relevé de ${h} : aucun cours n'a bougé depuis ${hp}`;
  return `Relevé de ${h} : ${n} cours ${n > 1 ? 'ont' : 'a'} bougé depuis ${hp}`;
};

export function DernierRelevePanneau({ donnees, max = 6 }: { donnees: ComparaisonReleves; max?: number }) {
  const n = donnees.mouvements.length;
  return (
    <section id="dernier-releve" aria-labelledby="dernier-releve-titre" className="scroll-mt-24 border-b border-border/60 px-4 py-3">
      <h3 id="dernier-releve-titre" className="text-sm text-ivory">{phraseTitre(donnees)}</h3>
      {n > 0 && (
        <ul key={donnees.instant} className="mt-2 grid gap-x-6 gap-y-1.5 motion-safe:animate-rise-in sm:grid-cols-2 lg:grid-cols-3">
          {donnees.mouvements.slice(0, max).map((m) => (
            <li key={m.code} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs">
              <Link href={`/actions/${m.code}`} className="tabular font-medium text-ivory hover:text-accent">{m.code}</Link>
              <span className="tabular text-muted">{fmtNumber(m.avant)} → {fmtNumber(m.apres)}</span>
              <span className={`tabular ${m.variationPct > 0 ? 'text-up' : 'text-down'}`}>{fmtPctSigne(m.variationPct)}</span>
              {m.titres != null && <span className="tabular text-faint">{fmtNumber(m.titres)} titres</span>}
            </li>
          ))}
        </ul>
      )}
      {n > max && (
        <p className="mt-1.5 text-xs text-faint">
          Et {n - max} autre{n - max > 1 ? 's' : ''}, marquée{n - max > 1 ? 's' : ''} d’un point dans le tableau.
        </p>
      )}
      {n > 0 && (
        <p className="mt-1.5 text-[11px] text-faint">
          Écart entre deux relevés de la collecte. Sur un titre peu échangé, une seule transaction peut déplacer le cours : le nombre de titres échangés est indiqué.
        </p>
      )}
    </section>
  );
}

/** Version d'une ligne, pour le bandeau du tableau de bord. */
export function LigneDernierReleve({ donnees }: { donnees: ComparaisonReleves }) {
  return (
    <p className="text-xs text-muted">
      {phraseTitre(donnees)}
      {donnees.mouvements.length > 0 && (
        <>
          {' · '}
          <Link href="/actions#dernier-releve" className="text-accent hover:underline">voir le détail</Link>
        </>
      )}
    </p>
  );
}

/** Point discret sur une ligne du tableau : « a bougé au relevé de 12:15 ». */
export function MarqueReleve({ heure }: { heure: string }) {
  return (
    <span title={`A bougé au relevé de ${heure}`} className="ml-1.5 inline-flex items-center align-middle">
      <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />
      <span className="sr-only">a bougé au relevé de {heure}</span>
    </span>
  );
}
