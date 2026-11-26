/**
 * Signaux de partage et d'abus par compte — PUR.
 *
 * Aide à la décision, JAMAIS une sanction : chaque raison porte son chiffre et
 * son seuil, et c'est un humain qui tranche (RGPD art. 22, et faux positifs
 * fréquents : en Afrique de l'Ouest l'adresse mobile change sans cesse, un
 * cybercafé ou un bureau partage la même).
 *
 * Seuils écrits ici, une seule fois, et affichés tels quels dans la console.
 */
import { appareilDe } from './appareil';

export type Niveau = 'normal' | 'surveiller' | 'suspect';

export interface Raison {
  code: 'sieges_disputes' | 'appareils_nombreux' | 'pays_multiples' | 'pays_rapproches' | 'usage_ia' | 'inscriptions_groupees';
  libelle: string;
  valeur: number;
  seuil: number;
  niveau: Exclude<Niveau, 'normal'>;
}

export interface DonneesCompte {
  userId: string;
  estPremium: boolean;
  exempte: boolean;
  /** Sessions vues sur la fenêtre de 30 jours. */
  sessions: { userAgent: string | null; derniereVue: string }[];
  /** Fermetures par le plafond sur 30 jours (simulées comprises). */
  fermeturesPlafond: { createdAt: string; derniereActivite: string | null }[];
  /** Connexions réussies sur 30 jours. */
  connexions: { createdAt: string; pays: string | null }[];
  usageIa30j: number;
  /** Taille du groupe d'inscriptions auquel le compte appartient (0 = aucun). */
  tailleGroupe: number;
  /** Décision « légitime » encore en cours. */
  legitimeJusquau: string | null;
}

export interface Evaluation {
  userId: string;
  niveau: Niveau;
  raisons: Raison[];
  legitime: boolean;
}

export const SEUILS = {
  /** Sessions UTILISÉES dans les 14 jours avant leur fermeture par le plafond. */
  siegesSurveiller: 2,
  siegesSuspect: 4,
  appareilsSurveiller: 6,
  appareilsSuspect: 10,
  paysSurveiller: 3,
  paysRapprochesHeures: 6,
  usageIaRatio: 5,
  usageIaMinimum: 50,
  groupeSurveiller: 3,
  groupeSuspect: 5,
  /** Ce nombre de raisons « à surveiller » cumulées fait un compte suspect. */
  cumulSuspect: 3,
} as const;

const JOUR = 86_400_000;

function ms(iso: string | null | undefined): number {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
}

