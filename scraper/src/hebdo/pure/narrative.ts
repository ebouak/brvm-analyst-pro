// COPIE de frontend/lib/hebdo — frontend et scraper sont deux paquets TS distincts
// (pas de module partagé dans ce repo). Toute correction doit être reportée des deux côtés.
// Régénérer avec `node scripts/sync-hebdo-pure.mjs` (vérifié par tests/hebdoCopies.test.ts).
/**
 * Narratif d'une valeur : squelette 100 % déterministe (chaque phrase dérive
 * d'une métrique FIGÉE dans le snapshot) + garde-fous qui empêchent toute
 * reformulation LLM d'introduire un chiffre absent des données, une causalité
 * ou une recommandation. Règle §5 : rien d'inventé.
 *
 * Posture (passage 2026-11-15) : note d'analyste sans recommandation. Six
 * sections, chacune omise quand ses données manquent : La semaine · Dans quel
 * contexte · Ce que paie le marché · La liquidité · Lecture technique · Ce
 * qu'il faut garder en tête. Les extensions mécaniques du canal (amplitude
 * reportée) ne sont plus écrites : présentées à côté d'un cours, elles se
 * lisent comme un objectif de cours, ce qu'elles ne sont pas.
 */
import { fmtMontant, fmtNombre, fmtPct, fmtRatio } from './format.js';
import type { HebdoMetrics, HebdoContexte, HebdoAnalyse } from './types.js';

export interface Skeleton {
  sections: { titre: string; texte: string }[];
  /** TOUS les nombres autorisés dans la reformulation (whitelist du garde-fou). */
  chiffres: number[];
  verdict: string;
}

export const TITRES = {
  semaine: 'La semaine',
  contexte: 'Dans quel contexte',
  valorisation: 'Ce que paie le marché',
  liquidite: 'La liquidité',
  technique: 'Lecture technique',
  vigilance: 'Ce qu’il faut garder en tête',
} as const;

/**
 * Constantes structurelles écrites LITTÉRALEMENT : RSI sur 14 séances, canal
 * de 20 séances, échelle sur 100, seuils 30 / 70, « 1er janvier »,
 * 52 semaines, 30 séances. Sans elles, le garde-fou rejetterait un texte fidèle.
 */
const CONSTANTES_TEXTE = [1, 14, 20, 30, 52, 70, 100];

/** Seuil à partir duquel une progression du bénéfice appelle une mise en garde. */
const BENEFICE_FORTE_HAUSSE = 50;
/** Part hors exploitation du résultat avant impôts jugée significative. */
const HORS_EXPLOITATION_NOTABLE = 20;
/** Fourchette de carnet jugée coûteuse. */
const FOURCHETTE_LARGE = 2;
/** En deçà de cet écart (en points), un titre « évolue en ligne » avec l'indice. */
const ECART_EN_LIGNE = 0.5;

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Plume : chaque nombre écrit passe par elle et entre dans la liste blanche.
 * C'est ce qui garantit que le squelette passe son propre garde-fou.
 */
class Plume {
  chiffres: number[] = [];
  private reg(x: number): void { this.chiffres.push(Math.round(Math.abs(x) * 100) / 100); }
  prix(x: number): string { this.reg(x); return `${fmtNombre(x, Number.isInteger(x) ? 0 : 2)} FCFA`; }
  nombre(x: number): string { this.reg(x); return fmtNombre(x); }
  pct(x: number, d = 2): string { const v = Math.round(Math.abs(x) * 10 ** d) / 10 ** d; this.reg(v); return fmtPct(v, d); }
  ratio(x: number): string { const v = Math.round(x * 10) / 10; this.reg(v); return fmtRatio(v); }
  montant(x: number): string {
    const v = Math.abs(x);
    if (v >= 1e9) this.reg(Math.round((v / 1e9) * 10) / 10);
    else if (v >= 1e6) this.reg(Math.round((v / 1e6) * 10) / 10);
    else this.reg(Math.round(v));
    return fmtMontant(x);
  }
  /** « 13 novembre » (sans année) ou « 13 novembre 2026 ». */
  date(iso: string, avecAnnee = false): string {
    const [a, m, j] = iso.split('-').map((x) => parseInt(x, 10));
    this.reg(j ?? 0);
    if (avecAnnee) this.reg(a ?? 0);
    return `${j} ${MOIS[(m ?? 1) - 1]}${avecAnnee ? ` ${a}` : ''}`;
  }
  annee(x: string | number): string { this.reg(Number(x)); return String(x); }
}

