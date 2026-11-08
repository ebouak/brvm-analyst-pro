import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resoudreCode, type DefinitionOutil } from '@/lib/agent/outils';
import { executerOutilChatbot } from '@/lib/agent/outilsChatbot';
import { dateDepuis } from '@/lib/analyseIA/historique';
import type { SourceDonnee } from '@/lib/analyseIA/types';
import {
  lireActualites,
  lireAnalysesEtArticles,
  lireCombinedAlpha,
  lireComptes,
  lireCoursJour,
  lireDividendes,
  lireEvenements,
  lireHistorique,
  lireIndicateurs,
  lireLiquidite,
  lireNotation,
  lirePublications,
  lireSignaux,
  type Lu,
} from './donnees';

/**
 * Outils de l'IA d'« Analyse par IA » (fiche action). LECTURE SEULE, client
 * soumis à la RLS. Ils couvrent tout l'historique enregistré pour la valeur ;
 * `fiche_societe` est repris tel quel de l'assistant WhatsApp.
 * Les données payantes de la fiche restent derrière les mêmes droits que la
 * page (signaux, indicateurs, fondamentaux) : un refus devient une `erreur`.
 */

export interface Droits {
  signaux: boolean;
  indicateurs: boolean;
  fondamentaux: boolean;
}

const CODE = { code: { type: 'string', description: 'Code BRVM ou nom de la société. Facultatif : par défaut, la valeur de la fiche.' } };
const outil = (name: string, description: string, properties: DefinitionOutil['function']['parameters']['properties'] = CODE): DefinitionOutil => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required: [] } },
});

export const OUTILS_ANALYSE: DefinitionOutil[] = [
  outil('cours_seance', 'Cours de clôture, variation, cours précédent, volume et capitaux échangés de la dernière séance.'),
  outil(
    'historique_cours',
    "Résumé de l'historique de cours sur TOUTE la période enregistrée (ou sur les N derniers jours) : début, fin, variation, plus haut et plus bas datés, volume moyen, découpage par année, plus fortes séances de hausse et de baisse, dix dernières séances.",
    { ...CODE, jours: { type: 'string', description: 'Profondeur en jours calendaires (7, 30, 90, 365…). Vide : tout l’historique.' } },
  ),
  outil('indicateurs_techniques', 'RSI 14, MACD (12, 26, 9) et moyennes mobiles 20 et 50 séances, recalculés sur les clôtures enregistrées.'),
  outil('comptes_annuels', "Comptes annuels publiés de TOUS les exercices enregistrés : chiffre d'affaires, résultat d'exploitation, résultat net, total du bilan, capitaux propres, dette financière, trésorerie (FCFA)."),
  outil('dividendes', 'Tous les dividendes vérifiés : exercice, montant par action, base fiscale (net ou brut), dates de détachement et de paiement.'),
  outil('publications_et_actualites', 'Publications officielles de la société (états financiers, communiqués) et actualités enregistrées, les plus récentes d’abord.'),
  outil('evenements_societe', 'Événements de marché de la société (assemblées, résultats, dividendes, opérations sur titres), passés et annoncés.'),
  outil('signaux', 'Signaux du moteur WESTBOURSE des dernières séances, avec score, sous-scores, confiance et explication.'),
  outil('liquidite_et_carnet', "Mesure de liquidité (score, classe, présence, capitaux moyens, fourchette) et carnet d'ordres publié par la BRVM sur les dernières séances."),
  outil('combined_alpha', 'Dernier score Combined Alpha (modèle quantitatif WESTBOURSE) : score, piliers, rang, classification, confiance.'),
  outil('notation', 'Notation financière (agences de notation) enregistrée pour la société.'),
  outil('analyses_et_articles', 'Analyses hebdomadaires et articles publiés par WESTBOURSE qui citent la valeur.'),
  outil('fiche_societe', 'Fiche de la société : secteur, pays, plage 52 semaines, derniers comptes, BPA et dividende par action recoupés, PER, liquidité, performance sur 12 mois.'),
];

const LIBELLES_ETAPE: Record<string, string> = {
  cours_seance: 'Lecture de la dernière séance…',
  historique_cours: 'Lecture de tout l’historique des cours…',
  indicateurs_techniques: 'Calcul des indicateurs techniques…',
  comptes_annuels: 'Lecture des comptes annuels…',
  dividendes: 'Lecture des dividendes…',
  publications_et_actualites: 'Lecture des publications et actualités…',
  evenements_societe: 'Lecture des événements…',
  signaux: 'Lecture des signaux…',
  liquidite_et_carnet: 'Lecture de la liquidité et du carnet…',
  combined_alpha: 'Lecture du Combined Alpha…',
  notation: 'Lecture de la notation…',
  analyses_et_articles: 'Lecture des analyses et articles…',
  fiche_societe: 'Lecture de la fiche société…',
};

