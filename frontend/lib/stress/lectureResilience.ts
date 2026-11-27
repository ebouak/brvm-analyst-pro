import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import brvmSectors from '@/lib/brvmSectors.json';
import type {
  ActionResilienceRow,
  FamilleComptable,
  SecteurStressRow,
  SyntheseResilience,
} from './resilienceTypes';

const PAGE = 1000;
const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

function agregerSecteurs(
  actions: readonly ActionResilienceRow[],
  volumesByCode: ReadonlyMap<string, { volume: number; valeur: number }>,
): SecteurStressRow[] {
  const capTotal = actions.reduce((s, a) => s + (a.capitalisation ?? 0), 0);
  const bySec = new Map<string, ActionResilienceRow[]>();
  for (const a of actions) {
    const arr = bySec.get(a.secteur) ?? [];
    arr.push(a);
    bySec.set(a.secteur, arr);
  }

  const wAvg = (items: readonly ActionResilienceRow[], pick: (a: ActionResilienceRow) => number | null) => {
    let num = 0;
    let den = 0;
    for (const a of items) {
      const v = pick(a);
      if (v == null || !Number.isFinite(v)) continue;
      const w = a.capitalisation && a.capitalisation > 0 ? a.capitalisation : 1;
      num += v * w;
      den += w;
    }
    return den > 0 ? round2(num / den) : null;
  };

  const out: SecteurStressRow[] = [];
  for (const [secteur, items] of bySec.entries()) {
    const capSec = items.reduce((s, a) => s + (a.capitalisation ?? 0), 0);
    const poids = capTotal > 0 ? round2((100 * capSec) / capTotal) : 0;
    const perf1j = wAvg(items, (a) => a.perf_1j_pct);
    const perf1s = wAvg(items, (a) => a.perf_5j_pct);
    const perf1m = wAvg(items, (a) => a.perf_1m_pct);
    const perfYtd = wAvg(items, (a) => a.perf_ytd_pct);
    const nbHausses = items.filter((a) => (a.perf_1j_pct ?? 0) > 0).length;
    const nbBaisses = items.filter((a) => (a.perf_1j_pct ?? 0) < 0).length;
    let volume_jour = 0;
    let valeur_echangee_jour = 0;
    for (const a of items) {
      const v = volumesByCode.get(a.code);
      if (v) {
        volume_jour += v.volume;
        valeur_echangee_jour += v.valeur;
      }
    }
    out.push({
      secteur,
      nb_valeurs: items.length,
      nb_hausses: nbHausses,
      nb_baisses: nbBaisses,
      nb_inchanges: items.length - nbHausses - nbBaisses,
      capitalisation_totale: capSec,
      poids_marche_pct: poids,
      perf_1j_pct: perf1j,
      perf_1s_pct: perf1s,
      perf_1m_pct: perf1m,
      perf_ytd_pct: perfYtd,
      contribution_1j_pts: perf1j != null && capTotal > 0 ? round4((poids / 100) * perf1j) : null,
      contribution_1m_pts: perf1m != null && capTotal > 0 ? round4((poids / 100) * perf1m) : null,
      volume_jour,
      valeur_echangee_jour,
    });
  }
  return out.sort((a, b) => (a.contribution_1m_pts ?? 0) - (b.contribution_1m_pts ?? 0));
}

/**
 * Charge le Stock Resilience Scanner côté serveur (après `canAccess('stress_scanner')`).
 * Lit `stress_resilience_daily` via service_role, ou retombe sur un calcul
 * léger en direct depuis les tables déjà en base si `0277` n'est pas encore appliquée.
 */