function periodeSemaine(p: Plume, a: HebdoAnalyse): string {
  const [, m1] = a.semaine.debut.split('-');
  const [, m2] = a.semaine.fin.split('-');
  const j1 = parseInt(a.semaine.debut.slice(8), 10);
  if (m1 === m2) { p.nombre(j1); return `du ${j1} au ${p.date(a.semaine.fin)}`; }
  return `du ${p.date(a.semaine.debut)} au ${p.date(a.semaine.fin)}`;
}

const verbe = (v: number, h: string, b: string) => (v > 0 ? h : v < 0 ? b : 'est stable');

function sectionSemaine(m: HebdoMetrics, p: Plume): string {
  const a = m.analyse;
  let s = a
    ? `${m.code} termine la semaine ${periodeSemaine(p, a)} à ${p.prix(m.dernier)}`
    : `${m.code} termine la semaine à ${p.prix(m.dernier)}`;
  const v = m.variationHebdo;
  if (v != null) {
    if (Math.abs(v) < 0.005) s += ', inchangé';
    else s += `, ${v > 0 ? 'en hausse' : 'en repli'} de ${p.pct(v)}`;
    s += a?.semaine.dateReference ? ` par rapport à la clôture du ${p.date(a.semaine.dateReference)}` : ' sur la semaine';
  }
  const phrases = [`${s}.`];
  // Snapshot sans analyse enrichie : le volume n'a pas de section « liquidité ».
  if (!a && m.ratioVolume != null) {
    phrases.push(`Le volume de la dernière séance représente ${p.ratio(m.ratioVolume)} fois le volume moyen des 20 dernières séances.`);
  }
  if (a?.marche) {
    const mk = a.marche.variation;
    let t = `Sur la même période, le ${a.marche.libelle} ${verbe(mk, 'progresse', 'recule')}${mk !== 0 ? ` de ${p.pct(mk)}` : ''}`;
    const sec = a.secteur?.indice;
    if (sec) t += ` et l’${sec.libelle} ${verbe(sec.variation, 'progresse', 'recule')}${sec.variation !== 0 ? ` de ${p.pct(sec.variation)}` : ''}`;
    phrases.push(`${t}.`);
    if (v != null) {
      const compare = (x: number, nom: string) => {
        const d = Math.round((v - x) * 10) / 10;
        if (Math.abs(d) < ECART_EN_LIGNE) return `évolue en ligne avec ${nom}`;
        const pts = `${p.ratio(Math.abs(d))} point${Math.abs(d) >= 2 ? 's' : ''}`;
        return d > 0 ? `fait mieux que ${nom} de ${pts}` : `fait moins bien que ${nom} de ${pts}`;
      };
      let c = `Le titre ${compare(mk, 'le marché')}`;
      if (sec) c += ` et ${compare(sec.variation, 'son secteur').replace(/^(fait|évolue) /, '')}`;
      phrases.push(`${c}.`);
    }
  }
  return phrases.join(' ');
}

