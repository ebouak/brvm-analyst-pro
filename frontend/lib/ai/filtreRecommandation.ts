/**
 * Filtre de sortie : détecte une RECOMMANDATION d'investissement dans un texte
 * rédigé par un modèle (assistant IA, diagnostic).
 *
 * Pourquoi : une réponse qui dit « achetez », « objectif 15 000 FCFA » ou
 * « stop-loss à 12 000 » a le format d'un conseil en investissement, activité
 * réglementée par l'AMF-UMOA. WESTBOURSE fournit de l'information générale :
 * aucune prescription, aucun prix d'entrée, objectif, stop ni taille de
 * position (audit de conformité, lot B, 2026-11-11).
 *
 * Le prompt l'interdit déjà ; ce filtre existe parce qu'un prompt n'est pas une
 * garantie (un modèle de repli peut l'ignorer). Il est PUR et testé.
 *
 * Règles de lecture, pour limiter les faux positifs :
 *  - les verbes à l'impératif (« achetez ») ne comptent qu'en DÉBUT de phrase,
 *    de puce ou après deux-points : « si vous achetez des titres, la SGI
 *    prélève des frais » est une explication, pas une consigne ;
 *  - le jargon de trading (objectif de cours, stop-loss, prix d'entrée, taille
 *    de position) est toléré dans une phrase NÉGATIVE (« WESTBOURSE ne fixe ni
 *    objectif de cours ni stop-loss ») ; une prescription formulée à la
 *    première personne ne l'est jamais (« je vous recommande de ne pas
 *    vendre » reste une recommandation) ;
 *  - les mots « acheteur », « vendeur », « achète une filiale », « a vendu »
 *    décrivent le marché ou la société : ils ne sont pas visés.
 */

export interface MotifDetecte {
  /** Identifiant stable du motif, pour les journaux et les tests. */
  code: string;
  /** Extrait du texte qui a déclenché la détection. */
  extrait: string;
}

export interface VerdictRecommandation {
  recommandation: boolean;
  motifs: MotifDetecte[];
}

const VERBES_IMPERATIFS =
  "achetez|vendez|renforcez|all[ée]gez|conservez|c[ée]dez|accumulez|liquidez|soldez|arbitrez|initiez|ouvrez une position|prenez (?:vos|des) b[ée]n[ée]fices|entrez sur|sortez de";

const VERBES_INFINITIFS =
  "acheter|vendre|renforcer|all[ée]ger|conserver|c[ée]der|accumuler|liquider|solder|arbitrer|prendre (?:vos|des|ses) b[ée]n[ée]fices|entrer sur|sortir de|initier une position|ouvrir une position";