export function evaluerCompte(d: DonneesCompte, ctx: { maintenant: Date; medianeUsageIa: number }): Evaluation {
  if (d.exempte) return { userId: d.userId, niveau: 'normal', raisons: [], legitime: false };
  const raisons: Raison[] = [];

  // 1. Sièges disputés : le plafond a dû fermer des sessions qui servaient encore.
  const sieges = d.fermeturesPlafond.filter(
    (f) => f.derniereActivite && ms(f.createdAt) - ms(f.derniereActivite) <= 14 * JOUR,
  ).length;
  if (sieges >= SEUILS.siegesSurveiller) {
    raisons.push({
      code: 'sieges_disputes',
      libelle: 'Sessions encore utilisées, fermées par le plafond en 30 jours',
      valeur: sieges,
      seuil: sieges >= SEUILS.siegesSuspect ? SEUILS.siegesSuspect : SEUILS.siegesSurveiller,
      niveau: sieges >= SEUILS.siegesSuspect ? 'suspect' : 'surveiller',
    });
  }

  // 2. Appareils distincts (système + navigateur) en 30 jours.
  const appareils = new Set(d.sessions.map((s) => appareilDe(s.userAgent).libelle)).size;
  if (appareils >= SEUILS.appareilsSurveiller) {
    raisons.push({
      code: 'appareils_nombreux',
      libelle: 'Appareils distincts (système et navigateur) en 30 jours',
      valeur: appareils,
      seuil: appareils >= SEUILS.appareilsSuspect ? SEUILS.appareilsSuspect : SEUILS.appareilsSurveiller,
      niveau: appareils >= SEUILS.appareilsSuspect ? 'suspect' : 'surveiller',
    });
  }

  // 3. Pays de connexion distincts.
  const pays = new Set(d.connexions.map((c) => c.pays).filter((p): p is string => Boolean(p))).size;
  if (pays >= SEUILS.paysSurveiller) {
    raisons.push({ code: 'pays_multiples', libelle: 'Pays de connexion distincts en 30 jours', valeur: pays, seuil: SEUILS.paysSurveiller, niveau: 'surveiller' });
  }

  // 4. Deux pays en moins de 6 h (un VPN ou l'itinérance le font aussi : à surveiller seulement).
  const chrono = d.connexions
    .filter((c) => c.pays)
    .sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  let rapproches = 0;
  for (let i = 1; i < chrono.length; i++) {
    const a = chrono[i - 1];
    const b = chrono[i];
    if (a.pays !== b.pays && ms(b.createdAt) - ms(a.createdAt) < SEUILS.paysRapprochesHeures * 3_600_000) rapproches++;
  }
  if (rapproches >= 1) {
    raisons.push({ code: 'pays_rapproches', libelle: `Changements de pays en moins de ${SEUILS.paysRapprochesHeures} h`, valeur: rapproches, seuil: 1, niveau: 'surveiller' });
  }

  // 5. Consommation IA très au-dessus de la médiane Premium.
  if (
    d.usageIa30j >= SEUILS.usageIaMinimum &&
    ctx.medianeUsageIa > 0 &&
    d.usageIa30j >= SEUILS.usageIaRatio * ctx.medianeUsageIa
  ) {
    raisons.push({
      code: 'usage_ia',
      libelle: `Questions à l'IA en 30 jours (médiane Premium : ${ctx.medianeUsageIa})`,
      valeur: d.usageIa30j,
      seuil: Math.max(SEUILS.usageIaMinimum, SEUILS.usageIaRatio * ctx.medianeUsageIa),
      niveau: 'surveiller',
    });
  }

  // 6. Inscriptions groupées (même réseau, même navigateur exact).
  if (d.tailleGroupe >= SEUILS.groupeSurveiller) {
    raisons.push({
      code: 'inscriptions_groupees',
      libelle: 'Comptes créés en 30 jours depuis le même réseau et le même navigateur',
      valeur: d.tailleGroupe,
      seuil: d.tailleGroupe >= SEUILS.groupeSuspect ? SEUILS.groupeSuspect : SEUILS.groupeSurveiller,
      niveau: d.tailleGroupe >= SEUILS.groupeSuspect ? 'suspect' : 'surveiller',
    });
  }

  let niveau: Niveau = 'normal';
  if (raisons.some((r) => r.niveau === 'suspect') || raisons.length >= SEUILS.cumulSuspect) niveau = 'suspect';
  else if (raisons.length > 0) niveau = 'surveiller';

  const legitime = ms(d.legitimeJusquau) > ctx.maintenant.getTime();
  return { userId: d.userId, niveau: legitime ? 'normal' : niveau, raisons, legitime };
}

/**
 * Groupes d'inscriptions : comptes créés dans les 30 jours dont la PREMIÈRE
 * session partage le même préfixe réseau et le même user-agent exact. Comptes
 * exemptés (admin, test) écartés : les comptes de test sont créés en série.
 */
export function groupesInscriptions(
  comptes: { userId: string; creeLe: string; exempte: boolean; premiere: { userAgent: string | null; reseau: string | null } | null }[],
  maintenant: Date,
): Map<string, number> {
  const depuis = maintenant.getTime() - 30 * JOUR;
  const groupes = new Map<string, string[]>();
  for (const c of comptes) {
    if (c.exempte || !c.premiere?.reseau || !c.premiere.userAgent) continue;
    if (ms(c.creeLe) < depuis) continue;
    const cle = `${c.premiere.reseau}|${c.premiere.userAgent}`;
    const l = groupes.get(cle);
    if (l) l.push(c.userId);
    else groupes.set(cle, [c.userId]);
  }
  const taille = new Map<string, number>();
  for (const ids of groupes.values()) {
    if (ids.length < SEUILS.groupeSurveiller) continue;
    for (const id of ids) taille.set(id, ids.length);
  }
  return taille;
}

/** Médiane des consommations non nulles (0 s'il n'y en a pas). */
export function mediane(valeurs: number[]): number {
  const v = valeurs.filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}
