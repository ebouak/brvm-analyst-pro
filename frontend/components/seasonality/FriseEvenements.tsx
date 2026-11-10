/**
 * F5 — Calendrier des habitudes de la valeur : mois où tombent ses publications
 * de comptes, ses avis de convocation et ses détachements, année après année.
 * Rendu serveur, ne calcule rien (habitudes() est fait en amont).
 */
import Link from 'next/link';
import type { Habitude, TypeFrise } from '@/lib/seasonality/frise';

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const LIBELLE_EVENEMENT: Record<TypeFrise, string> = {
  comptes_annuels: 'Comptes annuels publiés',
  comptes_semestriels: 'Comptes semestriels publiés',
  convocation_ag: 'Avis de convocation à l’assemblée',
  detachement: 'Détachement du dividende',
};
const fond = (k: number, max: number) => (k === 0 ? '' : k / max > 0.66 ? 'bg-accent/35' : k / max > 0.33 ? 'bg-accent/20' : 'bg-accent/10');
const dateFr = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function FriseEvenements({
  habitudes, prochain,
}: {
  habitudes: Habitude[];
  prochain: { date: string; montant: number } | null;
}) {
  if (habitudes.length === 0 && !prochain) return null;
  return (
    <section aria-labelledby="frise-h" className="space-y-2">
      <h3 id="frise-h" className="text-sm font-medium text-ivory">Calendrier des habitudes</h3>
      <p className="text-xs text-faint">
        Nombre d’années où chaque événement est tombé dans chaque mois. La date d’un avis de convocation précède de quelques
        semaines celle de l’assemblée. Les dates de détachement ne sont connues, pour l’essentiel, que depuis 2022 : les
        années plus anciennes manquent à cette ligne, pas au dividende.
      </p>
      {habitudes.length > 0 && (
        <div tabIndex={0} role="region" aria-label="Calendrier des habitudes, défilement horizontal"
          className="overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead className="bg-surface text-muted">
              <tr>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Événement</th>
                {MOIS.map((m) => <th key={m} scope="col" className="px-1 py-1.5 text-center font-medium">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {habitudes.map((h) => {
                const max = Math.max(...h.parMois);
                return (
                  <tr key={h.type} className="border-t border-border/50">
                    <th scope="row" className="px-2 py-1.5 text-left font-normal">
                      <span className="block text-ivory">{LIBELLE_EVENEMENT[h.type]}</span>
                      <span className="block text-[11px] text-faint">
                        en {MOIS_LONG[h.moisHabituel - 1]} {h.annees} année{h.annees > 1 ? 's' : ''} sur {h.sur}
                      </span>
                    </th>
                    {h.parMois.map((k, i) => (
                      <td key={i} className={`px-1 py-1.5 text-center tabular ${k ? 'text-ivory' : 'text-faint'} ${fond(k, max)}`}
                        title={`${MOIS_LONG[i]} : ${k} année${k > 1 ? 's' : ''} sur ${h.sur}`}>
                        {k || '·'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        {prochain
          ? <>Prochain détachement connu : {dateFr(prochain.date)}, {prochain.montant.toLocaleString('fr-FR')}&nbsp;FCFA par action. </>
          : <>Aucun détachement à venir n’est encore annoncé. </>}
        <Link href="/calendrier" className="text-accent-ink underline underline-offset-2">Calendrier du marché</Link>
        {' · '}
        <Link href="/dividendes" className="text-accent-ink underline underline-offset-2">Dividendes</Link>
      </p>
    </section>
  );
}
