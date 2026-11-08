import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { appelerJev } from '@/lib/jev/client';
import { contientDonneePersonnelle } from '@/lib/recherche/normaliser';
import { callAgentLlm, type ChatMessage } from '@/lib/whatsappAgent/callAgentLlm';
import {
  construireRequeteIntention,
  deciderIntention,
  lireExercice,
  lirePeriode,
  validerIntention,
  type IntentionDeterministe,
  type Voie,
} from '@/lib/analyseIA/intention';
import {
  gabaritActualites,
  gabaritComptes,
  gabaritConseil,
  gabaritCoursJour,
  gabaritDividendes,
  gabaritHistorique,
  gabaritLiquidite,
  gabaritTechnique,
} from '@/lib/analyseIA/gabarits';
import { dateDepuis } from '@/lib/analyseIA/historique';
import type { DepsAnalyse, ResultatLlmAnalyse } from '@/lib/analyseIA/orchestrer';
import type { EvenementFlux, SourceDonnee } from '@/lib/analyseIA/types';
import { lireActualites, lireComptes, lireCoursJour, lireDividendes, lireHistorique, lireIndicateurs, lireLiquidite, lirePublications, lireSeances } from './donnees';
import { etapeOutil, executerOutilAnalyse, OUTILS_ANALYSE, type Droits } from './outils';

/**
 * Branchement serveur d'« Analyse par IA » : Jev (TypeSafe), lecteurs de
 * données, cascade LLM à outils. Le cœur pur est lib/analyseIA/orchestrer.ts.
 *
 * REPLIS (choix du plus sûr) : sans clé TypeSafe, budget Jev épuisé ou
 * illisible, délai dépassé, réponse invalide ⇒ la question part à l'IA, dont
 * chaque chiffre est contrôlé. Jamais de réponse Jev sans classement Jev.
 */

const DELAI_JEV_MS = 6_000;
const ECHEANCE_IA_MS = 45_000;
const plafondJev = () => {
  const n = Number(process.env.ANALYSE_IA_JEV_PLAFOND_JOUR ?? 300);
  return Number.isInteger(n) && n >= 0 ? n : 300;
};

async function classerParJev(question: string, v: { code: string; nom: string | null }, journal: (e: string) => void): Promise<Voie> {
  const ia: Voie = { voie: 'ia' };
  if (!process.env.TYPESAFE_API_KEY) return ia;
  if (question.length < 3 || question.length > 500 || contientDonneePersonnelle(question)) return ia;
  // Compteur journalier partagé (table jev_budget, 0192) : RPC réservée au service_role, comme la recherche et WhatsApp.
  const { data: reserve, error } = await getServiceClient().rpc('jev_reserver_budget', { p_usage: 'fiche_analyse', p_plafond: plafondJev() });
  if (error || reserve !== true) {
    journal(error ? 'jev_compteur_indisponible' : 'jev_plafond_atteint');
    return ia;
  }
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), DELAI_JEV_MS);
  try {
    const brut = await appelerJev(construireRequeteIntention(question, v), ctrl.signal);
    const valide = validerIntention(brut);
    if (!valide) {
      journal('jev_reponse_invalide');
      return ia;
    }
    const d = deciderIntention(valide);
    journal(`jev_${valide.intention}_${d.voie}`);
    return d;
  } catch {
    journal('jev_indisponible');
    return ia;
  } finally {
    clearTimeout(minuterie);
  }
}

async function repondreParGabarit(
  db: SupabaseClient,
  v: { code: string; nom: string | null },
  droits: Droits,
  intention: IntentionDeterministe,
  question: string,
  aujourdhui: string,
): Promise<{ texte: string; sources: SourceDonnee[] } | null> {
  switch (intention) {
    case 'conseil':
      return { texte: gabaritConseil(v), sources: [] };
    case 'cours_jour': {
      const l = await lireCoursJour(db, v.code, v.nom);
      return { texte: gabaritCoursJour(v, l.donnees), sources: [l.source] };
    }
    case 'historique': {
      const p = lirePeriode(question);
      const jours = p?.jours ?? null;
      const l = await lireHistorique(db, v.code, dateDepuis(aujourdhui, jours));
      return { texte: gabaritHistorique(v, l.donnees, jours), sources: [l.source] };
    }
    case 'actualites': {
      const [a, p] = await Promise.all([lireActualites(db, v.code), lirePublications(db, v.code)]);
      return { texte: gabaritActualites(v, a.donnees, p.donnees), sources: [a.source, p.source] };
    }
    case 'dividendes': {
      const [d, c] = await Promise.all([lireDividendes(db, v.code), lireCoursJour(db, v.code, v.nom)]);
      const sources = [d.source];
      if (d.donnees.length > 0 && c.donnees?.cours != null) sources.push(c.source);
      return { texte: gabaritDividendes(v, d.donnees, c.donnees?.cours ?? null), sources };
    }
    case 'comptes': {
      // Réservé : l'IA prend le relais et dira que la donnée n'est pas disponible ici.
      if (!droits.fondamentaux) return null;
      const l = await lireComptes(db, v.code);
      return { texte: gabaritComptes(v, l.donnees, lireExercice(question)), sources: [l.source] };
    }
    case 'technique': {
      if (!droits.indicateurs) return null;
      const l = await lireIndicateurs(db, v.code, await lireSeances(db, v.code));
      return { texte: gabaritTechnique(v, l.donnees), sources: [l.source] };
    }
    case 'liquidite': {
      const l = await lireLiquidite(db, v.code);
      return { texte: gabaritLiquidite(v, l.donnees.mesure, l.donnees.carnet), sources: [l.source] };
    }
  }
}

export function depsAnalyse(
  db: SupabaseClient,
  v: { code: string; nom: string | null },
  droits: Droits,
  emettre: (e: EvenementFlux) => void,
): DepsAnalyse {
  const iso = new Date().toISOString().slice(0, 10);
  const echeance = Date.now() + ECHEANCE_IA_MS;
  const journal = (e: string) => console.warn('[analyse-ia]', e);
  return {
    aujourdhui: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    classer: (q) => classerParJev(q, v, journal),
    repondreJev: (intention, q) => repondreParGabarit(db, v, droits, intention, q, iso),
    llm: async (messages): Promise<ResultatLlmAnalyse> => {
      const retours: string[] = [];
      const sources: SourceDonnee[] = [];
      const texte = await callAgentLlm(
        messages as ChatMessage[],
        {
          definitions: OUTILS_ANALYSE,
          executer: async (nom, args) => {
            emettre({ type: 'etape', libelle: etapeOutil(nom) });
            const r = await executerOutilAnalyse(db, { ...v, droits, aujourdhui: iso }, nom, args);
            retours.push(JSON.stringify(r.resultat));
            if (r.source) sources.push(r.source);
            return r.resultat;
          },
        },
        { echeance },
      );
      return { texte, retours, sources };
    },
    emettre,
    journal,
  };
}
