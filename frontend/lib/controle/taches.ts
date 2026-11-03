/**
 * Tour de contrôle — domaine « tâches » (PUR, testé).
 *
 * Deux sources : la photo horaire des workflows GitHub (`ops_workflows`,
 * collectée par ops-controle.yml) et le journal des commandes du scraper
 * (`scraper_runs`, 24 h).
 *
 * Ce module dit si les tâches TOURNENT : planifiées, actives, dans les temps,
 * sans échec. Il ne dit pas si elles ont PRODUIT quelque chose — un workflow
 * vert ne prouve pas qu'un message est parti (CLAUDE.md §9). Cette preuve-là
 * appartient aux domaines « envois » et « données ».
 */
import { dernierDeclenchementAvant, intervalleMaxAttenduMs } from './cron';
import type { Niveau, Signal } from './types';

export type EtatWorkflow = 'active' | 'disabled_manually' | 'disabled_inactivity' | 'deleted' | 'autre';

/** Une ligne de `public.ops_workflows`, colonnes à l'identique. */
export interface LigneWorkflow {
  fichier: string;
  nom: string | null;
  etat: EtatWorkflow;
  /** Expressions cron UTC du bloc `schedule` ; vide si le workflow n'est pas planifié. */
  crons: string[];
  dernier_run_id: number | null;
  dernier_evenement: string | null;
  dernier_statut: string | null;
  derniere_conclusion: string | null;
  dernier_debut: string | null;
  derniere_fin: string | null;
  dernier_url: string | null;
  dernier_succes_at: string | null;
  echecs_consecutifs: number;
  collecte_at: string | null;
}

export interface DonneesTaches {
  workflows: LigneWorkflow[];
  /** Collecte la plus récente (max de `collecte_at`), null si la table est vide. */
  collecteAt: string | null;
  scraperRuns24h: {
    total: number;
    echecs: number;
    dernierEchec: string | null;
    /** Runs `partial` sur 24 h : ni un échec franc, ni un succès complet. */
    partiels: number;
    /** Runs restés `running` plus de 2 h, SANS borne de 24 h : un job tué ne se termine jamais. */
    bloques: { total: number; plusAncien: string | null };
    /** Commandes non entièrement réussies sur 24 h : quoi réparer. */
    commandes: { code: string; echecs: number; partiels: number }[];
  };
}

const MIN = 60_000;
const H = 60 * MIN;
const J = 24 * H;

/** Au-delà, la photo des workflows ne décrit plus l'état présent. */
const COLLECTE_MAX_MS = 2 * H;
/**
 * Marge accordée à GitHub avant de dire qu'un passage planifié manque : ses
 * crons partent souvent en retard (mesuré le 2026-11-02 : alerts.yml et
 * video-seance.yml prévus vers 16:30 UTC, partis vers 23:40). Bornée à deux
 * intervalles pour les crons fréquents (*\/15 → 30 min, horaire → 2 h).
 */
const MARGE_RETARD_MAX_MS = 8 * H;
/**
 * Plancher de la marge : GitHub saute aussi des passages HORAIRES sous charge
 * (bienvenue.yml, forum-trending.yml le 2026-11-03). L'intraday, lui, reste
 * surveillé à 45 min par le domaine « données ».
 */
const MARGE_RETARD_MIN_MS = 3 * H;
const EN_COURS_MAX_MS = 2 * H;
const ECHEC_MANUEL_RECENT_MS = 7 * J;
const STATUTS_EN_COURS = new Set(['in_progress', 'queued', 'waiting', 'pending', 'requested']);

