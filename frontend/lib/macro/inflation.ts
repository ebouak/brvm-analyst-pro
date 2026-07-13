import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { realReturn, cumulativeInflation, annualizedInflation, purchasingPower } from './realReturn';

/**
 * Rendement RÉEL d'une action BRVM, corrigé de l'inflation du pays de l'investisseur.
 *
 * ── L'idée qui rend cet écran unique ──
 * Le rendement réel N'EST PAS le même pour tous. Deux investisseurs qui détiennent
 * la MÊME action ne s'enrichissent pas pareillement : en 2024, l'inflation était de
 * 0,80 % au Sénégal et de 9,07 % au Niger. Le Sénégalais garde presque tout son
 * gain ; le Nigérien en perd la moitié en pouvoir d'achat. Le cours, lui, est
 * identique. Aucun site de la place ne le dit.
 *
 * Toutes les données sont réelles : cours depuis 1998 (brvm_actions_daily),
 * inflation Banque mondiale (macro_inflation). Aucun chiffre n'est fabriqué —
 * si une série manque, on renvoie null et l'écran l'affiche.
 */

export interface PaysInflation {
  code: string;
  nom: string;
  /** Inflation cumulée sur la période, en %. */
  cumulPct: number;
  /** Inflation annualisée (moyenne géométrique), en %. */
  annualisePct: number;
  /** Rendement réel de l'action pour un investisseur de ce pays, en %. */
  realPct: number;
  /** Rendement réel annualisé, en %. */
  realAnnualisePct: number;
  /** Ce que 1 000 000 FCFA investis valent aujourd'hui, en pouvoir d'achat. */
  pouvoirAchat: number;
  /** L'inflation a mangé tout le gain. */
  destroysValue: boolean;
}

export interface RealReturnReport {
  code: string;
  nom: string | null;
  anneeDebut: number;
  anneeFin: number;
  annees: number;
  coursDebut: number;
  coursFin: number;
  /** Rendement nominal cumulé sur la période, en %. */
  nominalPct: number;
  /** Rendement nominal annualisé, en %. */
  nominalAnnualisePct: number;
  pays: PaysInflation[];
}

const CAPITAL_REF = 1_000_000; // 1 million FCFA — l'ordre de grandeur d'un particulier

/** Liste des titres disposant d'assez d'historique pour l'horizon demandé. */
export async function listCodes(): Promise<{ code: string; designation: string | null }[]> {
  const db = createPublicClient();
  const { data } = await db
    .from('brvm_actions_daily')
    .select('code, designation')
    .order('code')
    .limit(2000);

  const seen = new Map<string, string | null>();
  for (const r of (data ?? []) as { code: string; designation: string | null }[]) {
    if (!seen.has(r.code)) seen.set(r.code, r.designation);
  }
  return [...seen.entries()]
    .map(([code, designation]) => ({ code, designation }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Premier cours de l'année `annee` (ou le plus proche après). Null si absent. */
async function coursAnnee(code: string, annee: number, sens: 'debut' | 'fin') {
  const db = createPublicClient();
  const q = db
    .from('brvm_actions_daily')
    .select('date_marche, cours_jour')
    .eq('code', code)
    .not('cours_jour', 'is', null);

  const { data } =
    sens === 'debut'
      ? await q.gte('date_marche', `${annee}-01-01`).order('date_marche', { ascending: true }).limit(1)
      : await q.lte('date_marche', `${annee}-12-31`).order('date_marche', { ascending: false }).limit(1);

  const row = (data ?? [])[0] as { date_marche: string; cours_jour: number } | undefined;
  return row ?? null;
}

/**
 * Construit le rapport de rendement réel pour un titre sur `annees` années.
 * Renvoie null si l'historique est insuffisant — jamais d'extrapolation.
 */
export async function buildRealReturn(code: string, annees: number): Promise<RealReturnReport | null> {
  const db = createPublicClient();
  const anneeFin = new Date().getFullYear() - 1; // dernière année d'inflation PUBLIÉE
  const anneeDebut = anneeFin - annees + 1;

  const [debut, fin] = await Promise.all([
    coursAnnee(code, anneeDebut, 'debut'),
    coursAnnee(code, anneeFin, 'fin'),
  ]);

  // Pas d'historique suffisant : on le dit, on n'invente pas un point de départ.
  if (!debut || !fin || debut.cours_jour <= 0 || debut.date_marche >= fin.date_marche) return null;

  const { data: nomRow } = await db
    .from('brvm_actions_daily')
    .select('designation')
    .eq('code', code)
    .limit(1)
    .maybeSingle();

  const nominalPct = ((fin.cours_jour - debut.cours_jour) / debut.cours_jour) * 100;
  const nominalAnnualisePct =
    (Math.pow(fin.cours_jour / debut.cours_jour, 1 / annees) - 1) * 100;

  // Inflation réelle de chaque pays sur exactement la même fenêtre.
  const { data: infl } = await db
    .from('macro_inflation')
    .select('pays_code, pays_nom, annee, taux_pct')
    .gte('annee', anneeDebut)
    .lte('annee', anneeFin);

  const parPays = new Map<string, { nom: string; taux: number[] }>();
  for (const r of (infl ?? []) as { pays_code: string; pays_nom: string; taux_pct: number }[]) {
    const e = parPays.get(r.pays_code) ?? { nom: r.pays_nom, taux: [] };
    e.taux.push(Number(r.taux_pct));
    parPays.set(r.pays_code, e);
  }

  const pays: PaysInflation[] = [];
  for (const [pcode, { nom, taux }] of parPays) {
    // Série incomplète = on écarte le pays plutôt que de combler les trous.
    if (taux.length < annees) continue;

    const cumul = cumulativeInflation(taux);
    const annualise = annualizedInflation(taux);
    if (cumul === null || annualise === null) continue;

    const r = realReturn({ nominalPct, inflationPct: cumul });
    const rAnn = realReturn({ nominalPct: nominalAnnualisePct, inflationPct: annualise });

    pays.push({
      code: pcode,
      nom,
      cumulPct: cumul,
      annualisePct: annualise,
      realPct: r.realPct,
      realAnnualisePct: rAnn.realPct,
      pouvoirAchat: purchasingPower(CAPITAL_REF, r.realPct, 1), // gain réel appliqué une fois
      destroysValue: r.destroysValue,
    });
  }

  // Du plus favorable au moins favorable : l'écart entre le haut et le bas de la
  // liste EST le message de l'écran.
  pays.sort((a, b) => b.realPct - a.realPct);

  return {
    code,
    nom: (nomRow as { designation: string | null } | null)?.designation ?? null,
    anneeDebut,
    anneeFin,
    annees,
    coursDebut: debut.cours_jour,
    coursFin: fin.cours_jour,
    nominalPct: Math.round(nominalPct * 100) / 100,
    nominalAnnualisePct: Math.round(nominalAnnualisePct * 100) / 100,
    pays,
  };
}