function sectionContexte(m: HebdoMetrics, p: Plume, ctx?: HebdoContexte): string | null {
  const a = m.analyse;
  const phrases: string[] = [];
  if (a) {
    const { haut52, bas52, depuisJanvier, dateRefJanvier } = a.annee;
    if (haut52 != null && bas52 != null) {
      let t = `Sur 52 semaines, le cours a évolué entre ${p.prix(bas52)} et ${p.prix(haut52)}`;
      if (m.dernier >= haut52) t += ' : il clôture sur son plus haut de la période';
      else if (m.dernier <= bas52) t += ' : il clôture sur son plus bas de la période';
      else {
        t += ` ; il se situe ${p.pct(((haut52 - m.dernier) / haut52) * 100, 1)} sous son plus haut et ` +
          `${p.pct(((m.dernier - bas52) / bas52) * 100, 1)} au-dessus de son plus bas`;
      }
      phrases.push(`${t}.`);
    }
    if (depuisJanvier != null && dateRefJanvier) {
      phrases.push(
        `Depuis le 1er janvier, le titre ${depuisJanvier >= 0 ? 'gagne' : 'perd'} ${p.pct(depuisJanvier)} ` +
        `(référence : clôture du ${p.date(dateRefJanvier, true)}).`,
      );
    }
    const passes = a.evenements.filter((e) => !e.aVenir);
    const futurs = a.evenements.filter((e) => e.aVenir);
    const decrit = (e: HebdoAnalyse['evenements'][number]) => {
      const quand = p.date(e.date);
      switch (e.nature) {
        case 'publication': return `publication « ${e.libelle} » le ${quand}`;
        case 'actualite': return `« ${e.libelle} » le ${quand}`;
        case 'operation': return `opération sur titres (${e.libelle}) le ${quand}`;
        case 'detachement': return `détachement du ${e.libelle} le ${quand}`;
        case 'paiement': return `paiement du ${e.libelle} le ${quand}`;
      }
    };
    if (passes.length > 0) phrases.push(`Cette semaine, nos données enregistrent : ${passes.map(decrit).join(' ; ')}.`);
    if (futurs.length > 0) phrases.push(`À venir : ${futurs.map(decrit).join(' ; ')}.`);
    if (passes.length === 0 && phrases.length > 0) {
      phrases.push('Aucune publication, aucun détachement de dividende ni aucune opération sur titres n’est enregistré dans nos données pour cette semaine.');
    }
  }
  // Éclairages historiques (snapshots sans analyse enrichie).
  if (!a && ctx?.fondamental) { phrases.push(ctx.fondamental.phrase); p.chiffres.push(...ctx.fondamental.chiffres); }
  if (ctx?.evenement) { phrases.push(ctx.evenement.phrase); p.chiffres.push(...ctx.evenement.chiffres); }
  return phrases.length > 0 ? phrases.join(' ') : null;
}

function sectionValorisation(m: HebdoMetrics, p: Plume): string | null {
  const a = m.analyse;
  if (!a) return null;
  const phrases: string[] = [];
  const v = a.valorisation;
  const b = a.benefice;
  if (v) {
    let t = `Au cours de clôture, le titre se paie ${p.ratio(v.per)} fois le bénéfice de l’exercice ${p.annee(v.exercice)} ` +
      `(${p.prix(v.bpa)} par action, résultat net consolidé)`;
    if (v.perMedianeSecteur != null) {
      t += `, contre une médiane de ${p.ratio(v.perMedianeSecteur)} fois pour les ${p.nombre(v.nbPairsPer)} autres valeurs ` +
        `du secteur dont les comptes le permettent`;
    }
    phrases.push(`${t}.`);
  } else if (b && b.resultatNet < 0) {
    phrases.push(`La société a publié une perte nette de ${p.montant(b.resultatNet)} sur l’exercice ${p.annee(b.exercice)} : le multiple de bénéfices n’a pas de sens.`);
  }
  const d = a.dividende;
  if (d) {
    let t = `Le dernier dividende, ${p.prix(d.montant)} net par action au titre de ${p.annee(d.exercice)}, représente ${p.pct(d.rendementPct)} du cours`;
    if (d.rendementMedianeSecteur != null) t += ` (médiane du secteur : ${p.pct(d.rendementMedianeSecteur)}, sur ${p.nombre(d.nbPairs)} valeurs)`;
    phrases.push(`${t}.`);
  }
  if (b && b.resultatNet > 0 && b.variationNetPct != null) {
    let t = `Le bénéfice net ${p.annee(b.exercice)} (${p.montant(b.resultatNet)}) ${b.variationNetPct >= 0 ? 'progresse' : 'recule'} de ${p.pct(b.variationNetPct, 1)} sur un an`;
    if (b.variationExploitationPct != null) {
      t += ` ; le résultat d’exploitation ${b.variationExploitationPct >= 0 ? 'progresse' : 'recule'} de ${p.pct(b.variationExploitationPct, 1)}`;
    }
    phrases.push(`${t}.`);
    const h = b.partHorsExploitationPct;
    if (h != null && (Math.abs(b.variationNetPct) >= 30 || h > HORS_EXPLOITATION_NOTABLE)) {
      if (h > HORS_EXPLOITATION_NOTABLE) {
        phrases.push(`${p.pct(h, 1)} du résultat avant impôts provient d’éléments situés hors de l’exploitation (résultat financier, éléments non courants), dont rien ne garantit la répétition.`);
      } else if (h <= 0 && b.resultatAvantImpots != null && b.resultatExploitation != null) {
        phrases.push(
          `Le résultat avant impôts (${p.montant(b.resultatAvantImpots)}) n’excède pas le résultat d’exploitation ` +
          `(${p.montant(b.resultatExploitation)}) : la progression ne repose pas sur des éléments hors exploitation.`,
        );
      } else {
        phrases.push(`L’essentiel du résultat avant impôts provient de l’exploitation (part hors exploitation : ${p.pct(h, 1)}).`);
      }
    }
  } else if (b && b.resultatNet < 0 && b.resultatExploitation != null && b.resultatExploitation > 0) {
    phrases.push(`Le résultat d’exploitation reste positif (${p.montant(b.resultatExploitation)}) : la perte se forme sous l’exploitation, au niveau financier ou non courant.`);
  }
  return phrases.length > 0 ? phrases.join(' ') : null;
}

