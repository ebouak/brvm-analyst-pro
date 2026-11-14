import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { Lesson } from './types';
import {
  exemplesCours,
  exemplesRendement,
  historiqueDividendes,
  lectureIndices,
  ratiosValeurs,
  type Cotation,
  type LigneFondamentale,
  type LigneDividende,
  type LigneIndice,
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
  | ({ vue: 'historique' } & ReturnType<typeof historiqueDividendes>)
  | ({ vue: 'cours' } & ReturnType<typeof exemplesCours>)
  | ({ vue: 'indices' } & ReturnType<typeof lectureIndices>)
  | ({ vue: 'ratios' } & ReturnType<typeof ratiosValeurs>);

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
      sb.from('brvm_instruments').select('code, designation, shares').in('code', codes),
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
    const titres: Record<string, number | null> = Object.fromEntries(
      ((ins.data ?? []) as { code: string; shares: number | null }[]).map((r) => [r.code, r.shares == null ? null : Number(r.shares)]),
    );

    // Fondamentaux : lus seulement si une leçon demande des ratios.
    let fondamentaux: LigneFondamentale[] = [];
    const codesRatios = [...new Set(blocs.filter((b) => b.spec.vue === 'ratios').flatMap((b) => b.spec.codes))];
    if (codesRatios.length > 0) {
      const fd = await sb.from('fundamentals').select('code, year, net_income, equity').in('code', codesRatios);
      if (fd.error) throw new Error('lecture des fondamentaux impossible');
      fondamentaux = ((fd.data ?? []) as LigneFondamentale[]).map((r) => ({
        ...r,
        net_income: r.net_income == null ? null : Number(r.net_income),
        equity: r.equity == null ? null : Number(r.equity),
      }));
    }

    const noms = Object.fromEntries(
      ((ins.data ?? []) as { code: string; designation: string | null }[]).map((r) => [r.code, r.designation ?? r.code]),
    );

    // Indices : lus seulement si une leçon en demande (dix dernières séances par code).
    let indices: LigneIndice[] = [];
    const codesIndices = [...new Set(blocs.filter((b) => b.spec.vue === 'indices').flatMap((b) => b.spec.codes))];
    if (codesIndices.length > 0) {
      const ix = await sb
        .from('brvm_indices_daily')
        .select('code, date_marche, libelle, valeur, variation_pct')
        .in('code', codesIndices)
        .order('date_marche', { ascending: false })
        .limit(codesIndices.length * 10);
      if (ix.error) throw new Error('lecture des indices impossible');
      indices = (ix.data ?? []) as LigneIndice[];
    }

    for (const { li, si, spec } of blocs) {
      const v: DonneesSection =
        spec.vue === 'rendement'
          ? { vue: 'rendement', ...exemplesRendement(spec.codes, noms, dividendes, cotations, spec.actions) }
          : spec.vue === 'cours'
            ? { vue: 'cours', ...exemplesCours(spec.codes, noms, cotations, spec.actions) }
            : spec.vue === 'indices'
              ? { vue: 'indices', ...lectureIndices(spec.codes, indices) }
              : spec.vue === 'ratios'
                ? { vue: 'ratios', ...ratiosValeurs(spec.codes, noms, cotations, fondamentaux, titres) }
              : { vue: 'historique', ...historiqueDividendes(spec.codes, noms, dividendes) };
      poser(li, si, v);
    }
  } catch {
    for (const { li, si } of blocs) poser(li, si, null);
  }
  return sortie;
}
