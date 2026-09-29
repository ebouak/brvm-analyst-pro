import { produitsActifs } from '@/lib/billing/chariow/catalogue';
import { niveauxARemettreAJour } from '@/lib/server/academyAccess';
import { NIVEAU_LABEL, type Niveau } from '@/lib/academy/types';
import AchatChariow from './AchatChariow';

/**
 * Offres « un niveau de l'Academy à l'unité » (Chariow). Ne rend RIEN tant
 * qu'aucun produit n'est actif au catalogue : pas d'offre fantôme, pas de
 * prix inventé.
 */
export default async function OffresNiveaux({
  userId,
  possedes,
  retour,
}: {
  userId: string | null;
  possedes: Set<Niveau>;
  retour: string;
}) {
  const [modules, upgrades, aRemettre] = await Promise.all([
    produitsActifs('module'),
    produitsActifs('upgrade'),
    userId ? niveauxARemettreAJour(userId) : Promise.resolve(new Set<Niveau>()),
  ]);

  const offres = modules
    .filter((p) => p.niveau && !possedes.has(p.niveau))
    .map((p) => {
      // Acheteur rattrapé par une refonte : on lui présente le tarif réduit.
      const up = p.niveau && aRemettre.has(p.niveau) ? upgrades.find((u) => u.niveau === p.niveau) : undefined;
      return up ?? p;
    });
  if (offres.length === 0) return null;

  return (
    <section aria-labelledby="h-offres-niveaux" className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div>
        <h2 id="h-offres-niveaux" className="font-display text-lg text-white">
          Acheter un niveau à l’unité
        </h2>
        <p className="mt-1 max-w-[65ch] text-sm text-muted">
          Sans abonnement : les leçons, l’examen et le certificat d’un niveau, accessibles à vie. Une refonte majeure
          publiée plus de 12 mois après votre achat serait proposée à tarif réduit ; votre certificat reste acquis.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {offres.map((p) => (
          <li key={p.productCode} className="flex flex-col gap-3 rounded-lg border border-border/70 bg-bg/40 p-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-accent">
                {p.niveau ? NIVEAU_LABEL[p.niveau] : ''}
                {p.kind === 'upgrade' ? ' · nouvelle version' : ''}
              </p>
              <p className="mt-1 text-sm text-ivory">{p.libelle}</p>
            </div>
            <AchatChariow
              productCode={p.productCode}
              libelle={p.libelle}
              montant={p.montant}
              devise={p.devise}
              connecte={Boolean(userId)}
              retour={retour}
              cta={p.kind === 'upgrade' ? 'Mettre à jour' : 'Acheter'}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