const RANG: Record<Niveau, number> = { alerte: 0, inconnu: 1, attention: 2, ok: 3, na: 4 };
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** « mar. 3 nov. 16:30 UTC » : l'horaire PRÉVU d'un passage, sans ambiguïté de fuseau. */
function horaire(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${JOURS_COURTS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_COURTS[d.getUTCMonth()]} ${hh}:${mm} UTC`;
}
const DEPOT = 'https://github.com/ebouak/brvm-analyst-pro';
const pire = (a: Niveau, b: Niveau): Niveau => (RANG[a] <= RANG[b] ? a : b);

/** « il y a 5 min », « il y a 3 h », « il y a 2 j ». */
export function relatif(iso: string, maintenant: Date): string {
  const ecart = maintenant.getTime() - new Date(iso).getTime();
  if (ecart < MIN) return "à l'instant";
  if (ecart < H) return `il y a ${Math.floor(ecart / MIN)} min`;
  if (ecart < 48 * H) return `il y a ${Math.floor(ecart / H)} h`;
  return `il y a ${Math.floor(ecart / J)} j`;
}

function duree(ms: number): string {
  if (ms < H) return `${Math.round(ms / MIN)} min`;
  if (ms < 48 * H) {
    const h = Math.floor(ms / H);
    const m = Math.round((ms - h * H) / MIN);
    return m ? `${h} h ${m}` : `${h} h`;
  }
  return `${Math.round(ms / J)} j`;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const titreDe = (w: LigneWorkflow) => w.nom?.trim() || w.fichier;
const ageMs = (iso: string | null, maintenant: Date) => (iso ? maintenant.getTime() - new Date(iso).getTime() : null);
/** Aligné sur `ECHECS` de scraper/src/ops/workflows.ts (qui calcule echecs_consecutifs). */
const CONCLUSIONS_ECHEC = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
const enEchec = (c: string | null) => c !== null && CONCLUSIONS_ECHEC.has(c);
const LIBELLE_ECHEC: Record<string, string> = {
  failure: 'en échec',
  timed_out: 'a dépassé son délai',
  startup_failure: 'n’a pas pu démarrer (fichier du workflow invalide ?)',
  action_required: 'attend une validation',
};

interface Constat {
  niveau: Niveau;
  texte: string;
}

/** Les constats d'un workflow planifié et actif ; vide s'il est sain. */
function constatsPlanifie(w: LigneWorkflow, maintenant: Date): Constat[] {
  const constats: Constat[] = [];
  const quand = w.dernier_debut ? ` (${relatif(w.dernier_debut, maintenant)})` : '';

  // Le compteur d'échecs fait foi, quel que soit le DERNIER run : un run en
  // cours ou annulé après cinq échecs ne doit pas les faire disparaître
  // (faux « à jour » relevé en relecture le 2026-11-03).
  const quoi = w.derniere_conclusion ? LIBELLE_ECHEC[w.derniere_conclusion] : undefined;
  if (w.echecs_consecutifs >= 2) {
    constats.push({
      niveau: 'alerte',
      texte: `${w.echecs_consecutifs} échecs consécutifs depuis le dernier succès${quoi ? `, dernier run ${quoi}` : ''}${quand}.`,
    });
  } else if (w.echecs_consecutifs === 1 || enEchec(w.derniere_conclusion)) {
    constats.push({ niveau: 'attention', texte: `Dernier run ${quoi ?? 'en échec'}${quand}.` });
  } else if (w.derniere_conclusion === 'cancelled') {
    constats.push({ niveau: 'attention', texte: `Dernier run annulé${quand}.` });
  }

  const age = ageMs(w.dernier_debut, maintenant);
  if (w.dernier_statut && STATUTS_EN_COURS.has(w.dernier_statut) && age !== null && age > EN_COURS_MAX_MS) {
    constats.push({ niveau: 'attention', texte: `Run en cours depuis ${duree(age)} sans se terminer.` });
  }

  const intervalle = intervalleMaxAttenduMs(w.crons, maintenant);
  if (intervalle === null) {
    constats.push({ niveau: 'inconnu', texte: `Planification illisible (${w.crons.join(' ; ')}) : le retard ne peut pas être évalué.` });
  } else if (age === null) {
    // « Aucun run connu » ne prouve pas qu'un passage a été manqué : le
    // workflow peut être neuf (eval-signaux.yml, créé avant son premier samedi).
    constats.push({
      niveau: 'inconnu',
      texte: 'À qualifier — workflow planifié, aucune exécution retrouvée. Vérifier sa date d’activation et son premier passage attendu.',
    });
  } else {
    // Le dernier passage planifié assez ancien pour que GitHub ait dû le lancer.
    // Comparer au prochain écart MAXIMAL (72 h pour un cron lun-ven) laissait
    // une panne du mardi invisible jusqu'au mardi suivant.
    const marge = Math.min(MARGE_RETARD_MAX_MS, Math.max(MARGE_RETARD_MIN_MS, 2 * intervalle));
    const du = dernierDeclenchementAvant(w.crons, new Date(maintenant.getTime() - marge));
    if (du && new Date(w.dernier_debut!).getTime() < du.getTime()) {
      // On dit ce que l'on SAIT : aucune exécution observée, pas « n'a pas eu lieu ».
      constats.push({
        niveau: 'attention',
        texte: `Aucune exécution observée pour le passage prévu ${horaire(du)}, après une tolérance de ${duree(marge)} ; dernière exécution observée ${relatif(w.dernier_debut!, maintenant)}.`,
      });
    }
  }
  return constats;
}

function signalWorkflow(w: LigneWorkflow, niveau: Niveau, detail: string): Signal {
  return {
    id: `taches:${w.fichier}`,
    domaine: 'taches',
    titre: titreDe(w),
    niveau,
    detail,
    dernierSucces: w.dernier_succes_at,
    lien: w.dernier_url,
    // Tentative et succès sont deux faits distincts : on les nomme tous deux.
    reperes: [
      ...(w.dernier_debut ? [{ libelle: 'Dernière exécution', date: w.dernier_debut, nature: 'instant' as const }] : []),
      ...(w.dernier_succes_at ? [{ libelle: 'Dernière exécution réussie', date: w.dernier_succes_at, nature: 'instant' as const }] : []),
    ],
    // Liens seulement : relancer se décide sur GitHub, après lecture du journal.
    actions: [
      ...(w.dernier_url ? [{ libelle: 'Journal du dernier run', href: w.dernier_url }] : []),
      ...(w.fichier.endsWith('.yml') ? [{ libelle: 'Historique / relancer sur GitHub', href: `${DEPOT}/actions/workflows/${w.fichier}` }] : []),
    ],
  };
}

function evaluerWorkflows(workflows: LigneWorkflow[], maintenant: Date): Signal[] {
  const signaux: Signal[] = [];
  // Un fichier supprimé du dépôt l'a été exprès : ni alerte, ni retard.
  const presents = workflows.filter((w) => w.etat !== 'deleted');
  const planifies = presents.filter((w) => w.crons.length > 0);
  const manuels = presents.filter((w) => w.crons.length === 0);

  let sains = 0;
  for (const w of planifies) {
    if (w.etat !== 'active') {
      const detail =
        w.etat === 'disabled_inactivity'
          ? 'Désactivé par GitHub après 60 jours sans activité du dépôt : ne tournera plus tant qu’il n’est pas réactivé.'
          : w.etat === 'disabled_manually'
            ? 'Désactivé à la main : ne tournera plus tant qu’il n’est pas réactivé.'
            : `État « ${w.etat} » : ne tournera plus tant qu’il n’est pas actif.`;
      signaux.push(signalWorkflow(w, 'alerte', detail));
      continue;
    }
    const constats = constatsPlanifie(w, maintenant);
    if (constats.length === 0) {
      sains++;
      continue;
    }
    const niveau = constats.map((c) => c.niveau).reduce(pire);
    signaux.push(signalWorkflow(w, niveau, constats.map((c) => c.texte).join(' ')));
  }

  if (sains > 0) {
    signaux.push({
      id: 'taches:planifies',
      domaine: 'taches',
      titre: 'Workflows planifiés',
      niveau: 'ok',
      detail: `${sains} ${sains > 1 ? 'workflows planifiés à jour' : 'workflow planifié à jour'} : actifs, dans les temps, sans échec au dernier run.`,
    });
  }

  if (manuels.length > 0) {
    const echecs = manuels.filter((w) => {
      const age = ageMs(w.dernier_debut, maintenant);
      return enEchec(w.derniere_conclusion) && age !== null && age < ECHEC_MANUEL_RECENT_MS;
    });
    const base = `${pluriel(manuels.length, 'workflow')} sans planification (lancés à la main ou par un événement).`;
    signaux.push({
      id: 'taches:manuels',
      domaine: 'taches',
      titre: 'Workflows manuels',
      niveau: echecs.length > 0 ? 'attention' : 'ok',
      detail:
        echecs.length > 0
          ? `${base} Échec récent : ${echecs.map((w) => `${titreDe(w)} (${relatif(w.dernier_debut!, maintenant)})`).join(', ')}.`
          : base,
      lien: echecs.length === 1 ? echecs[0].dernier_url : null,
    });
  }
  return signaux;
}

function evaluerScraper(r: DonneesTaches['scraperRuns24h'], maintenant: Date): Signal {
  const base = { id: 'taches:scraper', domaine: 'taches' as const, titre: 'Commandes du scraper', lien: '/admin/scraping', dernierSucces: null };
  const actions = [{ libelle: 'Voir les exécutions et incidents', href: '/admin/scraping' }];
  if (r.total === 0) {
    return { ...base, niveau: 'attention', detail: 'Aucune exécution terminée enregistrée en 24 h : rien ne prouve que le scraper tourne.', actions };
  }
  const taux = r.echecs / r.total;
  const pct = (taux * 100).toFixed(1).replace('.', ',');
  let niveau: Niveau = r.echecs >= 3 || taux >= 0.25 ? 'alerte' : r.echecs >= 1 ? 'attention' : 'ok';
  // Convention de comptage, écrite : « échec » = statut failed ; « partielle »
  // = statut partial ; les deux sont DISJOINTS et tous deux dans le total.
  const nonReussies = r.echecs + r.partiels;
  let detail =
    nonReussies === 0
      ? `${pluriel(r.total, 'exécution')} en 24 h, toutes réussies.`
      : `${nonReussies} ${nonReussies > 1 ? 'exécutions' : 'exécution'} non entièrement réussie${nonReussies > 1 ? 's' : ''} sur ${r.total} en 24 h : ${pluriel(r.echecs, 'échec')} (${pct} %) et ${r.partiels} partielle${r.partiels > 1 ? 's' : ''}${r.dernierEchec ? ` ; dernier échec ${relatif(r.dernierEchec, maintenant)}` : ''}.`;
  if (r.partiels > 0) niveau = pire(niveau, 'attention');
  if (r.commandes.length > 0) {
    detail += ` Commandes concernées : ${r.commandes
      .map((c) => `${c.code} (${[c.echecs ? pluriel(c.echecs, 'échec') : '', c.partiels ? `${c.partiels} partielle${c.partiels > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')})`)
      .join(' ; ')}.`;
  }
  if (r.bloques.total > 0) {
    niveau = pire(niveau, 'attention');
    detail += ` ${r.bloques.total} ${r.bloques.total > 1 ? 'exécutions bloquées' : 'exécution bloquée'} « en cours » depuis plus de 2 h${
      r.bloques.plusAncien ? ` (la plus ancienne ${relatif(r.bloques.plusAncien, maintenant)})` : ''
    } : job tué sans avoir pu se clore.`;
  }
  return { ...base, niveau, detail, actions };
}

export function evaluerTaches(d: DonneesTaches, maintenant: Date): Signal[] {
  const ageCollecte = ageMs(d.collecteAt, maintenant);
  const perimee = ageCollecte === null || ageCollecte > COLLECTE_MAX_MS;

  let workflows = evaluerWorkflows(d.workflows, maintenant);
  const signaux: Signal[] = [];

  if (perimee) {
    signaux.push({
      id: 'taches:collecte',
      domaine: 'taches',
      titre: 'Collecte des workflows',
      niveau: 'inconnu',
      detail: d.collecteAt
        ? `Dernière collecte ${relatif(d.collecteAt, maintenant)} (ops-controle.yml, attendue chaque heure) : l’état des workflows n’est plus connu.`
        : 'Aucune collecte enregistrée (ops-controle.yml) : l’état des workflows n’est pas connu.',
    });
    // Une photo périmée ne permet ni un « ok », ni une alerte affirmée.
    const quand = d.collecteAt ? relatif(d.collecteAt, maintenant) : 'à une date inconnue';
    workflows = workflows.map((s) => ({ ...s, niveau: 'inconnu', detail: `Constat de la collecte ${quand}, non revérifié : ${s.detail}` }));
  }

  signaux.push(...workflows, evaluerScraper(d.scraperRuns24h, maintenant));
  return signaux;
}