/** Motifs prescriptifs : jamais tolérés, même dans une phrase négative. */
const PRESCRIPTIONS: Array<{ code: string; re: RegExp }> = [
  {
    code: 'je-recommande',
    re: /\b(?:je|nous)\s+(?:vous\s+|te\s+)?(?:recommande|recommandons|conseille|conseillons|sugg[èe]re|sugg[ée]rons|pr[ée]conise|pr[ée]conisons)\b/i,
  },
  {
    code: 'recommandation-directionnelle',
    re: new RegExp(
      `\\b(?:recommandation|signal|verdict|orientation|avis|d[ée]cision|conclusion)\\s*(?:\\*\\*)?\\s*[:|=–-]\\s*(?:\\*\\*)?\\s*(?:achat|vente|${VERBES_INFINITIFS}|conserver)\\b`,
      'i',
    ),
  },
  { code: 'achat-fort', re: /\b(?:achat|vente)\s+(?:fort|forte|tr[èe]s fort)\b/i },
  {
    code: 'imperatif',
    re: new RegExp(`(?:^|[.!?:;•]|\\n)\\s*(?:[-*+]|\\d+[.)])?\\s*(?:\\*\\*)?(?:${VERBES_IMPERATIFS})\\b`, 'i'),
  },
  {
    code: 'vous-devriez',
    re: new RegExp(
      `\\b(?:vous\\s+devriez|vous\\s+devez|il\\s+faut|il\\s+faudrait|il\\s+(?:est|serait)\\s+(?:conseill[ée]|judicieux|opportun|pr[ée]f[ée]rable)\\s+d['’]|mieux\\s+vaut|je\\s+vous\\s+invite\\s+[àa]|n'h[ée]sitez\\s+pas\\s+[àa])\\s*(?:${VERBES_INFINITIFS})\\b`,
      'i',
    ),
  },
  {
    code: 'bon-point-entree',
    re: /\b(?:bon|excellent|bel|int[ée]ressant)\s+(?:point|moment|niveau)\s+(?:d['’]\s*)?(?:entr[ée]e|achat)\b|\bopportunit[ée]\s+d['’]\s*achat\b|\b[àa]\s+acheter\s+(?:maintenant|d[èe]s\s+maintenant|sans\s+attendre)\b/i,
  },
];

/** Jargon de trading : toléré seulement dans une phrase négative. */
const JARGON: Array<{ code: string; re: RegExp }> = [
  { code: 'objectif-de-cours', re: /\b(?:objectifs?\s+de\s+(?:cours|prix)|cours[\s-]cibles?|prix[\s-]cibles?|objectif\s+(?:[àa]\s+\d+\s+mois\s*)?[:=]?\s*\d)/i },
  { code: 'objectif-tableau', re: /\|\s*(?:\*\*)?objectif(?:\s+\d+\s+mois)?(?:\*\*)?\s*\|/i },
  { code: 'stop-loss', re: /\bstop[\s-]?loss\b|\bstop\s*(?:[:=]|[àa]\s+\d)/i },
  {
    // « votre prix d'entrée moyen » (PRU) décrit une position existante : exclu.
    code: 'prix-entree',
    re: /(?<!\bvotre\s)(?<!\bvos\s)(?<!\bmon\s)\b(?:prix|point|niveau|zone|cours)\s+d['’]\s*entr[ée]e\b(?!\s+moyen)|\bentr[ée]e\s+cible\b/i,
  },
  { code: 'taille-position', re: /\btaille\s+(?:de\s+(?:la\s+)?)?position\b|\b(?:allouez|investissez|placez)\s+\d/i },
];

const NEGATION = /\b(?:ne|n['’]|ni|aucun|aucune|jamais|sans|pas\s+de|pas\s+d['’])\b|\bn['’]/i;

/** Découpe en phrases (et en lignes, pour les tableaux et les puces). */
function phrases(texte: string): string[] {
  return texte
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function extrait(texte: string, index: number, longueur: number): string {
  const debut = Math.max(0, index - 20);
  return texte.slice(debut, index + longueur + 20).replace(/\s+/g, ' ').trim();
}

export function detecterRecommandation(brut: string): VerdictRecommandation {
  const texte = String(brut ?? '');
  const motifs: MotifDetecte[] = [];

  for (const { code, re } of PRESCRIPTIONS) {
    const m = re.exec(texte);
    if (m) motifs.push({ code, extrait: extrait(texte, m.index, m[0].length) });
  }

  for (const phrase of phrases(texte)) {
    for (const { code, re } of JARGON) {
      const m = re.exec(phrase);
      if (!m) continue;
      if (NEGATION.test(phrase)) continue;
      if (!motifs.some((x) => x.code === code)) {
        motifs.push({ code, extrait: extrait(phrase, m.index, m[0].length) });
      }
    }
  }

  return { recommandation: motifs.length > 0, motifs };
}

/**
 * Consigne de réécriture envoyée UNE fois au modèle quand sa réponse est
 * refusée. Elle cite les motifs détectés, pas le texte : le modèle a déjà sa
 * réponse dans la conversation.
 */
export function consigneReecriture(motifs: MotifDetecte[]): string {
  const liste = motifs.map((m) => `« ${m.extrait} »`).join(', ');
  return [
    'Ta réponse précédente contient une recommandation d’investissement, ce qui est interdit :',
    liste + '.',
    'Réécris-la entièrement en information générale : garde les faits et les chiffres fournis,',
    'retire tout verbe de prescription (acheter, vendre, conserver, renforcer, alléger), tout prix',
    'd’entrée, objectif de cours, stop-loss, taille de position et tout verdict. Ne commente pas',
    'la réécriture : donne directement la nouvelle réponse.',
  ].join(' ');
}

/**
 * Réponse de repli quand la réécriture échoue aussi. Elle ne contient AUCUN
 * chiffre (elle ne peut donc rien affirmer de faux) et passe elle-même le
 * filtre — un test le vérifie.
 */
export const REPONSE_PRUDENTE = [
  'Je ne peux pas formuler de recommandation sur un titre ni fixer de niveau de prix : WESTBOURSE fournit de l’information générale sur le marché, pas un conseil en investissement.',
  '',
  'Pour vous faire votre propre opinion, les critères à examiner sont notamment :',
  '- la tendance du cours et les indicateurs techniques affichés sur la fiche de la valeur ;',
  '- la valorisation (PER, rapport cours / valeur comptable) comparée à la médiane du secteur ;',
  '- la régularité des résultats et des dividendes publiés ;',
  '- la liquidité du titre, qui conditionne la facilité d’exécution d’un ordre.',
  '',
  'Pour une décision qui tient compte de votre situation, adressez-vous à une SGI ou à un conseiller agréé par l’AMF-UMOA.',
].join('\n');
