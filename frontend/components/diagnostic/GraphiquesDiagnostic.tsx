import 'server-only';
import type { ReactNode } from 'react';
import { createClient as createSbAdmin } from '@supabase/supabase-js';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import { calculateFundamentals } from '@/lib/financials/fundamentals';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';
import { computeDiagnosticMetrics } from '@/lib/diagnostic/metrics';
import { computeRedFlags } from '@/lib/diagnostic/redFlags';
import { chargerContexteQuant } from '@/lib/diagnostic/contexteQuant';
import { valoriser } from '@/lib/diagnostic/valorisation';
import { seriesAnnuelles, assez, type PointAnnuel } from '@/lib/diagnostic/series';
import { libelleAbsence, type ObsStatut } from '@/lib/bank/prudentiel';
import {
  Figure, Barres, Courbes, BarresH, Pairs, Fourchette, Jauge, CourbeCours,
  type Serie, type LignePair, type Ton,
} from './Graphiques';

/**
 * Graphiques du diagnostic, rangés par NUMÉRO DE SECTION du rapport
 * (prompt.ts : 1 synthèse, 3 rentabilité, 4 bilan, 5 liquidité ou flux,
 * 6 pairs, 7 valorisation, 8 dividende, 13 red flags).
 *
 * Mêmes lectures que la route /api/diagnostic : les graphiques montrent les
 * nombres que le modèle a reçus, jamais ceux qu'il a écrits. Un graphique sans
 * au moins deux points (ou une valeur, selon le cas) n'est pas tracé.
 */
