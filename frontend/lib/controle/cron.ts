/**
 * Tour de contrôle — lecture des expressions cron des workflows GitHub (PUR).
 *
 * Une seule question : quel est l'écart MAXIMAL normal entre deux
 * déclenchements planifiés ? Il sert à dire « ce workflow aurait dû tourner »
 * sans crier au retard un dimanche pour un cron du lundi au vendredi.
 *
 * Méthode volontairement bête et sûre : on énumère les déclenchements réels
 * (à la minute près, en UTC comme GitHub) sur une fenêtre autour de
 * `maintenant`, puis on mesure le plus grand trou. La fenêtre fait 70 jours et
 * non 14 : le dépôt contient des crons mensuels (« le 2 de chaque mois »), dont
 * l'écart de 31 jours serait invisible sur deux semaines.
 *
 * Syntaxe couverte : 5 champs, `*`, listes, plages, pas (`*\/n`, `a-b/n`,
 * `a/n`), noms de jours et de mois, dimanche en 0 ou 7, et la règle POSIX du
 * OU entre jour du mois et jour de semaine quand les deux sont restreints.
 * Tout le reste (`@daily`, `L`, `W`, `#`, `?`) → expression illisible.
 */

const MINUTE_MS = 60_000;
const JOUR_MS = 24 * 60 * MINUTE_MS;
/** Fenêtre d'énumération : 9 semaines avant `maintenant`, 1 semaine après. */
const JOURS_AVANT = 63;
const JOURS_APRES = 7;

const MOIS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const JOURS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

interface Champ {
  valeurs: Set<number>;
  /** Le champ commence par `*` : il ne restreint rien (règle du OU jour/semaine). */
  etoile: boolean;
}

interface Cron {
  minutes: number[];
  heures: number[];
  joursMois: Champ;
  mois: Set<number>;
  joursSemaine: Champ;
}

function lireNombre(s: string, noms?: Record<string, number>): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  const n = noms?.[s.toUpperCase()];
  return n === undefined ? null : n;
}

function lireChamp(texte: string, min: number, max: number, noms?: Record<string, number>): Champ | null {
  const valeurs = new Set<number>();
  for (const morceau of texte.split(',')) {
    if (morceau === '') return null;
    const [base, pasTexte, ...reste] = morceau.split('/');
    if (reste.length > 0) return null;
    let pas = 1;
    if (pasTexte !== undefined) {
      if (!/^\d+$/.test(pasTexte)) return null;
      pas = Number(pasTexte);
      if (pas < 1) return null;
    }
    let debut: number;
    let fin: number;
    if (base === '*') {
      debut = min;
      fin = max;
    } else if (base.includes('-')) {
      const bornes = base.split('-');
      if (bornes.length !== 2) return null;
      const a = lireNombre(bornes[0], noms);
      const b = lireNombre(bornes[1], noms);
      if (a === null || b === null || a > b) return null;
      debut = a;
      fin = b;
    } else {
      const a = lireNombre(base, noms);
      if (a === null) return null;
      debut = a;
      // « a/n » : de a jusqu'au maximum par pas de n ; « a » seul : a.
      fin = pasTexte !== undefined ? max : a;
    }
    if (debut < min || fin > max) return null;
    for (let v = debut; v <= fin; v += pas) valeurs.add(v);
  }
  return { valeurs, etoile: texte.startsWith('*') };
}

function lireCron(expression: string): Cron | null {
  // Un commentaire YAML peut rester collé si le collecteur l'a mal découpé.
  const nettoye = expression.split('#')[0].trim();
  const champs = nettoye.split(/\s+/);
  if (champs.length !== 5) return null;
  const minutes = lireChamp(champs[0], 0, 59);
  const heures = lireChamp(champs[1], 0, 23);
  const joursMois = lireChamp(champs[2], 1, 31);
  const mois = lireChamp(champs[3], 1, 12, MOIS);
  const joursSemaine = lireChamp(champs[4], 0, 7, JOURS);
  if (!minutes || !heures || !joursMois || !mois || !joursSemaine) return null;
  // Dimanche s'écrit 0 ou 7.
  if (joursSemaine.valeurs.has(7)) joursSemaine.valeurs.add(0);
  return {
    minutes: [...minutes.valeurs].sort((a, b) => a - b),
    heures: [...heures.valeurs].sort((a, b) => a - b),
    joursMois,
    mois: mois.valeurs,
    joursSemaine,
  };
}

function jourCorrespond(c: Cron, jour: Date): boolean {
  if (!c.mois.has(jour.getUTCMonth() + 1)) return false;
  const parMois = c.joursMois.valeurs.has(jour.getUTCDate());
  const parSemaine = c.joursSemaine.valeurs.has(jour.getUTCDay());
  // POSIX : si les deux champs sont restreints, il suffit que l'un corresponde.
  if (!c.joursMois.etoile && !c.joursSemaine.etoile) return parMois || parSemaine;
  return parMois && parSemaine;
}

/**
 * Écart maximal normal (ms) entre deux déclenchements consécutifs de la
 * réunion des crons, ou `null` si aucune expression n'est lisible ou si elles
 * ne se déclenchent pas au moins deux fois dans la fenêtre.
 */
export function intervalleMaxAttenduMs(crons: string[], maintenant: Date = new Date()): number | null {
  const tries = declenchements(crons, maintenant);
  if (tries === null || tries.length < 2) return null;
  let max = 0;
  for (let i = 1; i < tries.length; i++) max = Math.max(max, tries[i] - tries[i - 1]);
  return max;
}

/**
 * Dernier déclenchement planifié au plus tard à `instant` (fenêtre de 63 j en
 * arrière), ou `null` si aucune expression n'est lisible ou si rien n'est
 * tombé dans la fenêtre. Sert au retard : « le run de mardi 16:30 manque ».
 */
export function dernierDeclenchementAvant(crons: string[], instant: Date): Date | null {
  const tries = declenchements(crons, instant);
  if (tries === null) return null;
  const t = instant.getTime();
  for (let i = tries.length - 1; i >= 0; i--) if (tries[i] <= t) return new Date(tries[i]);
  return null;
}

/** Instants de déclenchement (ms, triés) de la réunion des crons autour de `autour`. */
function declenchements(crons: string[], autour: Date): number[] | null {
  const lus = crons.map(lireCron).filter((c): c is Cron => c !== null);
  if (lus.length === 0) return null;

  const minuit = Date.UTC(autour.getUTCFullYear(), autour.getUTCMonth(), autour.getUTCDate());
  const instants = new Set<number>();
  for (let j = -JOURS_AVANT; j <= JOURS_APRES; j++) {
    const debutJour = minuit + j * JOUR_MS;
    const jour = new Date(debutJour);
    for (const c of lus) {
      if (!jourCorrespond(c, jour)) continue;
      for (const h of c.heures) {
        for (const m of c.minutes) instants.add(debutJour + (h * 60 + m) * MINUTE_MS);
      }
    }
  }
  return [...instants].sort((a, b) => a - b);
}
