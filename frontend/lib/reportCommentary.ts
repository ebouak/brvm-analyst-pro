/**
 * Commentaire analytique des rapports — fonctions PURES.
 *
 * Règle du projet : aucun texte analytique inventé. Chaque phrase produite ici
 * se déduit arithmétiquement des métriques passées en argument. Aucun lien de
 * causalité n'est affirmé (on ne sait pas POURQUOI un secteur monte), aucune
 * prévision n'est émise.
 */

/** Formate un pourcentage signé à la française (virgule décimale). */
function pct(x: number, d = 1): string {
  const s = x.toFixed(d).replace('.', ',');
  return `${x >= 0 ? '+' : ''}${s} %`;
}

/** Formate un pourcentage non signé (dispersion, part). */
function pctBrut(x: number, d = 1): string {
  return `${x.toFixed(d).replace('.', ',')} %`;
}

/** Médiane d'une série non vide. Renvoie null si la série est vide. */
export function mediane(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 === 1 ? t[m]! : (t[m - 1]! + t[m]!) / 2;
}

export interface SectorCommentaryInput {
  periodeLabel: string;
  /** Performances des titres mesurables, en %. */
  perfs: number[];
  /** Nombre total de titres du secteur, y compris ceux sans historique. */
  nbTitresTotal: number;
  averagePerf: number | null;
  dispersion: number | null;
  best: { code: string; perf: number } | null;
  worst: { code: string; perf: number } | null;
  nbEvenements: number;
}

/**
 * Produit 2 à 5 constats sur un secteur. Chacun apporte une information que les
 * cartes de KPI ne montrent pas : l'ampleur du mouvement (combien de titres
 * participent), le décalage moyenne/médiane (une moyenne peut être portée par
 * un seul titre), la lecture de la dispersion, et la couverture des données.
 */
export function sectorCommentary(i: SectorCommentaryInput): string[] {
  const out: string[] = [];
  const n = i.perfs.length;
  if (n === 0) {
    return ['Aucun titre du secteur ne dispose d’un historique suffisant sur la période : les moyennes ne sont pas calculables.'];
  }

  // 1. Ampleur — combien de titres participent réellement au mouvement.
  const hausses = i.perfs.filter((p) => p > 0).length;
  const baisses = i.perfs.filter((p) => p < 0).length;
  const partHausse = hausses / n;
  const qualif =
    partHausse >= 0.8 ? 'La hausse est quasi générale'
    : partHausse >= 0.6 ? 'La hausse est majoritaire'
    : partHausse > 0.4 ? 'Le secteur est partagé'
    : partHausse > 0.2 ? 'La baisse est majoritaire'
    : 'La baisse est quasi générale';
  out.push(
    `${qualif} : ${hausses} titre${hausses > 1 ? 's' : ''} en hausse et ${baisses} en baisse sur ${n} mesuré${n > 1 ? 's' : ''} sur ${i.periodeLabel}.`,
  );

  // 2. Moyenne vs médiane — révèle une moyenne tirée par quelques valeurs.
  const med = mediane(i.perfs);
  if (i.averagePerf != null && med != null) {
    const ecart = Math.abs(i.averagePerf - med);
    if (ecart >= 5) {
      const sens = i.averagePerf > med ? 'tirée vers le haut' : 'tirée vers le bas';
      out.push(
        `La moyenne (${pct(i.averagePerf)}) est ${sens} par quelques valeurs : la médiane ressort à ${pct(med)}, ` +
        `plus représentative du titre typique du secteur.`,
      );
    } else {
      out.push(`Moyenne (${pct(i.averagePerf)}) et médiane (${pct(med)}) sont proches : le mouvement est homogène, sans valeur qui fausse le calcul.`);
    }
  }

  // 3. Dispersion — sélection de titres ou exposition sectorielle ?
  if (i.dispersion != null && i.averagePerf != null) {
    if (i.dispersion > Math.abs(i.averagePerf)) {
      out.push(
        `L’écart-type (${pctBrut(i.dispersion)}) dépasse la performance moyenne : les titres n’évoluent pas en bloc. ` +
        `Sur cette période, le choix des valeurs a compté davantage que l’exposition au secteur.`,
      );
    } else {
      out.push(
        `L’écart-type (${pctBrut(i.dispersion)}) reste inférieur à la performance moyenne : les titres évoluent de façon groupée, ` +
        `le secteur se comporte comme un bloc.`,
      );
    }
  }

  // 4. Amplitude entre les extrêmes.
  if (i.best && i.worst && i.best.code !== i.worst.code) {
    const amplitude = i.best.perf - i.worst.perf;
    out.push(
      `${amplitude.toFixed(1).replace('.', ',')} points séparent ${i.best.code} (${pct(i.best.perf)}) de ${i.worst.code} (${pct(i.worst.perf)}).`,
    );
  }

  // 5. Honnêteté sur la couverture : ne jamais laisser croire que tout est mesuré.
  const manquants = i.nbTitresTotal - n;
  if (manquants > 0) {
    out.push(
      `${manquants} titre${manquants > 1 ? 's' : ''} du secteur ${manquants > 1 ? 'sont exclus' : 'est exclu'} de ces calculs, ` +
      `faute d’historique suffisant sur la période.`,
    );
  }

  if (i.nbEvenements > 0) {
    out.push(
      `${i.nbEvenements} événement${i.nbEvenements > 1 ? 's' : ''} recensé${i.nbEvenements > 1 ? 's' : ''} sur le secteur ` +
      `(voir la chronologie ci-dessous) — aucun lien de cause à effet avec les cours n’est établi ici.`,
    );
  }

  return out;
}