export async function graphiquesParSection(code: string): Promise<Record<string, ReactNode>> {
  const admin = createSbAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const [data, contexte, coursRes, obsRes] = await Promise.all([
    loadCompanyFinancials(code),
    chargerContexteQuant(admin, code),
    admin.from('brvm_actions_daily').select('date_marche, cours_jour').eq('code', code)
      .order('date_marche', { ascending: false }).limit(260),
    admin.from('indicateur_source').select('date_arrete,statut,motif,comparateur,valeur')
      .eq('code', code).eq('indicateur', 'solvabilite_total'),
  ]);
  if (!data) return {};

  const famille = data.instrument.famille_comptable ?? FAMILLE_PAR_CODE[code] ?? 'general';
  const banque = famille === 'banque';
  const pts = seriesAnnuelles({ famille, income: data.incomeStatements, balance: data.balanceSheets, cashflow: data.cashFlowStatements });
  const annees = pts.map((p) => p.annee);
  const col = (cle: keyof PointAnnuel) => pts.map((p) => p[cle] as number | null);
  const SRC_ETATS = 'états financiers annuels publiés (BRVM), calculs WESTBOURSE';
  const sections: Record<string, ReactNode[]> = {};
  const ajouter = (s: string, n: ReactNode) => { (sections[s] ??= []).push(n); };

  const inc_n = data.incomeStatements[0] ?? null;
  const bal_n = data.balanceSheets[0] ?? null;
  const cours = data.latestDaily?.cours_jour ?? null;
  const actions = data.instrument.shares ?? inc_n?.actions_en_circulation ?? null;

  // ── 1. Synthèse : cours sur 12 mois, notes des piliers ─────────────────
  const historique = ((coursRes.data ?? []) as { date_marche: string; cours_jour: number | null }[])
    .filter((r) => r.cours_jour != null && r.cours_jour > 0)
    .map((r) => ({ date: r.date_marche, cours: r.cours_jour! }))
    .reverse();
  if (historique.length >= 20) {
    const bas = Math.min(...historique.map((p) => p.cours));
    const haut = Math.max(...historique.map((p) => p.cours));
    ajouter('1', (
      <Figure key="cours" titre="Cours de clôture sur les dernières séances"
        lecture={`Plus bas et plus haut de la période : ${bas.toLocaleString('fr-FR')} et ${haut.toLocaleString('fr-FR')} FCFA.`}
        source={`cours de clôture BRVM, ${historique.length} séances`}>
        <CourbeCours points={historique} resume={`Cours de ${code} sur ${historique.length} séances`} />
      </Figure>
    ));
  }
  const pil = contexte.piliers;
  if (pil) {
    const ton = (v: number | null): Ton => (v == null ? 'muted' : v >= 60 ? 'up' : v >= 40 ? 'warn' : 'down');
    const lignes = ([
      ['Note combinée', pil.combine], ['Valorisation', pil.valorisation], ['Qualité des résultats', pil.qualiteResultats],
      ['Solidité financière', pil.solidite], ['Dividende', pil.dividende], ['Momentum de cours', pil.momentum], ['Liquidité', pil.liquidite],
    ] as const).map(([libelle, valeur]) => ({ libelle, valeur, ton: ton(valeur), note: '/100' }));
    ajouter('1', (
      <Figure key="piliers" titre="Notes du modèle multifacteurs WESTBOURSE"
        lecture={`Classification « ${pil.classification} », confiance ${pil.confiance}.`}
        source={`modèle quant WESTBOURSE, calcul du ${pil.dateCalcul}`}>
        <BarresH lignes={lignes} max={100} format="note" resume="Notes des piliers sur 100" />
      </Figure>
    ));
  }

  // ── 3. Rentabilité ──────────────────────────────────────────────────────
  if (assez(pts, 'revenu') || assez(pts, 'resultatNet')) {
    ajouter('3', (
      <Figure key="revenu" titre={`${banque ? 'Produit net bancaire' : "Chiffre d'affaires"} et résultat net`}
        lecture="Comparer la progression des deux barres d'un exercice à l'autre." source={SRC_ETATS}>
        <Barres annees={annees} format="fcfa" resume="Revenus et résultat net par exercice"
          series={[{ nom: banque ? 'PNB' : "Chiffre d'affaires", ton: 'accent', valeurs: col('revenu') }, { nom: 'Résultat net', ton: 'up', valeurs: col('resultatNet'), negatifEnRouge: true }]} />
      </Figure>
    ));
  }
  const marges: Serie[] = banque
    ? [{ nom: "Coefficient d'exploitation (frais généraux / PNB)", ton: 'warn', valeurs: col('coefExploitation') },
       { nom: 'Marge nette (résultat net / PNB)', ton: 'up', valeurs: col('margeNette') }]
    : [{ nom: "Marge d'exploitation", ton: 'accent', valeurs: col('margeExploitation') },
       { nom: 'Marge nette', ton: 'up', valeurs: col('margeNette') }];
  if (marges.some((s) => s.valeurs.filter((v) => v != null).length >= 2)) {
    ajouter('3', (
      <Figure key="marges" titre={banque ? "Coefficient d'exploitation et marge nette" : 'Marges'}
        lecture={banque ? 'Un coefficient qui monte signifie que les charges croissent plus vite que le PNB.' : undefined} source={SRC_ETATS}>
        <Courbes annees={annees} series={marges} format="pct" resume="Évolution des marges en pourcentage" />
      </Figure>
    ));
  }
  if (assez(pts, 'roe') || assez(pts, 'roa')) {
    ajouter('3', (
      <Figure key="roe" titre="ROE et ROA" lecture="Résultat net rapporté aux capitaux propres et au total du bilan de fin d'exercice." source={SRC_ETATS}>
        <Courbes annees={annees} format="pct" resume="ROE et ROA par exercice"
          series={[{ nom: 'ROE', ton: 'accent', valeurs: col('roe') }, { nom: 'ROA', ton: 'warn', valeurs: col('roa') }]} />
      </Figure>
    ));
  }

  // ── 4. Bilan ────────────────────────────────────────────────────────────
  if (banque) {
    if (assez(pts, 'credits') || assez(pts, 'depots')) {
      ajouter('4', (
        <Figure key="cd" titre="Crédits et dépôts de la clientèle" source={SRC_ETATS}>
          <Barres annees={annees} format="fcfa" resume="Crédits et dépôts par exercice"
            series={[{ nom: 'Crédits à la clientèle', ton: 'accent', valeurs: col('credits') }, { nom: 'Dépôts de la clientèle', ton: 'up', valeurs: col('depots') }]} />
        </Figure>
      ));
    }
    if (assez(pts, 'transformation')) {
      ajouter('4', (
        <Figure key="transfo" titre="Taux de transformation (crédits / dépôts)" lecture="Au-dessus de 100 %, la banque prête plus qu'elle ne collecte." source={SRC_ETATS}>
          <Courbes annees={annees} format="pct" reference={{ valeur: 100, libelle: '100 %' }} resume="Crédits rapportés aux dépôts"
            series={[{ nom: 'Crédits / dépôts', ton: 'accent', valeurs: col('transformation') }]} />
        </Figure>
      ));
    }
    const lb = (bal_n?.lignes_specifiques ?? {}) as Record<string, number | null>;
    const solva = lb.ratio_solvabilite ?? null;
    const absence = solva == null ? libelleAbsence((obsRes.data ?? []) as ObsStatut[], bal_n?.periode) : null;
    ajouter('4', (
      <Figure key="solva" titre={`Ratio de solvabilité réglementaire${bal_n?.periode ? ` (exercice ${String(bal_n.periode).slice(0, 4)})` : ''}`}
        lecture="Fonds propres réglementaires rapportés aux actifs pondérés par leur risque." source="publications de la banque, observations sourcées WESTBOURSE">
        <Jauge valeur={solva} minimum={11.5} absence={absence} resume="Ratio de solvabilité face au minimum UEMOA" />
      </Figure>
    ));
  } else if (assez(pts, 'totalActifs') || assez(pts, 'capitauxPropres')) {
    ajouter('4', (
      <Figure key="bilan" titre="Total du bilan, capitaux propres et dettes financières" source={SRC_ETATS}>
        <Barres annees={annees} format="fcfa" resume="Structure du bilan par exercice"
          series={[{ nom: 'Total du bilan', ton: 'muted', valeurs: col('totalActifs') }, { nom: 'Capitaux propres', ton: 'up', valeurs: col('capitauxPropres') },
            { nom: 'Dettes financières', ton: 'warn', valeurs: col('dettesFinancieres') }]} />
      </Figure>
    ));
  }
  if (assez(pts, 'fondsPropresSurBilan')) {
    ajouter('4', (
      <Figure key="fp" titre="Capitaux propres / total du bilan"
        lecture={banque ? "Ce n'est pas le ratio de solvabilité réglementaire, qui pondère les actifs par leur risque." : undefined} source={SRC_ETATS}>
        <Courbes annees={annees} format="pct" resume="Part des capitaux propres dans le bilan"
          series={[{ nom: 'Capitaux propres / bilan', ton: 'up', valeurs: col('fondsPropresSurBilan') }]} />
      </Figure>
    ));
  }

  // ── 5. Liquidité (banque) ou flux (société générale) ───────────────────
  if (banque) {
    if (assez(pts, 'tresorerie')) {
      ajouter('5', (
        <Figure key="treso" titre="Trésorerie et équivalents" source={SRC_ETATS}>
          <Barres annees={annees} format="fcfa" resume="Trésorerie par exercice" series={[{ nom: 'Trésorerie', ton: 'accent', valeurs: col('tresorerie') }]} />
        </Figure>
      ));
    }
  } else if (assez(pts, 'fluxExploitation', 1)) {
    ajouter('5', (
      <Figure key="flux" titre="Flux de trésorerie" lecture="Une barre sous zéro est une sortie de trésorerie." source={SRC_ETATS}>
        <Barres annees={annees} format="fcfa" resume="Flux d'exploitation, d'investissement et de financement"
          series={[{ nom: 'Exploitation', ton: 'up', valeurs: col('fluxExploitation') }, { nom: 'Investissement', ton: 'warn', valeurs: col('fluxInvestissement') },
            { nom: 'Financement', ton: 'muted', valeurs: col('fluxFinancement') }]} />
      </Figure>
    ));
  }

  // ── 6. Comparaison aux pairs ────────────────────────────────────────────
  const lignesPairs: LignePair[] = (contexte.medianes?.lignes ?? [])
    .filter((l) => l.valeur != null && l.mediane != null && l.nbPairs >= 3)
    .map((l) => ({ libelle: l.libelle, unite: l.unite, valeur: l.valeur!, mediane: l.mediane!, nbPairs: l.nbPairs, lecture: l.lecture }));
  if (lignesPairs.length) {
    ajouter('6', (
      <Figure key="pairs" titre={`Position face aux médianes des pairs${contexte.medianes?.groupe ? ` — ${contexte.medianes.groupe}` : ''}`}
        lecture="Barre : la société. Trait vertical : la médiane. Vert favorable, rouge défavorable, bleu neutre ; chaque ligne a sa propre échelle."
        source="modèle quant WESTBOURSE (mêmes définitions pour toute la cote)">
        <Pairs lignes={lignesPairs} resume="Ratios de la société face aux médianes des pairs" />
      </Figure>
    ));
  }

  // ── 7. Valorisation ─────────────────────────────────────────────────────
  const v = valoriser({ famille, cours, actions, inc: inc_n, bal: bal_n, medianes: contexte.medianes?.lignes });
  if (v.methodes.length) {
    ajouter('7', (
      <Figure key="valo" titre="Fourchette de valorisation par méthode"
        lecture="Point : valeur centrale (k 13 %, g 3,5 %). Bande : k de 12 à 14 %, g de 3 à 4 %. Trait pointillé : le cours. Vert au-dessus du cours, rouge en dessous."
        source="calcul WESTBOURSE sur les états financiers publiés et les médianes des pairs">
        <Fourchette methodes={v.methodes} cours={cours} resume="Valeurs par action selon chaque méthode, face au cours" />
      </Figure>
    ));
  }

  // ── 8. Dividende ────────────────────────────────────────────────────────
  if (assez(pts, 'dpa', 1)) {
    ajouter('8', (
      <Figure key="dpa" titre="Dividende par action" source={SRC_ETATS}>
        <Barres annees={annees} format="fcfa_action" resume="Dividende par action par exercice" series={[{ nom: 'Dividende par action', ton: 'up', valeurs: col('dpa') }]} />
      </Figure>
    ));
  }
  if (assez(pts, 'distribution')) {
    ajouter('8', (
      <Figure key="payout" titre="Taux de distribution (dividende / bénéfice par action)"
        lecture="Au-dessus de 100 %, le dividende dépasse le bénéfice de l'exercice." source={SRC_ETATS}>
        <Courbes annees={annees} format="pct" reference={{ valeur: 100, libelle: '100 %' }} resume="Part du bénéfice distribuée"
          series={[{ nom: 'Taux de distribution', ton: 'accent', valeurs: col('distribution') }]} />
      </Figure>
    ));
  }

  // ── 13. Red flags ───────────────────────────────────────────────────────
  const inc_n1 = data.incomeStatements[1] ?? null;
  const bal_n1 = data.balanceSheets[1] ?? null;
  const cf_n = data.cashFlowStatements[0] ?? null;
  const cf_n1 = data.cashFlowStatements[1] ?? null;
  const ratios = calculateFundamentals({
    coursActuel: cours, shares: data.instrument.shares,
    cours_bas_52s: data.latestDaily?.cours_bas_52s ?? null, cours_haut_52s: data.latestDaily?.cours_haut_52s ?? null,
    income: inc_n, incomePrev: inc_n1, balance: bal_n, cashflow: cf_n,
  });
  const m = computeDiagnosticMetrics({ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, cours, capitalisation: ratios.capitalisation });
  const flags = computeRedFlags({ inc_n, inc_n1, bal_n, bal_n1, cf_n, cf_n1, m, famille });
  ajouter('13', (
    <Figure key="flags" titre="Contrôles d'alerte : sévérité sur 10"
      lecture="Une barre vide : contrôle non déclenché. « non applicable » ou « non évaluable » : hors du score."
      source="contrôles automatiques WESTBOURSE sur les états financiers">
      <BarresH max={10} format="note" resume="Sévérité de chaque contrôle d'alerte"
        lignes={flags.checks.map((c) => ({
          libelle: c.label,
          valeur: c.dataAvailable ? c.severity : null,
          ton: (c.severity >= 6 ? 'down' : c.severity >= 3 ? 'warn' : 'up') as Ton,
          note: c.dataAvailable ? '/10' : c.evidence.startsWith('Non applicable') ? 'non applicable' : 'non évaluable',
        }))} />
    </Figure>
  ));

  return Object.fromEntries(Object.entries(sections).map(([s, n]) => [s, <div key={s}>{n}</div>]));
}
