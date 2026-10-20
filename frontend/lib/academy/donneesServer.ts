import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { Lesson } from './types';
import {
  exemplesRendement,
  historiqueDividendes,
  type Cotation,
  type LigneDividende,
} from './donneesReelles';

/**
 * Charge les exemples RÉELS déclarés par les sections de leçon
 * (`donnees_reelles`) : dividendes de la table `dividends`, dernier cours de
 * `brvm_actions_daily`, désignation de `brvm_instruments`. Lecture seule.
 *
 * Tolérant aux pannes, comme les exercices du jour : une lecture qui échoue
 * donne `null` pour la section (l'interface affiche « données indisponibles »),
 * jamais une erreur de page ni un chiffre deviné.
 */

export type DonneesSection =
  | ({ vue: 'rendement' } & ReturnType<typeof exemplesRendement>)
  | ({ vue: 'historique' } & ReturnType<typeof historiqueDividendes>);

/** Par index de leçon, puis index de section. */
export type DonneesLecons = Record<number, Record<number, DonneesSection | null>>;

export async function chargerDonneesReelles(lessons: Lesson[]): Promise<DonneesLecons> {
  const blocs = lessons.flatMap((l, li) =>
    l.sections.flatMap((s, si) => (s.donnees_reelles ? [{ li, si, spec: s.donnees_reelles }] : [])),
  );
  if (blocs.length === 0) return {};

  const codes = [...new Set(blocs.flatMap((b) => b.spec.codes))];
  const sortie: DonneesLecons = {};
  const poser = (li: number, si: number, v: DonneesSection | null) => {
    (sortie[li] ??= {})[si] = v;
  };

  try {
    const sb = getServiceClient();
    const [div, ins, derniere] = await Promise.all([
      sb.from('dividends').select('code, exercice, montant, base_fiscale, payment_date, source').in('code', codes),
      sb.from('brvm_instruments').select('code, designation').in('code', codes),
      sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
    ]);
    if (div.error || ins.error || derniere.error) throw new Error('lecture des exemples réels impossible');

    const date = (derniere.data?.[0] as { date_marche: string } | undefined)?.date_marche ?? null;
    let cotations: Cotation[] = [];
    if (date) {
      const c = await sb.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', date).in('code', codes);
      if (c.error) throw new Error('lecture des cours impossible');
      cotations = ((c.data ?? []) as { code: string; cours_jour: number | null }[])
        .filter((r) => r.cours_jour != null && r.cours_jour > 0)
        .map((r) => ({ code: r.code, cours: r.cours_jour as number, date }));
    }
    const dividendes = (div.data ?? []) as LigneDividende[];
    const noms = Object.fromEntries(
      ((ins.data ?? []) as { code: string; designation: string | null }[]).map((r) => [r.code, r.designation ?? r.code]),
    );

    for (const { li, si, spec } of blocs) {
      poser(
        li,
        si,
        spec.vue === 'rendement'
          ? { vue: 'rendement', ...exemplesRendement(spec.codes, noms, dividendes, cotations, spec.actions) }
          : { vue: 'historique', ...historiqueDividendes(spec.codes, noms, dividendes) },
      );
    }
  } catch {
    for (const { li, si } of blocs) poser(li, si, null);
  }
  return sortie;
}