export async function chargerResilienceScanner(): Promise<SyntheseResilience> {
  const sb = getServiceClient();

  // 1. Tenter lecture du dernier snapshot pré-calculé
  const latestSnap = await sb
    .from('stress_resilience_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);

  if (!latestSnap.error && latestSnap.data?.[0]?.date_marche) {
    const dateMarche = String(latestSnap.data[0].date_marche).slice(0, 10);
    const [snapRes, volRes] = await Promise.all([
      sb.from('stress_resilience_daily').select('*').eq('date_marche', dateMarche),
      sb
        .from('brvm_actions_daily')
        .select('code, volume, valeur_echangee')
        .eq('date_marche', dateMarche),
    ]);

    if (!snapRes.error && snapRes.data && snapRes.data.length > 0) {
      const actions = snapRes.data as ActionResilienceRow[];
      const volMap = new Map<string, { volume: number; valeur: number }>();
      for (const v of (volRes.data ?? []) as Array<{ code: string; volume: number | null; valeur_echangee: number | null }>) {
        volMap.set(v.code, {
          volume: Number(v.volume ?? 0),
          valeur: Number(v.valeur_echangee ?? 0),
        });
      }
      return {
        date_marche: dateMarche,
        source_mode: 'table_precalculee',
        nb_valeurs: actions.length,
        nb_decrochages_anormaux: actions.filter((a) => a.decrochage_anormal).length,
        nb_illiquides: actions.filter((a) => a.illiquide_flag).length,
        actions,
        secteurs: agregerSecteurs(actions, volMap),
      };
    }
  }

  // 2. Repli gracieux avant application de 0277 : calcul live sobre depuis tables existantes
  const { data: lastDateRow } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);

  const dateRef = (lastDateRow?.[0]?.date_marche as string | undefined)?.slice(0, 10) ?? null;
  if (!dateRef) {
    return {
      date_marche: null,
      source_mode: 'calcul_live',
      nb_valeurs: 0,
      nb_decrochages_anormaux: 0,
      nb_illiquides: 0,
      actions: [],
      secteurs: [],
    };
  }

  const depuis = new Date(Date.parse(`${dateRef}T00:00:00Z`) - 380 * 86_400_000).toISOString().slice(0, 10);
  const coursAll: Array<{
    code: string;
    date_marche: string;
    cours_jour: number | null;
    variation_pct: number | null;
    volume: number | null;
    valeur_echangee: number | null;
  }> = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour, variation_pct, volume, valeur_echangee')
      .gte('date_marche', depuis)
      .order('date_marche', { ascending: true })
      .order('code', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) break;
    const batch = (data ?? []) as typeof coursAll;
    coursAll.push(...batch);
    if (batch.length < PAGE) break;
  }

  const [{ data: instData }, { data: idxData }, { data: liqDateData }, { data: fundData }, { data: divData }] =
    await Promise.all([
      sb.from('brvm_instruments').select('code, designation, secteur, pays, famille_comptable, shares, actif').eq('type', 'action').eq('actif', true),
      sb.from('brvm_indices_daily').select('date_marche, valeur').eq('code', 'BRVMC').gte('date_marche', depuis).order('date_marche', { ascending: true }),
      sb.from('liquidity_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
      sb.from('fundamentals').select('code, year, revenue, net_income, equity, debt, cash').order('year', { ascending: false }).limit(250),
      sb.from('dividends').select('code, exercice, ex_date, montant, montant_brut, base_fiscale').order('exercice', { ascending: false }).limit(400),
    ]);

  const liqDate = (liqDateData?.[0]?.date_marche as string | undefined) ?? null;
  const { data: liqData } = liqDate
    ? await sb.from('liquidity_daily').select('code, score, classe, presence_pct, valeur_moyenne_30j, amihud, spread_pct, flux_net_pct').eq('date_marche', liqDate)
    : { data: [] };

  const liqMap = new Map(((liqData ?? []) as Array<Record<string, unknown>>).map((l) => [String(l.code), l]));
  const fundMap = new Map<string, Record<string, unknown>>();
  for (const f of (fundData ?? []) as Array<Record<string, unknown>>) {
    const code = String(f.code);
    if (!fundMap.has(code)) fundMap.set(code, f);
  }
  const divMap = new Map<string, Record<string, unknown>>();
  for (const d of (divData ?? []) as Array<Record<string, unknown>>) {
    const code = String(d.code);
    if (!divMap.has(code)) divMap.set(code, d);
  }

  const coursByCode = new Map<string, typeof coursAll>();
  const volMap = new Map<string, { volume: number; valeur: number }>();
  for (const c of coursAll) {
    const list = coursByCode.get(c.code) ?? [];
    list.push(c);
    coursByCode.set(c.code, list);
    if (String(c.date_marche).slice(0, 10) === dateRef) {
      volMap.set(c.code, { volume: Number(c.volume ?? 0), valeur: Number(c.valeur_echangee ?? 0) });
    }
  }

  // Perf 3M BRVMC
  const d3m = new Date(Date.parse(`${dateRef}T00:00:00Z`) - 91 * 86_400_000).toISOString().slice(0, 10);
  const idxRows = (idxData ?? []) as Array<{ date_marche: string; valeur: number }>;
  const idxFin = idxRows.at(-1);
  const idxDeb = [...idxRows].reverse().find((r) => String(r.date_marche).slice(0, 10) <= d3m);
  const perf3mIdx = idxFin && idxDeb && idxDeb.valeur > 0 ? round2(((idxFin.valeur / idxDeb.valeur) - 1) * 100) : null;

  const sectorOverride = brvmSectors as Record<string, string>;
  const actions: ActionResilienceRow[] = [];

  for (const inst of (instData ?? []) as Array<{
    code: string;
    designation: string;
    secteur: string | null;
    pays: string | null;
    famille_comptable: string | null;
    shares: number | null;
  }>) {
    const serie = (coursByCode.get(inst.code) ?? []).filter((c) => c.cours_jour != null && Number(c.cours_jour) > 0);
    const dern = serie.at(-1);
    const coursJour = dern ? Number(dern.cours_jour) : null;
    const shares = inst.shares != null ? Number(inst.shares) : null;
    const cap = coursJour != null && shares != null ? Math.round(coursJour * shares) : null;
    const secteur = sectorOverride[inst.code] ?? inst.secteur ?? 'Autre';
    const famille: FamilleComptable =
      inst.famille_comptable === 'banque' || inst.famille_comptable === 'assurance'
        ? inst.famille_comptable
        : 'general';

    const findNear = (daysAgo: number) => {
      const target = new Date(Date.parse(`${dateRef}T00:00:00Z`) - daysAgo * 86_400_000).toISOString().slice(0, 10);
      return [...serie].reverse().find((c) => String(c.date_marche).slice(0, 10) <= target) ?? null;
    };
    const pDiff = (base: (typeof serie)[number] | null) =>
      base && base.cours_jour && coursJour != null && Number(base.cours_jour) > 0
        ? round2(((coursJour / Number(base.cours_jour)) - 1) * 100)
        : null;

    const perf_1j_pct = dern?.variation_pct != null ? Number(dern.variation_pct) : null;
    const perf_5j_pct = pDiff(findNear(7));
    const perf_1m_pct = pDiff(findNear(30));
    const perf_3m_pct = pDiff(findNear(91));
    const perf_6m_pct = pDiff(findNear(182));
    const perf_1a_pct = pDiff(findNear(365));

    let sommet = -Infinity;
    let dateSommet: string | null = null;
    for (const c of serie.slice(-250)) {
      const v = Number(c.cours_jour);
      if (v > sommet) {
        sommet = v;
        dateSommet = String(c.date_marche).slice(0, 10);
      }
    }
    const drawdown_pct = coursJour != null && sommet > 0 ? round2(((coursJour / sommet) - 1) * 100) : null;
    const decrochage_relatif_pct = perf_3m_pct != null && perf3mIdx != null ? round2(perf_3m_pct - perf3mIdx) : null;
    const decrochage_anormal = decrochage_relatif_pct != null && decrochage_relatif_pct <= -8;

    const l = liqMap.get(inst.code);
    const f = fundMap.get(inst.code);
    const dv = divMap.get(inst.code);
    const rn = f?.net_income != null ? Number(f.net_income) : null;
    const eq = f?.equity != null ? Number(f.equity) : null;
    const per = rn != null && rn > 0 && cap != null ? round2(cap / rn) : null;
    const pbr = eq != null && eq > 0 && cap != null ? round2(cap / eq) : null;
    const roe = rn != null && eq != null && eq > 0 ? round2((rn / eq) * 100) : null;
    const divMontant = dv?.montant != null ? Number(dv.montant) : null;
    const divYield = divMontant != null && coursJour != null && coursJour > 0 ? round2((divMontant / coursJour) * 100) : null;

    const presence = l?.presence_pct != null ? Number(l.presence_pct) : null;
    const scoreLiq = l?.score != null ? Number(l.score) : null;
    const illiquide_flag = (presence != null && presence < 35) || (scoreLiq != null && scoreLiq < 25);

    const aRecents = f?.year != null && Number(f.year) >= 2024 && rn != null;
    const confiance = (aRecents ? 45 : 15) + (eq != null ? 15 : 0) + (scoreLiq != null ? 20 : 0) + (divMontant != null ? 15 : 0);
    const qScore = roe != null ? Math.min(100, Math.max(0, round2((roe / 22) * 100))) : null;
    const vScore = per != null && per > 0 ? Math.min(100, Math.max(0, round2(((22 - per) / 17) * 100))) : null;
    const dScore = divYield != null ? Math.min(100, Math.max(0, round2((divYield / 10) * 100))) : null;
    const rScore = drawdown_pct != null ? Math.min(100, Math.max(0, round2(100 + drawdown_pct * 2))) : null;
    const parts = [qScore, vScore, dScore, rScore, scoreLiq].filter((x): x is number => x != null);
    const rawScore = parts.length >= 2 ? round2(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
    const plafonne = !aRecents || confiance < 45;
    const score_opportunite = rawScore != null ? (plafonne ? Math.min(rawScore, 59) : rawScore) : null;

    const categorie =
      score_opportunite == null || (eq != null && eq <= 0)
        ? 'risque_eleve'
        : score_opportunite >= 72 && confiance >= 65 && !plafonne
          ? 'qualite_elevee'
          : score_opportunite >= 55 && confiance >= 45 && !plafonne
            ? 'potentiel_a_etudier'
            : score_opportunite >= 40
              ? 'vigilance'
              : 'risque_eleve';

    actions.push({
      code: inst.code,
      date_marche: dateRef,
      designation: inst.designation,
      secteur,
      pays: inst.pays,
      famille_comptable: famille,
      isin: null,
      date_introduction: null,
      capitalisation: cap,
      cours_jour: coursJour,
      perf_1j_pct,
      perf_5j_pct,
      perf_1m_pct,
      perf_3m_pct,
      perf_6m_pct,
      perf_ytd_pct: null,
      perf_1a_pct,
      perf_totale_1a_pct: null,
      perf_totale_ytd_pct: null,
      drawdown_pct,
      date_sommet: dateSommet,
      valeur_sommet: Number.isFinite(sommet) ? sommet : null,
      volatilite_ann_pct: null,
      beta: null,
      force_relative_pct: decrochage_relatif_pct,
      resistance_jours_baisse_pct: null,
      freq_seances_positives_pct: null,
      stabilite_volumes: null,
      decrochage_relatif_pct,
      alpha_anormal_pct: decrochage_relatif_pct,
      decrochage_anormal,
      explication_decrochage: {
        fenetre_debut: d3m,
        fenetre_fin: dateRef,
        perf_titre_pct: perf_3m_pct,
        perf_composite_pct: perf3mIdx,
        ecart_secteur_pct: null,
        facteurs_observes: [],
      },
      fondamentaux: {
        exercice: f?.year != null ? String(f.year) : null,
        age_annees: f?.year != null ? Math.max(0, Number(dateRef.slice(0, 4)) - Number(f.year)) : null,
        famille_comptable: famille,
        chiffre_affaires: f?.revenue != null ? Number(f.revenue) : null,
        resultat_exploitation: null,
        resultat_net: rn,
        capitaux_propres: eq,
        dette_totale: f?.debt != null ? Number(f.debt) : null,
        tresorerie: f?.cash != null ? Number(f.cash) : null,
        flux_tresorerie_libre: null,
        roe_pct: roe,
        roa_pct: null,
        marge_nette_pct: null,
        per,
        pbr,
        price_to_sales: null,
        ev_ebitda: null,
        gearing_pct: null,
        couverture_interets: null,
        pnb: null,
        coefficient_exploitation_pct: null,
        cout_du_risque: null,
        taux_creances_souffrance_pct: null,
        ratio_solvabilite_pct: null,
        per_median_secteur: null,
        pbr_median_secteur: null,
        croissance_rn_pct: null,
      },
      dividendes: {
        dernier_exercice: dv?.exercice != null ? Number(dv.exercice) : null,
        montant_net: divMontant,
        montant_brut: dv?.montant_brut != null ? Number(dv.montant_brut) : null,
        base_fiscale: dv?.base_fiscale === 'net' ? 'net' : dv?.base_fiscale === 'brut' ? 'brut' : 'inconnu',
        rendement_pct: divYield,
        taux_distribution_pct: null,
        annees_consecutives_5a: 0,
        derniere_ex_date: dv?.ex_date ? String(dv.ex_date).slice(0, 10) : null,
        croissance_div_pct: null,
      },
      liquidite: {
        score_v2: scoreLiq,
        classe: l?.classe ? String(l.classe) : null,
        presence_pct: presence,
        valeur_moyenne_30j: l?.valeur_moyenne_30j != null ? Number(l.valeur_moyenne_30j) : null,
        amihud: l?.amihud != null ? Number(l.amihud) : null,
        spread_pct: l?.spread_pct != null ? Number(l.spread_pct) : null,
        flux_net_pct: l?.flux_net_pct != null ? Number(l.flux_net_pct) : null,
        seances_cotees_60j: serie.slice(-60).length,
      },
      score_opportunite,
      score_confiance: confiance,
      sous_scores: {
        qualiteFinanciere: qScore,
        valorisation: vScore,
        dividendes: dScore,
        resilienceHistorique: rScore,
        liquidite: scoreLiq,
        momentumStabilisation: null,
        plafonne_par_confiance: plafonne,
      },
      categorie,
      classement_a_rang: null,
      classement_b_rang: null,
      classement_c_rang: null,
      illiquide_flag,
      anomalies_donnees: ['Mode calcul direct (snapshot 0277 non encore généré)'],
    });
  }

  // Classements live A / B / C
  actions
    .filter((a) => !a.illiquide_flag && a.drawdown_pct != null)
    .sort((a, b) => (b.drawdown_pct ?? -100) - (a.drawdown_pct ?? -100))
    .forEach((a, i) => { a.classement_a_rang = i + 1; });

  actions
    .filter((a) => (a.drawdown_pct ?? 0) <= -10 && (a.sous_scores.qualiteFinanciere ?? 0) >= 55 && a.score_confiance >= 50)
    .sort((a, b) => (b.score_opportunite ?? 0) - (a.score_opportunite ?? 0))
    .forEach((a, i) => { a.classement_b_rang = i + 1; });

  actions
    .filter((a) => a.drawdown_pct != null)
    .sort((a, b) => (a.drawdown_pct ?? 0) - (b.drawdown_pct ?? 0))
    .forEach((a, i) => { a.classement_c_rang = i + 1; });

  return {
    date_marche: dateRef,
    source_mode: 'calcul_live',
    nb_valeurs: actions.length,
    nb_decrochages_anormaux: actions.filter((a) => a.decrochage_anormal).length,
    nb_illiquides: actions.filter((a) => a.illiquide_flag).length,
    actions,
    secteurs: agregerSecteurs(actions, volMap),
  };
}
