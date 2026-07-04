import type { Sgi } from './directory';
import type { SgiFrais } from './types';
import { calculerCoutSGI } from './calculateur';

/**
 * Moteur de choix SGI — scoring TRANSPARENT et explicable (convention
 * WESTBOURSE : jamais d'opinion inventée, chaque point est justifié par une
 * donnée réelle et les données manquantes sont dites manquantes, pas devinées).
 *
 * 5 critères, pondérés selon la priorité déclarée de l'investisseur :
 *   cout       — coût annuel simulé (calculerCoutSGI, bornes MAX prudentes)
 *   depot      — compatibilité capital / dépôt minimum
 *   pays       — proximité géographique (ou capacité distance pour la diaspora)
 *   autonomie  — indice de présence numérique OU réseau d'agences
 *   solidite   — adossement (Banque / Indépendante agréée / non vérifié)
 */

export interface ProfilInvestisseur {
  /** Code pays UEMOA (CI, SN…) ou 'DIASPORA' (hors UEMOA). */
  pays: string;
  /** Capital de départ envisagé, FCFA. */
  capital: number;
  /** Ordres (achats+ventes) prévus par an. */
  ordresParAn: number;
  autonomie: 'en_ligne' | 'accompagne';
  priorite: 'cout' | 'solidite' | 'proximite' | 'equilibre';
}

