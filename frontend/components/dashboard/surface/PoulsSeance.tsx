'use client';

import { estEnSeance } from '@/lib/freshness';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import { phraseReleve, type Largeur } from '@/lib/realtime/releve';
import { useMaintenant, useReleve } from '@/lib/realtime/useReleve';
import { ChiffreRoulant } from '@/components/ui/ChiffreRoulant';

/**
 * Bandeau « pouls de séance » : le marché au PREMIER ÉCRAN du tableau de bord,
 * pendant la séance seulement (verdict Fable du 2026-11-23 : la persistance,
 * pas l'intensité — une animation d'une seconde tous les quarts d'heure ne se
 * voit pas ; un état qui reste à l'écran jusqu'au relevé suivant, si).
 *
 * - N'ouvre AUCUN abonnement : il lit ce que publient les hooks déjà présents
 *   sur la page (useReleve). Sans eux (widgets masqués), il garde les valeurs
 *   du rendu serveur et l'heure du relevé continue d'avancer.
 * - Données de MARCHÉ seulement : rien du portefeuille de la personne ici.
 * - La barre hausses / baisses glisse à chaque relevé (transition coupée sous
 *   prefers-reduced-motion).
 */
export default function PoulsSeance({ enSeanceAuRendu, composite, largeur, derniereCollecte }: {
  /** Calculé par le serveur au rendu : même affichage au premier rendu client. */
  enSeanceAuRendu: boolean;
  composite: { valeur: number; variation_pct: number | null } | null;
  largeur: Largeur | null;
  derniereCollecte: string | null;
}) {
  const info = useReleve();
  const maintenant = useMaintenant();
  const visible = maintenant ? estEnSeance(maintenant) : enSeanceAuRendu;
  if (!visible) return null;

  const c = info.composite ?? composite;
  const l = info.largeur ?? largeur;
  const total = l ? l.hausses + l.baisses + l.stables : 0;
  const releve = info.releve ?? (derniereCollecte ? Date.parse(derniereCollecte) : null);
  const duJour = releve != null && maintenant != null
    && new Date(releve).toISOString().slice(0, 10) === maintenant.toISOString().slice(0, 10);
  const phrase = duJour ? phraseReleve({ dernier: new Date(releve!), maintenant: maintenant!, echanges: info.echanges }) : null;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <section
      aria-label="Pouls de la séance"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-2.5"
    >
      <p className="flex items-center gap-2 text-xs text-muted">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-up" />
        Séance en cours
      </p>

      {c && (
        <p className="flex items-baseline gap-2">
          <span className="text-xs text-muted">BRVM Composite</span>
          <span className="tabular text-base text-ivory">
            <ChiffreRoulant valeur={c.valeur} format={(x) => fmtNumber(x, 2)} />
          </span>
          {c.variation_pct != null && (
            <span className={`tabular text-xs ${c.variation_pct > 0 ? 'text-up' : c.variation_pct < 0 ? 'text-down' : 'text-muted'}`}>
              {fmtPctSigne(c.variation_pct)}
            </span>
          )}
        </p>
      )}

      {l && total > 0 && (
        <div className="flex min-w-0 items-center gap-2">
          <div
            role="img"
            aria-label={`${l.hausses} hausses, ${l.baisses} baisses, ${l.stables} stables`}
            className="flex h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-border"
          >
            <span className="bg-up transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: pct(l.hausses) }} />
            <span className="bg-faint/50 transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: pct(l.stables) }} />
            <span className="bg-down transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: pct(l.baisses) }} />
          </div>
          <span className="text-xs text-muted">
            <span className="tabular text-up">{l.hausses}</span> hausses · <span className="tabular text-down">{l.baisses}</span> baisses · <span className="tabular">{l.stables}</span> stables
          </span>
        </div>
      )}

      {phrase && <p className="text-xs text-muted sm:ml-auto">{phrase}</p>}
    </section>
  );
}
