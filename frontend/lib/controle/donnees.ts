/**
 * Tour de contrôle — fraîcheur des données (domaine 'donnees', PUR, testé).
 *
 * On juge la DONNÉE produite, jamais la couleur d'un workflow : un run vert
 * n'a jamais prouvé qu'une ligne était arrivée (CLAUDE.md §9, sept semaines
 * sans e-mail sous un workflow vert).
 *
 * Règle générale des flux de séance : la BRVM cote du lundi au vendredi, mais
 * ses jours fériés ne sont connus qu'en partie (`market_calendar`). Un retard
 * d'UNE séance peut donc être un férié non déclaré → 'attention' ; deux
 * séances ou plus ne s'expliquent plus ainsi → 'alerte'.
 *
 * Heures de disponibilité (UTC, Abidjan = UTC), lues dans les crons :
 *  - cours de clôture et indices : 17 h — `daily-brvm.yml` / `daily.yml`
 *    consolident à 16:00 lun-ven (l'intraday écrit déjà la ligne du jour en
 *    séance, dernier passage 15:55) ; une heure de marge pour les crons
 *    GitHub retardés.
 *  - signaux et liquidité : 18 h — `score.yml` part à 16:00 (3 tentatives),
 *    la liquidité attend la fin du scoring ; `scrape-daily.yml` recalcule à
 *    18:00.
 *  - carnet d'ordres : 20 h — `carnet.yml` passe à 19:00, puis à 07:30 le
 *    lendemain (le bulletin paraît parfois seulement le jour suivant).
 *  - vidéo : 18 h — `video-seance.yml` part à 16:45 lun-ven.
 *  - séance intraday : `intraday.yml` tourne de 09:03 à 15:55 lun-ven ; la
 *    fenêtre jugée est 09:35 → 16:10, la même que le watchdog
 *    (`scraper/src/monitoring/fraicheurIntraday.ts`), pour laisser passer le
 *    premier et le dernier passage.
 *  - tests e2e : `e2e.yml`, chaque nuit à 03:00.
 */
import type { Niveau, Signal } from './types';
import { derniereSeanceAttendue, seancesDeRetard } from './seances';

export interface DonneesFraicheur {
  /** max(date_marche) de brvm_actions_daily (AAAA-MM-JJ), null si la table est vide. */
  coursCloture: string | null;
  /** max(date_marche) de brvm_indices_daily. */
  indices: string | null;
  /** v_fraicheur_cours.derniere_collecte_intraday : dernier passage intraday RÉUSSI (horodatage ISO). */
  collecteIntraday: string | null;
  /** max(date_marche) de signals_daily. */
  signaux: string | null;
  /** max(date_marche) de liquidity_daily. */
  liquidite: string | null;
  /** max(date_marche) de brvm_carnet_daily. */
  carnet: string | null;
  /** Champ `seance` de seance-video/derniere.json ; null si le fichier est absent ou incomplet. */
  video: string | null;
  /**
   * Calendrier officiel (dividends, source 'brvm-calendrier'). La table n'a
   * AUCUNE colonne de mise à jour : `runCalendrier` ne réécrit pas une ligne
   * concordante, et `created_at` garde la date de création par une autre
   * source (2026-09-08 pour toutes). On juge donc ce qui se prouve : le
   * nombre de lignes datées et la date du document BRVM d'où elles viennent.
   */
  calendrierDividendes: {
    /** Lignes datées (ex_date non nul) des deux derniers exercices — même compte que verify-data. */
    lignes: number;
    /** Exercice de la ligne la plus récente. */
    exercice: number | null;
    /** Date du document BRVM (préfixe AAAAMMJJ de source_url), AAAA-MM-JJ. */
    dateDocument: string | null;
  };
  /** max(fin_at) des passages e2e CI terminés (qa_runs). */
  testsE2e: string | null;
  /** Jours non ouvrés connus (market_calendar.is_trading_day = false), AAAA-MM-JJ. */
  feries: string[];
  /**
   * Fin (ISO) du dernier run RÉUSSI de la commande `daily` (scraper_runs) :
   * la consolidation de clôture. La ligne du jour de brvm_actions_daily ne la
   * prouve pas, l'intraday l'écrit dès 15:55 (relecture du 2026-11-03).
   */
  consolidationCloture: string | null;
}

