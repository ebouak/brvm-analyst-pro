import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLastMarketDate } from '@/lib/marketDate';
import { derivePortfolio, type PricePoint, type RawPosition } from '@/lib/portfolio/derive';
import { LIQUIDITES_CODE } from '@/lib/portfolio/constantes';
import { calculerRecap, type Recap } from './calcul';

/**
 * Données de la récap d'UN utilisateur, lues avec le client service_role : la
 * route vérifie l'identité AVANT d'appeler (session, ou lien signé). Mêmes
 * sources que /portefeuille (portfolios_positions, brvm_actions_daily,
 * brvm_reference) pour que les chiffres soient identiques.
 *
 * Fenêtre de cours courte (21 jours) : seule la dernière valeur de chaque
 * titre sert ici. Une fenêtre longue sur 48 valeurs dépasserait le plafond
 * SILENCIEUX de 1 000 lignes de PostgREST et fausserait le dernier cours.
 */
const FENETRE_JOURS = 21;

export async function chargerRecap(db: SupabaseClient, userId: string): Promise<Recap | null> {
  const seance = await getLastMarketDate(db);
  if (!seance) return null;

  const { data: brutes, error } = await db
    .from('portfolios_positions')
    .select('code, quantite, prix_entree, date_entree')
    .eq('user_id', userId);
  if (error) throw new Error(`positions : ${error.code ?? error.message}`);
  const lignes = (brutes ?? []) as { code: string; quantite: number; prix_entree: number; date_entree: string | null }[];
  const codes = [...new Set(lignes.map((l) => l.code).filter((c) => c && c !== LIQUIDITES_CODE))];

  const depuis = new Date(Date.parse(`${seance}T12:00:00Z`) - FENETRE_JOURS * 86_400_000).toISOString().slice(0, 10);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [cours, reference, dividendes, alertes] = await Promise.all([
    codes.length
      ? db.from('brvm_actions_daily').select('code, cours_jour, variation_pct, date_marche')
          .in('code', codes).gte('date_marche', depuis).lte('date_marche', seance)
          .not('cours_jour', 'is', null).order('date_marche', { ascending: true }).limit(1000)
      : Promise.resolve({ data: [] }),
    db.from('brvm_reference').select('symbole, secteur'),
    codes.length
      ? db.from('dividends').select('code, exercice, montant, ex_date')
          .in('code', codes).gte('ex_date', aujourdhui).order('ex_date', { ascending: true }).limit(20)
      : Promise.resolve({ data: [] }),
    db.from('alerts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('declenchee_le', `${seance}T00:00:00Z`),
  ]);

  const secteurPar: Record<string, string> = {};
  for (const r of (reference.data ?? []) as { symbole: string; secteur: string }[]) secteurPar[r.symbole] = r.secteur;

  const historique = new Map<string, PricePoint[]>();
  const variationJour: Record<string, number> = {};
  for (const r of (cours.data ?? []) as { code: string; cours_jour: number; variation_pct: number | null; date_marche: string }[]) {
    if (!historique.has(r.code)) historique.set(r.code, []);
    historique.get(r.code)!.push({ date: r.date_marche, cours: Number(r.cours_jour) });
    if (r.date_marche === seance && r.variation_pct != null) variationJour[r.code] = Number(r.variation_pct);
  }

  const positions: RawPosition[] = lignes.map((l) => {
    const liq = l.code === LIQUIDITES_CODE;
    return {
      code: l.code,
      quantite: Number(l.quantite),
      prix_entree: Number(l.prix_entree),
      date_entree: l.date_entree,
      secteur: liq ? 'Liquidités' : (secteurPar[l.code] ?? 'Autres'),
      is_liquidites: liq,
    };
  });

  /* Même filtre de fiabilité que l'agent (lib/agent/outils.ts) : un montant
     nul, ou égal à l'année d'exercice (extraction ratée), n'est pas affiché. */
  const divs = ((dividendes.data ?? []) as { code: string; exercice: number | null; montant: number | null; ex_date: string }[])
    .map((d) => ({
      code: d.code,
      exDate: d.ex_date,
      montant: d.montant != null && Number(d.montant) > 0 && Number(d.montant) !== Number(d.exercice) ? Number(d.montant) : null,
    }));

  return calculerRecap({
    etat: derivePortfolio(positions, historique, aujourdhui),
    seance,
    variationJour,
    dividendes: divs,
    alertesDuJour: alertes.count ?? 0,
  });
}
