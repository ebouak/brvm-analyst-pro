/**
 * Requêtes HogQL de l'audience — PURES (aucune I/O, testées sur leur forme).
 *
 * Seules deux choses entrent dans le SQL : des bornes `Date` validées et rendues
 * en ISO, et des constantes de ce fichier. Jamais une chaîne venue d'un utilisateur.
 */
import { horodatageHogql, type Fenetre } from './periodes';

function lit(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) throw new Error('Borne de fenêtre invalide');
  return `toDateTime('${horodatageHogql(d)}', 'UTC')`;
}
export const filtreFenetre = (f: Fenetre): string => `timestamp >= ${lit(f.debut)} AND timestamp < ${lit(f.fin)}`;

const CONTINENT = 'properties.$geoip_continent_code';
const PAGEVIEW = `event = '$pageview'`;

export const sqlOverview = (f: Fenetre) =>
  `SELECT count() AS evenements, countIf(${PAGEVIEW}) AS pages_vues, uniq(person_id) AS personnes, uniq($session_id) AS sessions FROM events WHERE ${filtreFenetre(f)}`;

export const sqlContinents = (f: Fenetre) =>
  `SELECT ${CONTINENT} AS code, properties.$geoip_continent_name AS nom, uniq(person_id) AS personnes, uniq($session_id) AS sessions FROM events WHERE ${filtreFenetre(f)} GROUP BY code, nom ORDER BY personnes DESC LIMIT 20`;

export const sqlPaysAfrique = (f: Fenetre) =>
  `SELECT properties.$geoip_country_code AS code, properties.$geoip_country_name AS nom, uniq(person_id) AS personnes, uniq($session_id) AS sessions FROM events WHERE ${filtreFenetre(f)} AND ${CONTINENT} = 'AF' GROUP BY code, nom ORDER BY personnes DESC LIMIT 60`;

export const sqlVillesAfrique = (f: Fenetre) =>
  `SELECT properties.$geoip_city_name AS ville, properties.$geoip_country_code AS pays, uniq(person_id) AS personnes FROM events WHERE ${filtreFenetre(f)} AND ${CONTINENT} = 'AF' AND properties.$geoip_city_name IS NOT NULL AND properties.$geoip_city_name != '' GROUP BY ville, pays ORDER BY personnes DESC LIMIT 15`;

export const sqlSessions = (f: Fenetre) =>
  `SELECT count() AS sessions, avg($session_duration) AS duree_moyenne, quantile(0.5)($session_duration) AS duree_mediane, avg($pageview_count) AS pages_par_session FROM sessions WHERE $start_timestamp >= ${lit(f.debut)} AND $start_timestamp < ${lit(f.fin)}`;

export const sqlPages = (f: Fenetre) =>
  `SELECT properties.$pathname AS chemin, count() AS vues, uniq(person_id) AS personnes FROM events WHERE ${filtreFenetre(f)} AND ${PAGEVIEW} AND properties.$pathname IS NOT NULL GROUP BY chemin ORDER BY vues DESC LIMIT 15`;

export const sqlClics = (f: Fenetre) =>
  `SELECT properties.$el_text AS libelle, count() AS clics, uniq(person_id) AS personnes FROM events WHERE ${filtreFenetre(f)} AND event = '$autocapture' AND properties.$event_type = 'click' AND properties.$el_text IS NOT NULL AND properties.$el_text != '' GROUP BY libelle ORDER BY clics DESC LIMIT 12`;

export const sqlAppareils = (f: Fenetre) =>
  `SELECT properties.$device_type AS type, uniq(person_id) AS personnes, uniq($session_id) AS sessions FROM events WHERE ${filtreFenetre(f)} GROUP BY type ORDER BY personnes DESC LIMIT 10`;

/** 12 semaines (lundi) se terminant à `fin`, personnes distinctes par continent. */
export const SEMAINES_TENDANCE = 12;
export function sqlTendance(fin: Date): string {
  const debut = new Date(fin.getTime() - SEMAINES_TENDANCE * 7 * 86_400_000);
  return `SELECT toString(toStartOfWeek(timestamp, 1)) AS semaine, ${CONTINENT} AS continent, uniq(person_id) AS personnes FROM events WHERE ${filtreFenetre({ debut, fin })} GROUP BY semaine, continent ORDER BY semaine`;
}

/**
 * Entonnoir Academy : personnes distinctes ayant ATTEINT chaque étape dans la
 * fenêtre. L'ordre des étapes n'est pas vérifié (ce n'est pas un entonnoir
 * séquentiel) — c'est dit sur la page.
 */
export const sqlEntonnoir = (f: Fenetre) =>
  `SELECT uniqIf(person_id, ${PAGEVIEW} AND startsWith(properties.$pathname, '/formations/academy')) AS academy, uniqIf(person_id, ${PAGEVIEW} AND match(properties.$pathname, '^/formations/academy/[^/]+$') AND properties.$pathname NOT IN ('/formations/academy/certificat', '/formations/academy/integrale')) AS lecon, uniqIf(person_id, (${PAGEVIEW} AND startsWith(properties.$pathname, '/signup')) OR event = 'signup_completed') AS inscription FROM events WHERE ${filtreFenetre(f)}`;

/** Série journalière (check quotidien) : une seule requête pour la veille et les jours de référence. */
export const sqlSerieJournaliere = (f: Fenetre) =>
  `SELECT toString(toDate(timestamp)) AS jour, uniq(person_id) AS personnes, uniq($session_id) AS sessions, countIf(${PAGEVIEW}) AS pages_vues, uniqIf(person_id, ${CONTINENT} = 'AF') AS afrique FROM events WHERE ${filtreFenetre(f)} GROUP BY jour ORDER BY jour`;