/**
 * Attente de la consolidation : 23:30 UTC. Le cron `daily` part à 16:00 mais
 * GitHub l'a déjà retardé de plus de 7 h (succès mesuré à 23:39 le 2026-11-02).
 */
const H_CONSOLIDATION = 23.5;
/** Un run qui finit avant 16:00 est le passage du matin : il ne consolide pas la séance du jour. */
const DECALAGE_SEANCE_MS = 16 * 3600_000;

function clotureConsolidee(d: DonneesFraicheur, maintenant: Date): Signal {
  const titre = 'Clôture consolidée';
  const attendue = derniereSeanceAttendue(maintenant, H_CONSOLIDATION, d.feries);
  const c = d.consolidationCloture;
  if (!c) {
    return signal('cloture', titre, 'alerte', fin(`Aucune consolidation de clôture réussie connue (commande daily) ; séance attendue : ${jourFr(attendue)}`), null, '/admin/scraping');
  }
  // Séance couverte : date du run décalée de 16 h (un run de 00:10, retardé par
  // GitHub, couvre la veille ; un run de 09:20 couvre la séance précédente).
  const seance = new Date(new Date(c).getTime() - DECALAGE_SEANCE_MS).toISOString().slice(0, 10);
  const retard = seancesDeRetard(seance, attendue, d.feries);
  const niveau: Niveau = retard >= 2 ? 'alerte' : retard >= 1 ? 'attention' : 'ok';
  const faits = `dernière consolidation réussie : ${momentFr(c)} ; séance attendue : ${jourFr(attendue)}`;
  const detail =
    retard === 0
      ? fin(`Consolidée — ${faits}`)
      : `${fin(`${retard} ${retard > 1 ? 'séances' : 'séance'} sans consolidation de clôture — ${faits}`)} La ligne du jour peut exister (écrite par l'intraday) sans être la clôture officielle.`;
  return signal('cloture', titre, niveau, detail, c, '/admin/scraping');
}