function sectionLiquidite(m: HebdoMetrics, p: Plume): string | null {
  const a = m.analyse;
  if (!a) return null;
  const l = a.liquidite;
  const phrases: string[] = [];
  if (l.titresSemaine != null && l.valeurSemaine != null) {
    let t = `Sur la semaine, ${p.nombre(l.titresSemaine)} titres ont changé de mains pour ${p.montant(l.valeurSemaine)}`;
    if (l.partMarchePct != null) t += `, soit ${p.pct(l.partMarchePct)} des capitaux échangés sur l’ensemble de la cote`;
    phrases.push(`${t}.`);
  }
  if (l.titresSeance != null && l.valeurSeance != null) {
    let t = `La dernière séance a porté sur ${p.nombre(l.titresSeance)} titres (${p.montant(l.valeurSeance)})`;
    if (m.ratioVolume != null) t += `, ${p.ratio(m.ratioVolume)} fois le volume moyen des 20 dernières séances`;
    phrases.push(`${t}.`);
  }
  if (l.valeurMoyenne30j != null) phrases.push(`Sur 30 séances, il s’en échange en moyenne ${p.montant(l.valeurMoyenne30j)} par séance.`);
  const c = l.carnet;
  if (c) {
    const cote = (prix: number | null, auMarche: boolean, sens: string) =>
      auMarche ? `un ordre ${sens} « au marché », sans limite de prix` : prix != null && prix > 0 ? `une meilleure offre ${sens} à ${p.prix(prix)}` : `aucune offre ${sens}`;
    let t = `Le carnet d’ordres publié pour la séance du ${p.date(c.date)} affichait ${cote(c.coursAchat, c.achatAuMarche, 'd’achat')} ` +
      `et ${cote(c.coursVente, c.venteAuMarche, 'de vente')}`;
    if (c.fourchettePct != null) t += `, soit une fourchette de ${p.pct(c.fourchettePct)}`;
    phrases.push(`${t} ; seule la meilleure limite de chaque côté est publiée.`);
  }
  if (l.classe && l.libelleClasse) phrases.push(`Classe de liquidité WestBourse : ${l.classe} (${l.libelleClasse}).`);
  return phrases.length > 0 ? phrases.join(' ') : null;
}