export interface MarketDailyCommentaryInput {
  /** Variations du jour, en %, des titres cotés ce jour-là. */
  variations: number[];
  /** Nombre de titres au tableau, cotés ou non. */
  nbTitresCotes: number;
  /** Valeurs échangées du jour, en FCFA, tous titres confondus. */
  valeursEchangees: number[];
  nbEvenements: number;
}

/**
 * Constats sur une séance. Les deux apports propres à la BRVM sont la
 * PARTICIPATION (combien de titres ont réellement traité) et la CONCENTRATION
 * des échanges — sur un marché peu liquide, un indice peut bouger alors que la
 * quasi-totalité de la cote n'a pas échangé une seule action.
 */
export function marketDailyCommentary(i: MarketDailyCommentaryInput): string[] {
  const out: string[] = [];
  const n = i.variations.length;
  if (n === 0) {
    return ['Aucun titre n’a coté ce jour-là : la séance ne peut pas être commentée.'];
  }

  const hausse = i.variations.filter((v) => v > 0).length;
  const baisse = i.variations.filter((v) => v < 0).length;
  const stables = n - hausse - baisse;
  out.push(
    `${hausse} hausse${hausse > 1 ? 's' : ''}, ${baisse} baisse${baisse > 1 ? 's' : ''} et ${stables} titre${stables > 1 ? 's' : ''} inchangé${stables > 1 ? 's' : ''} ` +
    `parmi les ${n} valeurs cotées ce jour-là.`,
  );

  // Participation : ce que l'indice ne dit pas.
  const traites = i.valeursEchangees.filter((v) => v > 0).length;
  if (i.nbTitresCotes > 0) {
    const part = (traites / i.nbTitresCotes) * 100;
    out.push(
      `${traites} titre${traites > 1 ? 's' : ''} sur ${i.nbTitresCotes} ${traites > 1 ? 'ont' : 'a'} réellement échangé, soit ${pctBrut(part)} de la cote. ` +
      `Le reste est resté sans transaction : ces cours sont des reports, pas des prix de marché du jour.`,
    );
  }

  // Concentration : la liquidité BRVM se joue sur une poignée de titres.
  const total = i.valeursEchangees.reduce((a, b) => a + b, 0);
  if (total > 0 && traites >= 3) {
    const top3 = [...i.valeursEchangees].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    out.push(
      `Les 3 valeurs les plus traitées concentrent ${pctBrut((top3 / total) * 100)} des capitaux échangés de la séance.`,
    );
  }

  // Moyenne vs médiane des variations.
  const moy = i.variations.reduce((a, b) => a + b, 0) / n;
  const med = mediane(i.variations);
  if (med != null && Math.abs(moy - med) >= 0.5) {
    out.push(
      `La variation moyenne (${pct(moy, 2)}) s’écarte de la médiane (${pct(med, 2)}) : quelques mouvements extrêmes pèsent sur la moyenne.`,
    );
  }

  if (i.nbEvenements > 0) {
    out.push(
      `${i.nbEvenements} événement${i.nbEvenements > 1 ? 's' : ''} publié${i.nbEvenements > 1 ? 's' : ''} à cette date — sans lien de causalité établi avec les cours ci-dessus.`,
    );
  }

  return out;
}

export interface EventCommentaryInput {
  /**
   * Rendement ANORMAL post-événement de chaque titre lié, en % — c'est-à-dire
   * la performance du titre nette de celle de l'indice BRVM Composite sur la
   * fenêtre. Ce n'est pas la variation brute du cours.
   */
  impacts: { code: string; rendementAnormalPct: number | null }[];
  nbTitresLies: number;
  /** Largeur de la fenêtre d'étude, en séances. */
  fenetreSeances: number;
}

/**
 * Produit des constats sur un événement de marché. On décrit ce que les cours
 * ont fait autour de la date ; on n'affirme jamais que l'événement en est la cause.
 */
export function eventCommentary(i: EventCommentaryInput): string[] {
  const out: string[] = [];
  const mesures = i.impacts.filter((x) => x.rendementAnormalPct != null) as { code: string; rendementAnormalPct: number }[];

  if (mesures.length === 0) {
    return ['Aucun rendement n’est mesurable pour les titres liés à cet événement : historique de cours insuffisant autour de la date.'];
  }

  const hausses = mesures.filter((m) => m.rendementAnormalPct > 0).length;
  const baisses = mesures.filter((m) => m.rendementAnormalPct < 0).length;
  const moyenne = mesures.reduce((s, m) => s + m.rendementAnormalPct, 0) / mesures.length;

  out.push(
    `Sur les ${mesures.length} titre${mesures.length > 1 ? 's' : ''} liés, ${hausses} ${hausses > 1 ? 'ont fait mieux' : 'a fait mieux'} que l’indice ` +
    `et ${baisses} moins bien sur les ${i.fenetreSeances} séances suivant l’événement, ` +
    `pour un écart moyen à l’indice de ${pct(moyenne, 2)}.`,
  );

  const extreme = [...mesures].sort((a, b) => Math.abs(b.rendementAnormalPct) - Math.abs(a.rendementAnormalPct))[0]!;
  out.push(`L’écart le plus marqué revient à ${extreme.code} (${pct(extreme.rendementAnormalPct, 2)} par rapport à l’indice).`);

  const nonMesures = i.nbTitresLies - mesures.length;
  if (nonMesures > 0) {
    out.push(`${nonMesures} titre${nonMesures > 1 ? 's' : ''} lié${nonMesures > 1 ? 's' : ''} sans historique exploitable sur la fenêtre.`);
  }

  out.push(
    'Ces écarts sont mesurés autour de la date de l’événement ; ils ne lui sont pas attribués. ' +
    'D’autres facteurs peuvent expliquer le même mouvement.',
  );
  return out;
}
