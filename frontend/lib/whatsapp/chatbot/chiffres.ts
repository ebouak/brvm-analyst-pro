/**
 * Verrou des chiffres de l'assistant WhatsApp (spec §4). Module PUR.
 *
 * Tout nombre d'une réponse doit figurer dans les retours d'outils, dans la
 * conversation ou dans la question. Même règle que les articles, l'hebdo et les
 * dossiers : un chiffre non vérifiable ne part pas. Tolérances : l'arrondi
 * affiché (« 1,5 % » pour -1,53), l'échelle écrite (« 2,55 Md » pour
 * 2 550 000 000), les dates, années et petits entiers.
 */

const LIENS = /https?:\/\/\S+|www\.\S+|\b[\w-]+\.(?:com|org|net)\b\S*/gi;
const INDICES = /\bBRVM[\s-]?(?:C|10|30)\b/gi;
const NOMBRE = /\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;
const ECHELLE = /^\s*(milliards?|mds?|md|millions?|m(?![a-zé])|mille|k(?![a-z]))/i;

export interface NombreLu {
  brut: string;
  /** Valeur écrite (sans signe). */
  valeur: number;
  decimales: number;
  /** Valeur × échelle (« 2,55 Md » → 2,55e9). */
  cible: number;
  echelle: number;
}

function echelle(suite: string): number {
  const m = ECHELLE.exec(suite);
  if (!m) return 1;
  const mot = m[1]!.toLowerCase();
  if (mot.startsWith('md') || mot.startsWith('milliard')) return 1e9;
  if (mot === 'm' || mot.startsWith('million')) return 1e6;
  return 1e3;
}

export function extraireNombres(texte: string): NombreLu[] {
  const propre = texte.replace(LIENS, ' ').replace(INDICES, ' ');
  const sortie: NombreLu[] = [];
  for (const m of propre.matchAll(NOMBRE)) {
    const brut = m[0];
    // Collé à une lettre (« SNTS2 », « T3 », « S1 ») : un identifiant, pas un nombre.
    const avant = propre[m.index! - 1] ?? ' ';
    if (/[A-Za-z]/.test(avant)) continue;
    const net = brut.replace(/[   ]/g, '').replace(',', '.');
    const valeur = Number(net);
    if (!Number.isFinite(valeur)) continue;
    const decimales = net.includes('.') ? net.split('.')[1]!.length : 0;
    const e = echelle(propre.slice(m.index! + brut.length));
    sortie.push({ brut, valeur, decimales, cible: valeur * e, echelle: e });
  }
  return sortie;
}

function valeursSources(sources: string[]): number[] {
  const v: number[] = [];
  for (const s of sources) {
    for (const n of extraireNombres(s)) {
      v.push(n.valeur, n.cible);
    }
  }
  return v;
}

/** Nombres de `reponse` introuvables dans `sources` (texte brut tel qu'écrit). */
export function chiffresEtrangers(reponse: string, sources: string[]): string[] {
  const connus = valeursSources(sources);
  const refuses: string[] = [];
  for (const n of extraireNombres(reponse)) {
    if (n.echelle === 1 && Number.isInteger(n.valeur) && (n.valeur <= 12 || (n.valeur >= 1990 && n.valeur <= 2100))) continue;
    const tolerance = 0.5 * 10 ** -n.decimales * n.echelle + 1e-9;
    if (connus.some((s) => Math.abs(Math.abs(s) - n.cible) <= tolerance)) continue;
    refuses.push(n.brut);
  }
  return refuses;
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const TELEPHONE = /(?:\+|00)?\d(?:[\s.\-()]*\d){7,}/g;
const MONTANT = /^\d{1,3}(?:[   ]\d{3})+$/;

/** Avant tout envoi à un fournisseur d'IA : ni adresse e-mail ni numéro de téléphone. */
export function masquerDonneesPersonnelles(texte: string): string {
  return texte
    .replace(EMAIL, '[adresse masquée]')
    .replace(TELEPHONE, (m) => (MONTANT.test(m.trim()) ? m : '[numéro masqué]'));
}
