import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { computeRatios, pickBestFundamental } from '@/lib/fundamentals';
import { getVerifiedDividends } from '@/lib/dividends/verified';
import { agregerParSecteur, medianeMarche, type AgregatSecteur, type LigneSociete } from './agregat';
import brvmSectors from '@/lib/brvmSectors.json';

/**
 * Chargement des données du tableau de bord sectoriel.
 *
 * Les ratios sont calculés par `computeRatios` et le dividende vient de
 * `getVerifiedDividends` — les mêmes sources que la fiche société et l'écran
 * fondamentaux. Aucun chiffre n'est recalculé différemment ici : deux écrans
 * qui affichent un PER différent pour la même société, c'est une plateforme
 * qu'on ne croit plus.
 *
 * Le secteur vient de brvmSectors.json, référentiel déjà utilisé par la landing :
 * la colonne  de brvm_instruments n'est renseignée que pour 3 sociétés
 * — s'y fier rangeait 44 valeurs nulle part, et créait un 8e secteur parasite
 * pour une seule société.
 *
 * La séance est lue en deux temps (dernière date, puis cours de cette date) :
 * une requête « toutes les cotations triées » serait tronquée en silence à
 * 1000 lignes par PostgREST, et l'historique compte désormais 143 000 lignes.
 */

export interface DonneesSecteurs {
  dateMarche: string | null;
  secteurs: AgregatSecteur[];
  societes: LigneSociete[];
  marche: { per: number | null; pbr: number | null; rendement: number | null };
  /** Sociétés cotées sans aucun ratio exploitable — le trou est nommé, pas masqué. */
  sansDonnees: string[];
}

async function charger(): Promise<DonneesSecteurs> {
  const sb = createPublicClient();

  const { data: derniere } = await sb
    .from('brvm_actions_daily').select('date_marche')
    .order('date_marche', { ascending: false }).limit(1).maybeSingle();
  const dateMarche = (derniere?.date_marche as string | undefined) ?? null;

  const [{ data: instruments }, { data: funds }, { data: quotes }, dividendes] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation, secteur, shares').eq('type', 'action').eq('actif', true),
    sb.from('fundamentals').select('code, year, revenue, net_income, equity, debt, is_manual').order('year', { ascending: false }),
    dateMarche
      ? sb.from('brvm_actions_daily').select('code, cours_jour, variation_pct').eq('date_marche', dateMarche)
      : Promise.resolve({ data: [] as { code: string; cours_jour: number | null; variation_pct: number | null }[] }),
    getVerifiedDividends(sb),
  ]);

  const cours = new Map<string, { cours: number | null; variation: number | null }>();
  for (const q of (quotes ?? []) as { code: string; cours_jour: number | null; variation_pct: number | null }[]) {
    cours.set(q.code, { cours: q.cours_jour == null ? null : Number(q.cours_jour), variation: q.variation_pct == null ? null : Number(q.variation_pct) });
  }

  type FundRow = { code: string; year: number | null; revenue: number | null; net_income: number | null; equity: number | null; debt: number | null; is_manual: boolean | null };
  const parCode = new Map<string, FundRow[]>();
  for (const f of (funds ?? []) as FundRow[]) parCode.set(f.code, [...(parCode.get(f.code) ?? []), f]);

  const societes: LigneSociete[] = ((instruments ?? []) as { code: string; designation: string | null; secteur: string | null; shares: number | null }[])
    .map((ins) => {
      const meilleur = pickBestFundamental(parCode.get(ins.code) ?? []);
      const q = cours.get(ins.code);
      const r = computeRatios({
        cours: q?.cours ?? null, shares: ins.shares,
        revenue: meilleur?.revenue ?? null, net_income: meilleur?.net_income ?? null,
        equity: meilleur?.equity ?? null, debt: meilleur?.debt ?? null,
        dividende: dividendes.get(ins.code)?.montant ?? null,
      });
      return {
        code: ins.code, nom: ins.designation,
        secteur: (brvmSectors as Record<string, string>)[ins.code] ?? ins.secteur ?? null,
        cours: q?.cours ?? null, per: r.per, pbr: r.pb,
        // computeRatios rend un RATIO (dividende/cours) ; l'agrégat et l'affichage
        // travaillent en pourcentage. La conversion se fait ici, une seule fois.
        rendement: r.rendementDiv == null ? null : r.rendementDiv * 100,
        capitalisation: r.capitalisation, variation: q?.variation ?? null,
      };
    });

  return {
    dateMarche,
    secteurs: agregerParSecteur(societes),
    societes,
    marche: {
      per: medianeMarche(societes, 'per'),
      pbr: medianeMarche(societes, 'pbr'),
      rendement: medianeMarche(societes, 'rendement'),
    },
    sansDonnees: societes.filter((s) => s.per == null && s.pbr == null && s.rendement == null).map((s) => s.code).sort(),
  };
}

export const getDonneesSecteurs = unstable_cache(charger, ['secteurs-v1'], { revalidate: 900 });