const H_COURS = 17;
const H_SIGNAUX = 18;
const H_CARNET = 20;
const H_VIDEO = 18;
const DEBUT_SEANCE_MIN = 9 * 60 + 35;
const FIN_SEANCE_MIN = 16 * 60 + 10;
const INTRADAY_ATTENTION_MIN = 45;
const INTRADAY_ALERTE_MIN = 120;
const CALENDRIER_MIN_LIGNES = 20;
const E2E_ATTENTION_H = 30;
const E2E_ALERTE_H = 72;

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** 'AAAA-MM-JJ' (ou horodatage) → « lundi 2 nov. ». */
function jourFr(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

/** Horodatage → « lundi 2 nov. à 15:50 UTC ». */
function momentFr(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${jourFr(d.toISOString())} à ${hh}:${mm} UTC`;
}

/** Termine une phrase par un point, sans doubler celui d'une abréviation (« nov. »). */
function fin(s: string): string {
  return s.endsWith('.') ? s : `${s}.`;
}

function duree(minutes: number): string {
  if (minutes < 120) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${h} h ${String(minutes % 60).padStart(2, '0')}`;
}

function signal(id: string, titre: string, niveau: Niveau, detail: string, dernierSucces: string | null, lien?: string): Signal {
  return { id: `donnees:${id}`, domaine: 'donnees', titre, niveau, detail, dernierSucces, lien: lien ?? null };
}

/** Flux journalier d'une séance : 0 → ok, `attention` séances → attention, `alerte` → alerte. */
function fluxSeance(
  o: { id: string; titre: string; table: string; derniere: string | null; heure: number; attention: number; alerte: number; note?: string },
  maintenant: Date,
  feries: string[],
): Signal {
  const attendue = derniereSeanceAttendue(maintenant, o.heure, feries);
  const note = o.note ? ` ${o.note}` : '';
  if (!o.derniere) {
    return signal(o.id, o.titre, 'alerte', `${fin(`Aucune donnée en base (${o.table} vide) ; séance attendue : ${jourFr(attendue)}`)}${note}`, null);
  }
  const faits = `dernière séance en base : ${jourFr(o.derniere)} ; attendue : ${jourFr(attendue)}`;
  // Une date POSTÉRIEURE à la séance attendue n'est pas « à jour » d'office
  // (relecture du 2026-11-03) : le jour même, c'est la ligne provisoire écrite
  // en séance par l'intraday ; à toute autre date, c'est une anomalie.
  const derniereJour = o.derniere.slice(0, 10);
  if (derniereJour > attendue) {
    const aujourdhui = maintenant.toISOString().slice(0, 10);
    const jourOuvre = maintenant.getUTCDay() !== 0 && maintenant.getUTCDay() !== 6;
    if (derniereJour === aujourdhui && jourOuvre) {
      return signal(
        o.id,
        o.titre,
        'ok',
        `${fin(`À jour — ${faits}`)} La ligne du ${jourFr(derniereJour)} est provisoire (valeurs intrajournalières) tant que la clôture n'est pas consolidée.${o.note ? ` ${o.note}` : ''}`,
        derniereJour,
      );
    }
    return signal(
      o.id,
      o.titre,
      'attention',
      `${fin(`Date postérieure à la séance attendue — ${faits}`)} Ni séance en cours ni consolidation ne l'expliquent : vérifier la date enregistrée.`,
      derniereJour,
    );
  }
  const retard = seancesDeRetard(o.derniere, attendue, feries);
  const niveau: Niveau = retard >= o.alerte ? 'alerte' : retard >= o.attention ? 'attention' : 'ok';
  let entete: string;
  if (retard === 0) entete = 'À jour';
  else if (retard === 1) entete = '1 séance de retard';
  else entete = `${retard} séances de retard`;
  const ferie = niveau === 'attention' && retard === 1 ? ' (peut-être un jour férié non déclaré)' : '';
  return signal(o.id, o.titre, niveau, `${fin(`${entete}${ferie} — ${faits}`)}${note}`, o.derniere.slice(0, 10));
}

function intraday(d: DonneesFraicheur, maintenant: Date): Signal {
  const titre = 'Cours en séance';
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const jour = maintenant.getUTCDay();
  const ouvre = jour !== 0 && jour !== 6;
  const ferie = ouvre && d.feries.includes(aujourdhui);
  const minutes = maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes();
  const enSeance = ouvre && !ferie && minutes >= DEBUT_SEANCE_MIN && minutes <= FIN_SEANCE_MIN;
  const c = d.collecteIntraday;

  if (!c) {
    return signal('intraday', titre, 'alerte', 'Aucune donnée : aucun passage intraday réussi enregistré (v_fraicheur_cours).', null);
  }
  if (ferie) {
    return signal('intraday', titre, 'ok', `Jour férié BRVM déclaré : aucune collecte attendue. Dernière collecte : ${momentFr(c)}.`, c);
  }
  if (enSeance) {
    const age = Math.max(0, Math.floor((maintenant.getTime() - new Date(c).getTime()) / 60000));
    const niveau: Niveau = age > INTRADAY_ALERTE_MIN ? 'alerte' : age > INTRADAY_ATTENTION_MIN ? 'attention' : 'ok';
    return signal(
      'intraday',
      titre,
      niveau,
      `Séance en cours ; dernière collecte : ${momentFr(c)}, il y a ${duree(age)} (attention au-delà de ${INTRADAY_ATTENTION_MIN} min, alerte au-delà de 2 h).`,
      c,
    );
  }
  // Hors séance un écart est normal… sauf si la dernière séance terminée n'a
  // vu AUCUNE collecte : le cours de clôture, écrit par d'autres jobs, ne le
  // révélerait pas.
  const seance = derniereSeanceAttendue(maintenant, FIN_SEANCE_MIN / 60, d.feries);
  const retard = seancesDeRetard(c, seance, d.feries);
  if (retard === 0) {
    return signal('intraday', titre, 'ok', `Hors séance ; dernière collecte : ${momentFr(c)}.`, c);
  }
  return signal(
    'intraday',
    titre,
    retard >= 2 ? 'alerte' : 'attention',
    `Hors séance, mais aucune collecte pendant la séance du ${jourFr(seance)} (${retard} séance${retard > 1 ? 's' : ''} sans collecte) ; dernière collecte : ${momentFr(c)}.`,
    c,
  );
}

function video(d: DonneesFraicheur, maintenant: Date): Signal {
  const titre = 'Vidéo de séance';
  const attendue = derniereSeanceAttendue(maintenant, H_VIDEO, d.feries);
  // Référence = la plus ancienne de (séance attendue, dernière séance en base) :
  // en séance, la ligne du jour existe déjà (intraday) sans que la vidéo soit
  // due ; et si la base est en retard, c'est le signal des cours qui le dit.
  const ref = d.coursCloture && d.coursCloture.slice(0, 10) < attendue ? d.coursCloture.slice(0, 10) : attendue;
  if (!d.video) {
    return signal('video', titre, 'attention', fin(`Aucune vidéo publiée (seance-video/derniere.json absent) ; séance attendue : ${jourFr(ref)}`), null);
  }
  const retard = seancesDeRetard(d.video, ref, d.feries);
  const niveau: Niveau = retard >= 2 ? 'alerte' : retard >= 1 ? 'attention' : 'ok';
  const entete = retard === 0 ? 'À jour' : `${retard} séance${retard > 1 ? 's' : ''} de retard`;
  return signal('video', titre, niveau, fin(`${entete} — vidéo publiée : ${jourFr(d.video)} ; séance de référence : ${jourFr(ref)}`), d.video.slice(0, 10));
}

function calendrier(d: DonneesFraicheur): Signal {
  const titre = 'Calendrier des dividendes';
  const { lignes, exercice, dateDocument } = d.calendrierDividendes;
  const doc = dateDocument ? `document BRVM du ${jourFr(dateDocument).replace(/^\S+ /, '')} ${dateDocument.slice(0, 4)}` : 'document BRVM non daté';
  const ex = exercice != null ? `exercice ${exercice}, ` : '';
  const limite =
    ' La date du dernier passage quotidien n’est pas mesurable dans la table (les lignes inchangées ne sont pas réécrites) : voir la tâche dividendes-calendrier.yml.';
  if (lignes === 0) {
    return signal('dividendes-calendrier', titre, 'alerte', 'Aucune donnée : aucun dividende daté issu du calendrier officiel BRVM sur les deux derniers exercices.', null);
  }
  const niveau: Niveau = lignes < CALENDRIER_MIN_LIGNES ? 'attention' : 'ok';
  const seuil = niveau === 'attention' ? ` — sous le seuil de ${CALENDRIER_MIN_LIGNES} lignes du contrôle hebdomadaire` : '';
  return signal(
    'dividendes-calendrier',
    titre,
    niveau,
    `${lignes} dividendes datés au calendrier officiel (${ex}${doc})${seuil}.${limite}`,
    dateDocument,
  );
}

function testsE2e(d: DonneesFraicheur, maintenant: Date): Signal {
  const titre = 'Tests de bout en bout';
  const lien = '/admin/qualite';
  if (!d.testsE2e) {
    return signal('tests-e2e', titre, 'alerte', 'Aucune donnée : aucun passage e2e terminé en base (qa_runs).', null, lien);
  }
  const heures = (maintenant.getTime() - new Date(d.testsE2e).getTime()) / 3_600_000;
  const niveau: Niveau = heures > E2E_ALERTE_H ? 'alerte' : heures > E2E_ATTENTION_H ? 'attention' : 'ok';
  return signal(
    'tests-e2e',
    titre,
    niveau,
    `Dernier passage complet terminé le ${momentFr(d.testsE2e)}, il y a ${duree(Math.max(0, Math.floor(heures * 60)))} (passage nocturne à 03:00 UTC ; attention au-delà de ${E2E_ATTENTION_H} h, alerte au-delà de ${E2E_ALERTE_H} h).`,
    d.testsE2e,
    lien,
  );
}

const DEPOT = 'https://github.com/ebouak/brvm-analyst-pro';

/**
 * Ce que date chaque repère, et où agir. « Dernier succès » générique
 * mélangeait séances couvertes, collectes et documents : chaque flux nomme
 * désormais le sien (relecture du 2026-11-03).
 */
const ENRICHISSEMENT: Record<string, { repere: { libelle: string; nature: 'instant' | 'periode' }; actions: { libelle: string; href: string }[] }> = {
  'donnees:cours': { repere: { libelle: 'Dernière séance en base', nature: 'periode' }, actions: [{ libelle: 'Voir les exécutions', href: '/admin/scraping' }] },
  'donnees:cloture': { repere: { libelle: 'Dernière consolidation réussie', nature: 'instant' }, actions: [{ libelle: 'Voir les exécutions', href: '/admin/scraping' }, { libelle: 'Workflow sur GitHub', href: `${DEPOT}/actions/workflows/daily-brvm.yml` }] },
  'donnees:indices': { repere: { libelle: 'Dernière séance en base', nature: 'periode' }, actions: [{ libelle: 'Voir les exécutions', href: '/admin/scraping' }] },
  'donnees:intraday': { repere: { libelle: 'Dernière collecte en séance', nature: 'instant' }, actions: [{ libelle: 'Workflow sur GitHub', href: `${DEPOT}/actions/workflows/intraday.yml` }] },
  'donnees:signaux': { repere: { libelle: 'Dernière séance notée', nature: 'periode' }, actions: [{ libelle: 'Workflow sur GitHub', href: `${DEPOT}/actions/workflows/score.yml` }] },
  'donnees:liquidite': { repere: { libelle: 'Dernière séance calculée', nature: 'periode' }, actions: [{ libelle: 'Workflow sur GitHub', href: `${DEPOT}/actions/workflows/score.yml` }] },
  'donnees:carnet': { repere: { libelle: 'Dernier bulletin en base', nature: 'periode' }, actions: [{ libelle: 'Workflow sur GitHub', href: `${DEPOT}/actions/workflows/carnet.yml` }] },
  'donnees:video': { repere: { libelle: 'Séance de la dernière vidéo', nature: 'periode' }, actions: [{ libelle: 'Workflow sur GitHub', href: `${DEPOT}/actions/workflows/video-seance.yml` }] },
  'donnees:dividendes-calendrier': { repere: { libelle: 'Date du document BRVM', nature: 'periode' }, actions: [{ libelle: 'Workflow sur GitHub', href: `${DEPOT}/actions/workflows/dividendes-calendrier.yml` }] },
  'donnees:tests-e2e': { repere: { libelle: 'Dernier passage terminé', nature: 'instant' }, actions: [{ libelle: 'Voir les résultats', href: '/admin/qualite' }] },
};

export function evaluerDonnees(d: DonneesFraicheur, maintenant: Date): Signal[] {
  return evaluerFlux(d, maintenant).map((s) => {
    const e = ENRICHISSEMENT[s.id];
    if (!e) return s;
    return {
      ...s,
      reperes: s.dernierSucces ? [{ ...e.repere, date: s.dernierSucces }] : [],
      actions: e.actions,
      // Contenu disponible, mais la date du dernier passage n'est pas mesurable
      // dans la table : on le dit plutôt que d'afficher un « OK » plein.
      ...(s.id === 'donnees:dividendes-calendrier' ? { preuve: 'partielle' as const } : {}),
    };
  });
}

function evaluerFlux(d: DonneesFraicheur, maintenant: Date): Signal[] {
  const f = d.feries;
  return [
    fluxSeance({ id: 'cours', titre: 'Cours de clôture', table: 'brvm_actions_daily', derniere: d.coursCloture, heure: H_COURS, attention: 1, alerte: 2 }, maintenant, f),
    clotureConsolidee(d, maintenant),
    fluxSeance({ id: 'indices', titre: 'Indices BRVM', table: 'brvm_indices_daily', derniere: d.indices, heure: H_COURS, attention: 1, alerte: 2 }, maintenant, f),
    intraday(d, maintenant),
    fluxSeance({ id: 'signaux', titre: 'Signaux de scoring', table: 'signals_daily', derniere: d.signaux, heure: H_SIGNAUX, attention: 1, alerte: 2 }, maintenant, f),
    fluxSeance({ id: 'liquidite', titre: 'Liquidité', table: 'liquidity_daily', derniere: d.liquidite, heure: H_SIGNAUX, attention: 1, alerte: 2 }, maintenant, f),
    fluxSeance(
      {
        id: 'carnet',
        titre: 'Carnet d’ordres',
        table: 'brvm_carnet_daily',
        derniere: d.carnet,
        heure: H_CARNET,
        attention: 2,
        alerte: 3,
        note: 'Le bulletin paraît parfois le lendemain : une séance d’écart est tolérée.',
      },
      maintenant,
      f,
    ),
    video(d, maintenant),
    calendrier(d),
    testsE2e(d, maintenant),
  ];
}
