/**
 * Calcul d'une simulation de leçon avec ses paramètres PAR DÉFAUT — fonction
 * pure, utilisée par le test « chaque simulation de chaque leçon se calcule »
 * (contenus/simulations-contenus.test.ts) : une hypothèse impossible écrite
 * dans un JSON de leçon échoue en test, pas devant le lecteur.
 *
 * `serie` : clôtures réelles pour `technique` (en test, une série synthétique).
 * Le mode « données réelles » de `per` / `pb_roe` n'est pas exercé ici.
 */
import type { Simulation } from './types';
import { capitalPourObjectif, simulerReinvestissement } from './simulations';
import { executerOrdre } from './carnet';
import { analyserAllocation, simulerScenario } from './allocation';
import {
  calculerBanque,
  calculerChange,
  calculerCroissance,
  calculerEndettement,
  calculerRoeMoyen,
  calculerDistribution,
  calculerDps,
  calculerFrais,
  calculerObligation,
  calculerOpcvm,
  calculerPbRoe,
  calculerPer,
  calculerPosition,
  calculerRendementNet,
  calculerRendementTotal,
  calculerSouscription,
  calculerValeurFuture,
} from './simulateurs';
import { atelierMacd, lectureMacd, lectureMoyennes, lectureRsi, lectureVariation, lireBougie, moyenneGlissante, rsiPasAPas, type PointSerie } from './simTechnique';
import { lireFigureFictive, lireSeances } from './figuresBougies';

export function calculerSimulation(sim: Simulation, serie: PointSerie[] = []): { lecture: string; alertes: string[] } {
  switch (sim.type) {
    case 'reinvestissement': {
      const l = simulerReinvestissement(sim).at(-1)!;
      return { lecture: `Revenu final réinvesti : ${l.revenuReinvest}`, alertes: [] };
    }
    case 'objectif':
      return { lecture: capitalPourObjectif(sim.revenu_cible, sim.rendements_pct).map((x) => x.capital).join(' / '), alertes: [] };
    case 'carnet': {
      const r = executerOrdre(sim.niveaux, { sens: 'achat', quantite: sim.quantite_defaut, limite: 'au_mieux', condition: 'sans', validite: 'jour' });
      return { lecture: r.explication, alertes: [] };
    }
    case 'allocation': {
      const a = analyserAllocation(sim.secteurs, sim.capital, sim.seuil_secteur_pct);
      return { lecture: `Total ${a.totalPct}`, alertes: a.alertes.map((x) => x.message) };
    }
    case 'scenario_baisse': {
      const r = simulerScenario({ capital: sim.capital, rendement_pct: sim.rendement_pct, lignes: sim.secteurs }, { type: 'marche', baisse_pct: 10 });
      return { lecture: `Capital après : ${r.capitalApres}`, alertes: [] };
    }
    case 'frais_ordre':
      return calculerFrais(sim);
    case 'rendement_total':
      return calculerRendementTotal(sim);
    case 'valeur_future':
      return calculerValeurFuture(sim);
    case 'per':
      return calculerPer(sim);
    case 'pb_roe': {
      const r = calculerPbRoe(sim.societes);
      return { lecture: r.map((x) => x.lecture).join(' '), alertes: [] };
    }
    case 'banque':
      return calculerBanque(sim);
    case 'dps':
      return calculerDps(sim);
    case 'rendement_net':
      return calculerRendementNet(sim);
    case 'obligation':
      return calculerObligation(sim);
    case 'opcvm_frais':
      return calculerOpcvm(sim);
    case 'position':
      return calculerPosition(sim);
    case 'souscription_ipo':
      return calculerSouscription(sim);
    case 'distribution':
      return calculerDistribution(sim);
    case 'change':
      return calculerChange(sim);
    case 'chandelier':
      return lireBougie(sim);
    case 'bougies':
      return lireSeances(serie.slice(-sim.seances).map((p) => ({
        date: p.date, ouverture: p.ouverture ?? null, haut: p.haut ?? null, bas: p.bas ?? null, cloture: p.cours, volume: p.volume ?? null,
      })));
    case 'figure_bougies':
      return lireFigureFictive(sim.bougies);
    case 'moyenne_glissante':
      return moyenneGlissante(sim.clotures, sim.periode);
    case 'rsi_pas_a_pas':
      return rsiPasAPas(sim.clotures, sim.periode);
    case 'atelier_macd':
      return atelierMacd(sim.clotures, sim.rapide, sim.lente, sim.signal);
    case 'croissance':
      return calculerCroissance(sim);
    case 'endettement':
      return calculerEndettement(sim);
    case 'roe_moyen':
      return calculerRoeMoyen(sim);
    case 'technique':
      if (sim.indicateur === 'variation') return lectureVariation(serie);
      if (sim.indicateur === 'moyennes') return lectureMoyennes(serie, sim.courte, sim.longue, sim.methode);
      if (sim.indicateur === 'rsi') return lectureRsi(serie, sim.periode, sim.seuil_haut, sim.seuil_bas);
      return lectureMacd(serie, sim.rapide, sim.lente, sim.signal);
  }
}