function sectionTechnique(m: HebdoMetrics, p: Plume): string | null {
  const phrases: string[] = [];
  if (m.rsiDernier != null) {
    const r = m.rsiDernier;
    const lecture = r > 70
      ? 'au-dessus du seuil de 70 qui définit conventionnellement le surachat'
      : r < 30
        ? 'sous le seuil de 30 qui définit conventionnellement la survente'
        : 'entre les seuils de 30 et 70 : ni surachat ni survente';
    let t = `Le RSI sur 14 séances s’établit à ${p.ratio(r)} sur 100, ${lecture}.`;
    if (m.macdPositif != null) {
      t += m.macdPositif
        ? ' Le MACD est positif : la moyenne courte des cours reste au-dessus de la moyenne longue.'
        : ' Le MACD est négatif : la moyenne courte des cours reste sous la moyenne longue.';
    }
    phrases.push(t);
  }
  const l = m.levels;
  if (l) {
    const marge = l.margePct ?? m.analyse?.margePct ?? null;
    const ecH = l.ecartPlafondPct ?? (l.resistance > 0 ? ((l.dernier - l.resistance) / l.resistance) * 100 : 0);
    const ecB = l.ecartPlancherPct ?? (l.support > 0 ? ((l.dernier - l.support) / l.support) * 100 : 0);
    const res = () => p.prix(l.resistance);
    const sup = () => p.prix(l.support);
    const margeTxt = () => `la marge de ${p.nombre(marge ?? 0)} % retenue pour parler de sortie de canal`;
    const auDela = () => (marge != null && marge > 0 ? `, au-delà de ${margeTxt()}` : '');
    const position = (ec: number) => (Math.abs(ec) < 0.005 ? 'exactement sur' : `${p.pct(ec)} ${ec > 0 ? 'au-dessus' : 'en dessous'} de`);
    if (l.cassureHaut) {
      phrases.push(
        `Le cours clôture ${position(ecH)} son plus haut des 20 séances précédentes (${res()})${auDela()} : ` +
        `il sort de son canal par le haut. Une clôture sous ${res()} le ramènerait dans ce canal, dont le plancher se situe à ${sup()}.`,
      );
    } else if (l.cassureBas) {
      phrases.push(
        `Le cours clôture ${position(ecB)} son plus bas des 20 séances précédentes (${sup()})${auDela()} : ` +
        `il sort de son canal par le bas. Une clôture au-dessus de ${sup()} le ramènerait dans ce canal, dont le plafond se situe à ${res()}.`,
      );
    } else if (l.contactHaut) {
      phrases.push(
        `Le cours clôture ${position(ecH)} son plus haut des 20 séances précédentes (${res()}). L’écart est inférieur à ${margeTxt()} : ` +
        `le titre est au contact de son plafond, sans l’avoir franchi nettement. Le plancher du canal se situe à ${sup()}, ` +
        `${p.pct(Math.abs(ecB), 1)} sous le cours.`,
      );
    } else if (l.contactBas) {
      phrases.push(
        `Le cours clôture ${position(ecB)} son plus bas des 20 séances précédentes (${sup()}). L’écart est inférieur à ${margeTxt()} : ` +
        `le titre est au contact de son plancher, sans l’avoir rompu nettement. Le plafond du canal se situe à ${res()}, ` +
        `${p.pct(Math.abs(ecH), 1)} au-dessus du cours.`,
      );
    } else {
      phrases.push(
        `Le cours évolue dans son canal des 20 séances précédentes, entre ${sup()} et ${res()} : ` +
        `${p.pct(Math.abs(ecB), 1)} au-dessus du plancher, ${p.pct(Math.abs(ecH), 1)} sous le plafond.`,
      );
    }
  }
  return phrases.length > 0 ? phrases.join(' ') : null;
}

function sectionVigilance(m: HebdoMetrics, p: Plume): string | null {
  const a = m.analyse;
  const phrases: string[] = [];
  const classe = a?.liquidite.classe;
  if (classe === 'C' || classe === 'D') {
    phrases.push(`La liquidité est faible (classe ${classe}) : quelques ordres suffisent à déplacer le cours, et une variation de séance peut reposer sur peu de titres.`);
  }
  const f = a?.liquidite.carnet?.fourchettePct;
  if (f != null && f >= FOURCHETTE_LARGE) {
    phrases.push(`L’écart entre les meilleures offres d’achat et de vente (${p.pct(f)}) est un coût immédiat pour un ordre exécuté sans attendre.`);
  }
  if (m.rsiDernier != null && m.rsiDernier > 70) phrases.push('Un RSI en zone de surachat mesure l’ampleur de la hausse récente ; il n’indique ni sa durée ni son issue.');
  if (m.rsiDernier != null && m.rsiDernier < 30) phrases.push('Un RSI en zone de survente mesure l’ampleur de la baisse récente ; il n’indique ni sa durée ni son issue.');
  const b = a?.benefice;
  if (b && a?.valorisation && b.variationNetPct != null && b.variationNetPct >= BENEFICE_FORTE_HAUSSE) {
    phrases.push(`Le multiple de bénéfices repose sur un bénéfice en hausse de ${p.pct(b.variationNetPct, 1)} : si ce niveau ne se maintient pas, le multiple réellement payé sera plus élevé.`);
  }
  if (b && b.partHorsExploitationPct != null && b.partHorsExploitationPct > HORS_EXPLOITATION_NOTABLE && b.resultatNet > 0) {
    phrases.push('Une part notable du bénéfice provient d’éléments hors exploitation.');
  }
  if (b && b.resultatNet < 0) phrases.push('La société est en perte sur son dernier exercice publié.');
  return phrases.length > 0 ? phrases.join(' ') : null;
}