export interface CritereScore {
  cle: 'cout' | 'depot' | 'pays' | 'autonomie' | 'solidite';
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface SgiMatch {
  sgi: Sgi;
  frais: SgiFrais | null;
  score: number; // 0-100 arrondi
  criteres: CritereScore[];
  /** Coût annuel simulé (FCFA) — null si barème non publié. */
  coutAnnuel: number | null;
  coutPct: number | null;
  champsManquants: string[];
  alerteDepotMin: boolean;
}

const POIDS: Record<ProfilInvestisseur['priorite'], Record<CritereScore['cle'], number>> = {
  equilibre: { cout: 40, depot: 15, pays: 15, autonomie: 15, solidite: 15 },
  cout:      { cout: 55, depot: 15, pays: 10, autonomie: 10, solidite: 10 },
  solidite:  { cout: 25, depot: 15, pays: 10, autonomie: 15, solidite: 35 },
  proximite: { cout: 25, depot: 15, pays: 35, autonomie: 10, solidite: 15 },
};

const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/**
 * Score toutes les SGI pour un profil. Renvoie le classement décroissant.
 * Fonction pure, testable — aucune donnée inventée : une SGI sans barème
 * publié reçoit un score de coût NEUTRE (35 %) explicitement libellé.
 */
export function scorerSgi(directory: Sgi[], fraisList: SgiFrais[], profil: ProfilInvestisseur): SgiMatch[] {
  const poids = POIDS[profil.priorite];
  const fraisByNom = new Map(fraisList.map((f) => [f.sgiNom, f]));

  // Pré-calcul des coûts (pour normaliser le critère coût entre SGI à barème connu).
  const couts = new Map<string, ReturnType<typeof calculerCoutSGI>>();
  for (const s of directory) {
    const f = fraisByNom.get(s.nom);
    if (f) {
      couts.set(s.nom, calculerCoutSGI(f, { montant: profil.capital, nbOrdres: profil.ordresParAn, dureeAns: 1 }));
    }
  }
  const totaux = [...couts.values()].map((c) => c.total);
  const minCout = totaux.length > 0 ? Math.min(...totaux) : 0;
  const maxCout = totaux.length > 0 ? Math.max(...totaux) : 0;

  const matches: SgiMatch[] = directory.map((sgi) => {
    const frais = fraisByNom.get(sgi.nom) ?? null;
    const cout = couts.get(sgi.nom) ?? null;
    const criteres: CritereScore[] = [];
    let alerteDepotMin = false;

    // ── 1. Coût annuel simulé ──────────────────────────────────────────
    {
      const max = poids.cout;
      if (cout) {
        // Normalisation linéaire : le moins cher = 100 %, le plus cher = 15 %.
        const spread = maxCout - minCout;
        const ratio = spread > 0 ? 1 - (cout.total - minCout) / spread : 1;
        const points = max * (0.15 + 0.85 * ratio);
        const manque = cout.champsManquants.length > 0 ? ` (${cout.champsManquants.length} frais non publiés comptés à 0)` : '';
        criteres.push({
          cle: 'cout', label: 'Coût annuel estimé', points, max,
          detail: `≈ ${fmtFcfa(cout.total)}/an pour votre profil${manque}`,
        });
      } else {
        criteres.push({
          cle: 'cout', label: 'Coût annuel estimé', points: max * 0.35, max,
          detail: 'Barème non publié — score neutre prudent, demandez la grille à la SGI',
        });
      }
    }

    // ── 2. Dépôt minimum ───────────────────────────────────────────────
    {
      const max = poids.depot;
      const depot = frais?.depotMinimum ?? null;
      if (depot != null) {
        if (profil.capital >= depot) {
          criteres.push({ cle: 'depot', label: 'Dépôt minimum', points: max, max, detail: `Compatible (min. ${fmtFcfa(depot)})` });
        } else {
          alerteDepotMin = true;
          criteres.push({ cle: 'depot', label: 'Dépôt minimum', points: 0, max, detail: `⚠ Capital sous le minimum exigé (${fmtFcfa(depot)})` });
        }
      } else {
        criteres.push({ cle: 'depot', label: 'Dépôt minimum', points: max * 0.5, max, detail: `Non publié en chiffres — repère annuaire : ${sgi.depotMin}` });
      }
    }

    // ── 3. Proximité / distance ────────────────────────────────────────
    {
      const max = poids.pays;
      if (profil.pays === 'DIASPORA') {
        const points = sgi.siteWeb ? max * 0.8 : max * 0.3;
        criteres.push({
          cle: 'pays', label: 'Gestion à distance', points, max,
          detail: sgi.siteWeb
            ? 'Présence web (indice favorable) — confirmez la gestion à distance avant d’ouvrir'
            : 'Aucun site web relevé — dossier à distance incertain',
        });
      } else if (sgi.pays === profil.pays) {
        criteres.push({ cle: 'pays', label: 'Proximité', points: max, max, detail: 'SGI de votre pays de résidence' });
      } else {
        criteres.push({
          cle: 'pays', label: 'Proximité', points: max * 0.5, max,
          detail: 'Autre pays UEMOA — possible (marché régional unifié), moins pratique au quotidien',
        });
      }
    }

    // ── 4. Autonomie ───────────────────────────────────────────────────
    {
      const max = poids.autonomie;
      if (profil.autonomie === 'en_ligne') {
        const points = sgi.siteWeb ? (sgi.telephone ? max : max * 0.9) : max * 0.3;
        criteres.push({
          cle: 'autonomie', label: 'Autonomie numérique', points, max,
          detail: sgi.siteWeb
            ? 'Présence web relevée — exigez une démo de la plateforme d’ordres avant de signer'
            : 'Pas de site relevé — ordres probablement par téléphone/email',
        });
      } else {
        const points = sgi.type === 'Banque' ? max : sgi.type === 'Indépendante' ? max * 0.7 : max * 0.5;
        criteres.push({
          cle: 'autonomie', label: 'Accompagnement', points, max,
          detail:
            sgi.type === 'Banque'
              ? 'Adossée à un réseau bancaire (agences physiques)'
              : sgi.type === 'Indépendante'
                ? 'Maison indépendante — accompagnement souvent personnalisé'
                : 'Réseau d’accompagnement non vérifié',
        });
      }
    }

    // ── 5. Solidité / adossement ───────────────────────────────────────
    {
      const max = poids.solidite;
      const points = sgi.type === 'Banque' ? max : sgi.type === 'Indépendante' ? max * 0.65 : max * 0.4;
      criteres.push({
        cle: 'solidite', label: 'Adossement', points, max,
        detail:
          sgi.type === 'Banque'
            ? `Adossée à un groupe bancaire (${sgi.groupe})`
            : sgi.type === 'Indépendante'
              ? 'Indépendante agréée CREPMF (sans adossement bancaire)'
              : 'Adossement non vérifié (agrément BRVM confirmé)',
      });
    }

    const score = Math.round(criteres.reduce((acc, c) => acc + c.points, 0));
    return {
      sgi,
      frais,
      score,
      criteres,
      coutAnnuel: cout ? cout.total : null,
      coutPct: cout ? cout.pctCapital : null,
      champsManquants: cout ? cout.champsManquants : [],
      alerteDepotMin,
    };
  });

  // Classement : score décroissant ; à égalité, coût croissant (null en dernier).
  return matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.coutAnnuel == null) return 1;
    if (b.coutAnnuel == null) return -1;
    return a.coutAnnuel - b.coutAnnuel;
  });
}
