/**
 * Agrégat sectoriel — PER, PBR et rendement du dividende par secteur BRVM.
 *
 * Module PUR : il ne lit rien, il reçoit des lignes déjà chargées. Toute la
 * politique d'honnêteté tient ici, et elle se teste sans base.
 *
 * ── Trois règles, et leurs raisons ──
 *
 * 1. MÉDIANE, jamais moyenne. Un secteur de 16 valeurs où l'une affiche un PER
 *    de 180 (bénéfice quasi nul) verrait sa moyenne partir à 25 alors que la
 *    moitié des titres sont sous 8. La médiane décrit le secteur ; la moyenne
 *    décrit son pire cas.
 *
 * 2. UN RATIO NÉGATIF OU ABSURDE EST ÉCARTÉ, PAS CORRIGÉ. Un PER négatif
 *    (société en perte) n'est pas « un PER bas » : il ne veut rien dire dans une
 *    comparaison de cherté. On l'exclut du calcul ET on le compte, pour pouvoir
 *    dire combien de sociétés le secteur ne permet pas de valoriser ainsi.
 *
 * 3. LES TROUS SONT DÉCLARÉS. Chaque secteur porte le nombre de sociétés
 *    retenues face au nombre de sociétés cotées. Un secteur dont un seul titre
 *    est exploitable ne doit pas s'afficher comme une vérité sectorielle : le
 *    lecteur voit « 1 / 4 » et juge lui-même.
 */

export interface LigneSociete {
  code: string;
  nom: string | null;
  secteur: string | null;
  /** Cours de la dernière séance. */
  cours: number | null;
  per: number | null;
  pbr: number | null;
  /** Rendement du dividende en %, issu de la source unique (détachement daté). */
  rendement: number | null;
  /** Capitalisation, pour pondérer la variation et repérer les poids lourds. */
  capitalisation: number | null;
  /** Variation de la dernière séance, en %. */
  variation: number | null;
}

export interface AgregatSecteur {
  secteur: string;
  /** Sociétés cotées rattachées au secteur, exploitables ou non. */
  societes: number;
  perMedian: number | null;
  perRetenus: number;
  /** Sociétés dont le PER est inexploitable (perte, bénéfice nul, donnée absente). */
  perEcartes: number;
  pbrMedian: number | null;
  pbrRetenus: number;
  rendementMedian: number | null;
  rendementRetenus: number;
  /** Capitalisation cumulée des sociétés qui en déclarent une. */
  capitalisation: number | null;
  /** La moins chère et la plus chère au sens du PER — null si moins de 2 valeurs. */
  moinsChere: { code: string; per: number } | null;
  plusChere: { code: string; per: number } | null;
}

/** Bornes de crédibilité. Au-delà, le ratio ne compare plus rien d'utile. */
const PER_MAX = 100;
const PBR_MAX = 30;
const RENDEMENT_MAX = 40;

const exploitable = (v: number | null | undefined, max: number): v is number =>
  v != null && Number.isFinite(v) && v > 0 && v <= max;

/** Médiane d'une liste non vide, déjà filtrée. Moyenne des deux centrales si pair. */
export function mediane(xs: number[]): number | null {
  if (!xs.length) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export function agregerParSecteur(lignes: LigneSociete[]): AgregatSecteur[] {
  const parSecteur = new Map<string, LigneSociete[]>();
  for (const l of lignes) {
    const s = l.secteur?.trim();
    if (!s) continue;                      // sans secteur connu, on ne range pas au hasard
    const liste = parSecteur.get(s) ?? [];
    liste.push(l);
    parSecteur.set(s, liste);
  }

  const out: AgregatSecteur[] = [];
  for (const [secteur, liste] of parSecteur) {
    const pers = liste.filter((l) => exploitable(l.per, PER_MAX));
    const pbrs = liste.filter((l) => exploitable(l.pbr, PBR_MAX)).map((l) => l.pbr as number);
    const rends = liste.filter((l) => exploitable(l.rendement, RENDEMENT_MAX)).map((l) => l.rendement as number);
    const caps = liste.map((l) => l.capitalisation).filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
    const triPer = [...pers].sort((a, b) => (a.per as number) - (b.per as number));

    out.push({
      secteur,
      societes: liste.length,
      perMedian: mediane(pers.map((l) => l.per as number)),
      perRetenus: pers.length,
      perEcartes: liste.length - pers.length,
      pbrMedian: mediane(pbrs),
      pbrRetenus: pbrs.length,
      rendementMedian: mediane(rends),
      rendementRetenus: rends.length,
      capitalisation: caps.length ? caps.reduce((a, b) => a + b, 0) : null,
      moinsChere: triPer.length >= 2 ? { code: triPer[0].code, per: triPer[0].per as number } : null,
      plusChere: triPer.length >= 2 ? { code: triPer[triPer.length - 1].code, per: triPer[triPer.length - 1].per as number } : null,
    });
  }

  // Les secteurs les plus lourds d'abord ; à capitalisation inconnue, par nom,
  // pour que l'ordre reste stable d'un chargement à l'autre.
  return out.sort((a, b) => (b.capitalisation ?? -1) - (a.capitalisation ?? -1) || a.secteur.localeCompare(b.secteur, 'fr'));
}

/**
 * Médiane du marché entier, pour situer un secteur. Calculée sur les MÊMES
 * lignes filtrées, jamais sur la médiane des médianes — qui donnerait un poids
 * égal à un secteur de 2 valeurs et à un secteur de 16.
 */
export function medianeMarche(lignes: LigneSociete[], champ: 'per' | 'pbr' | 'rendement'): number | null {
  const max = champ === 'per' ? PER_MAX : champ === 'pbr' ? PBR_MAX : RENDEMENT_MAX;
  return mediane(lignes.map((l) => l[champ]).filter((v): v is number => exploitable(v, max)));
}