export function buildSkeleton(m: HebdoMetrics, ctx?: HebdoContexte): Skeleton {
  const p = new Plume();
  p.chiffres.push(...CONSTANTES_TEXTE);
  const sections: { titre: string; texte: string }[] = [];
  const ajoute = (titre: string, texte: string | null) => { if (texte) sections.push({ titre, texte }); };
  ajoute(TITRES.semaine, sectionSemaine(m, p));
  ajoute(TITRES.contexte, sectionContexte(m, p, ctx));
  ajoute(TITRES.valorisation, sectionValorisation(m, p));
  ajoute(TITRES.liquidite, sectionLiquidite(m, p));
  ajoute(TITRES.technique, sectionTechnique(m, p));
  ajoute(TITRES.vigilance, sectionVigilance(m, p));

  const verdict = m.variationHebdo != null && m.variationHebdo >= 0 ? 'Semaine en hausse' : 'Semaine en baisse';
  return { sections, chiffres: [...new Set(p.chiffres.map((x) => Math.round(x * 100) / 100))], verdict };
}

/**
 * Garde-fou : tout nombre présent dans `texte` doit figurer dans `chiffres`
 * (tolérance d'arrondi 1 %). Retourne false si le LLM a inventé une valeur.
 */
export function assertNoForeignNumber(texte: string, chiffres: number[]): boolean {
  // Les montants sont écrits à la française (« 3 050 FCFA ») : on recolle les
  // milliers avant d'extraire, sinon « 3 050 » se lirait « 3 » puis « 050 » et
  // le garde-fou rejetterait à tort un texte parfaitement fidèle.
  const normalise = texte.replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1');
  const trouves = (normalise.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
  return trouves.every((n) =>
    chiffres.some((c) => Math.abs(c - n) <= Math.max(0.5, Math.abs(c) * 0.01)),
  );
}

/**
 * Connecteurs qui affirment une CAUSE. Un texte d'analyse peut juxtaposer un
 * fait daté et un mouvement de cours ; il ne peut pas prétendre que l'un
 * explique l'autre — nous n'avons aucune donnée qui l'établisse.
 */
const CONNECTEURS_CAUSAUX = [
  'à cause de', 'a cause de',
  'en raison de',
  'suite à', 'suite a',
  'provoqué par', 'provoque par',
  'expliqué par', 'explique par',
  's’explique par', "s'explique par",
  'dû à', 'du à', 'due à',
  'sous l’effet de', "sous l'effet de",
  'grâce à', 'grace a',
  'porté par', 'porte par',
  'plombé par', 'plombe par',
];

/** false si le texte affirme un lien de causalité (→ on rejette la sortie LLM). */
export function assertNoCausalClaim(texte: string): boolean {
  const t = texte.toLowerCase();
  return !CONNECTEURS_CAUSAUX.some((c) => t.includes(c));
}

/**
 * Formules de recommandation : un texte d'analyse décrit, il ne dit pas quoi
 * faire. « offre d'achat » (carnet) et « surachat » restent permis.
 */
const RECOMMANDATIONS = [
  /\bachet(?:er|ez|ons)\b/i, /\bvend(?:re|ez|ons)\b/i, /\bopportunit/i, /objectif de cours/i, /cours cible/i,
  /\bcible\b/i, /recommand/i, /\bconseill/i, /à saisir/i, /\brenforcer\b/i, /\balléger\b/i, /point d[’']entrée/i,
  /potentiel de hausse/i, /prendre (?:ses|vos) bénéfices/i, /\bà privilégier\b/i, /\bà éviter\b/i,
];

/** false si le texte contient une formule de recommandation. */
export function assertNoRecommendation(texte: string): boolean {
  return !RECOMMANDATIONS.some((re) => re.test(texte));
}