export const etapeOutil = (nom: string) => LIBELLES_ETAPE[nom] ?? 'Recherche des données…';

const reserve = (quoi: string) => ({ erreur: `${quoi} : réservé à l’abonnement qui donne accès à cette section de la fiche. Non disponible ici.` });

/**
 * Exécute un outil et rend { resultat, source }. Ne lève jamais : une erreur
 * devient un objet `erreur` que le modèle restitue honnêtement.
 */
export async function executerOutilAnalyse(
  db: SupabaseClient,
  ctx: { code: string; nom: string | null; droits: Droits; aujourdhui: string },
  nom: string,
  args: Record<string, unknown>,
): Promise<{ resultat: unknown; source: SourceDonnee | null }> {
  try {
    const saisie = typeof args.code === 'string' && args.code.trim() ? args.code.trim() : ctx.code;
    const code = saisie.toUpperCase() === ctx.code ? ctx.code : await resoudreCode(db, saisie);
    if (!code) return { resultat: { erreur: `Aucune valeur cotée ne correspond à « ${saisie} ».` }, source: null };
    const nomValeur = code === ctx.code ? ctx.nom : null;
    const rendre = <T>(lu: Lu<T>, vide: (d: T) => boolean) => ({
      resultat: vide(lu.donnees) ? { code, donnees: null, message: 'Non disponible sur WESTBOURSE.' } : { code, ...{ donnees: lu.donnees } },
      source: { ...lu.source, libelle: code === ctx.code ? lu.source.libelle : `${lu.source.libelle} · ${code}` },
    });
    const vide = (d: unknown) => d == null || (Array.isArray(d) && d.length === 0);

    switch (nom) {
      case 'cours_seance':
        return rendre(await lireCoursJour(db, code, nomValeur), vide);
      case 'historique_cours': {
        const j = Number(args.jours);
        const jours = Number.isFinite(j) && j > 0 ? Math.min(Math.round(j), 20_000) : null;
        return rendre(await lireHistorique(db, code, dateDepuis(ctx.aujourdhui, jours)), vide);
      }
      case 'indicateurs_techniques':
        if (!ctx.droits.indicateurs) return { resultat: reserve('Indicateurs techniques'), source: null };
        return rendre(await lireIndicateurs(db, code), vide);
      case 'comptes_annuels':
        if (!ctx.droits.fondamentaux) return { resultat: reserve('Comptes et fondamentaux'), source: null };
        return rendre(await lireComptes(db, code), vide);
      case 'dividendes':
        return rendre(await lireDividendes(db, code), vide);
      case 'publications_et_actualites': {
        const [p, a] = await Promise.all([lirePublications(db, code), lireActualites(db, code)]);
        return {
          resultat: { code, publications: p.donnees, actualites: a.donnees, message: p.donnees.length + a.donnees.length === 0 ? 'Aucune publication ni actualité enregistrée.' : undefined },
          source: { libelle: code === ctx.code ? 'Publications et actualités' : `Publications et actualités · ${code}`, date: [p.source.date, a.source.date].filter(Boolean).sort().pop() ?? null },
        };
      }
      case 'evenements_societe':
        return rendre(await lireEvenements(db, code), vide);
      case 'signaux':
        if (!ctx.droits.signaux) return { resultat: reserve('Signaux'), source: null };
        return rendre(await lireSignaux(db, code), (d) => d.signaux.length === 0);
      case 'liquidite_et_carnet':
        return rendre(await lireLiquidite(db, code), (d) => !d.mesure && !d.carnet);
      case 'combined_alpha':
        return rendre(await lireCombinedAlpha(db, code), vide);
      case 'notation':
        return rendre(await lireNotation(db, code), vide);
      case 'analyses_et_articles':
        return rendre(await lireAnalysesEtArticles(db, code), (d) => d.analyses_hebdo.length + d.articles.length === 0);
      case 'fiche_societe': {
        const r = (await executerOutilChatbot(db, null, false, 'fiche_societe', { code })) as { seance?: string | null };
        return { resultat: r, source: { libelle: code === ctx.code ? 'Fiche société' : `Fiche société · ${code}`, date: r?.seance ?? null } };
      }
      default:
        return { resultat: { erreur: `Outil inconnu : ${nom}` }, source: null };
    }
  } catch (e) {
    console.error('[analyse-ia/outils]', nom, (e as Error).message);
    return { resultat: { erreur: 'Donnée temporairement indisponible.' }, source: null };
  }
}
