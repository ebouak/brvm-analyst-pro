/**
 * Émetteur désigné par le TITRE d'une publication BDFIN — module pur.
 *
 * Le collecteur attribue chaque publication à l'émetteur sélectionné sur la
 * page BDFIN. Or ces pages mêlent parfois les documents de plusieurs sociétés :
 * l'émetteur 1004 (CFAO Motors CI) liste aussi ceux de Tractafric Motors CI.
 * Constat du 2026-10-07 : 146 publications mal rangées, et des comptes extraits
 * du mauvais document (bilans et flux 2022-2023 de CFAC = ceux de PRSC ;
 * semestre 2026 de BICC = celui de BIIC Bénin).
 *
 * Les titres BDFIN finissent presque toujours par « - ÉMETTEUR » ou
 * « …: ÉMETTEUR », et les plus anciens commencent par « ÉMETTEUR: ». Quand le
 * titre nomme un émetteur, c'est lui qui fait foi ; quand il n'en nomme aucun
 * (« Etats financiers provisoires exercice 2009 »), on ne conclut rien.
 */

/**
 * Alias vérifiés : suffixes employés par BDFIN, chacun dominant à ≥ 90 % pour
 * un seul code dans la base (mesure du 2026-10-07), plus les noms historiques.
 * Les désignations officielles et les codes boursiers s'y ajoutent à
 * l'exécution (construireAlias).
 */
export const ALIAS_EMETTEURS: Readonly<Record<string, string>> = {
  'AFRICA GLOBAL LOGISTICS CI (EX BOLLORE)': 'SDSC',
  'AFRICA GLOBAL LOGISTICS CI': 'SDSC',
  'BOLLORE AFRICA LOGISTICS CI': 'SDSC',
  'BOLLORE TRANSPORT & LOGISTICS CI': 'SDSC',
  'BOLLORE TRANSPORT & LOGISTICS': 'SDSC',
  'ALIOS FINANCE CI': 'SAFC',
  'SAFCA CI': 'SAFC',
  'BICI CI': 'BICC',
  'BICICI': 'BICC',
  'BIIC BN': 'BICB',
  'BOA BF': 'BOABF',
  'BOA BURKINA FASO': 'BOABF',
  'BOA CI': 'BOAC',
  "BOA COTE D'IVOIRE": 'BOAC',
  'BOA MALI': 'BOAM',
  'BOA ML': 'BOAM',
  'BOA NG': 'BOAN',
  'BOA NIGER': 'BOAN',
  'BOA SENEGAL': 'BOAS',
  'BOA SN': 'BOAS',
  'BOA BENIN': 'BOAB',
  'BOA BN': 'BOAB',
  'CFAO CI': 'CFAC',
  'CFAO MOTORS CI': 'CFAC',
  'TRACTAFRIC MOTORS CI': 'PRSC',
  'TRACTAFRIC MOTORS': 'PRSC',
  'TM CI': 'PRSC',
  'TMCI': 'PRSC',
  // Fautes de frappe de BDFIN, vérifiées sur le nom du fichier PDF.
  'TRACTAFRIC MORTORS CI': 'PRSC',
  'TRACTAFRIC MTORS CI': 'PRSC',
  'TRACTAFRIC MTORS': 'PRSC',
  'TRACTAFRICS MOTORS CI': 'PRSC',
  // Ancien nom : BDFIN publie « … - SDA CI (TM CI).pdf ».
  'SDA CI': 'PRSC',
  'CIE': 'CIEC',
  'CIE CI': 'CIEC',
  'CORIS BANK INTERNATIONAL BF': 'CBIBF',
  'CORIS BANK INTERNATIONAL': 'CBIBF',
  'CROWN SIEM CI': 'SEMC',
  'CROWN SIEM': 'SEMC',
  // Nouveau nom de Crown Siem. Sans cet alias, l'annonce de prorogation de son
  // AG (dont BDFIN lie par erreur le PDF d'Orange CI) partait chez ORAC.
  'EVIOSYS PACKAGING SIEM': 'SEMC',
  'EVIOSYS PACKAGING SIEM CI': 'SEMC',
  'EVIOSYS PACKAGING SIEM (EX CROWN SIEM)': 'SEMC',
  'ECOBANK CI': 'ECOC',
  // « ECOBANK » seul désigne le groupe (ETI) ; la filiale ivoirienne écrit « ECOBANK CI ».
  'ECOBANK': 'ETIT',
  'ETI TG': 'ETIT',
  'ETI TOGO': 'ETIT',
  'ERIUM CI': 'SIVC',
  'FILTISAC CI': 'FTSC',
  'LNB BN': 'LNBB',
  'NSIA BANQUE CI': 'NSBC',
  'ONATEL BF': 'ONTBF',
  'ORAGROUP TG': 'ORGT',
  'ORANGE CI': 'ORAC',
  'PALM CI': 'PALC',
  'SGB CI': 'SGBC',
  'SGBCI': 'SGBC',
  'SGCI': 'SGBC',
  'SOCIETE GENERALE CI': 'SGBC',
  'SIB CI': 'SIBC',
  'SICABLE CI': 'CABC',
  'SICOR': 'SICC',
  'SICOR CI': 'SICC',
  'SITAB CI': 'STBC',
  'SMB': 'SMBC',
  'SODE CI': 'SDCC',
  'SOGB CI': 'SOGC',
  'SOLIBRA': 'SLBC',
  'SONATEL SN': 'SNTS',
  'SUCRIVOIRE CI': 'SCRC',
  'TOTAL SN': 'TTLS',
  'TOTALENERGIES MARKETING CI': 'TTLC',
  'TOTALENERGIES MARKETING SN': 'TTLS',
  'UNIWAX CI': 'UNXC',
};

export function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
}

/** Alias complets : désignations officielles, codes boursiers, puis alias vérifiés (prioritaires). */
export function construireAlias(instruments: { code: string; designation: string | null }[]): Map<string, string> {
  const alias = new Map<string, string>();
  for (const i of instruments) {
    alias.set(i.code, i.code);
    if (i.designation) alias.set(normaliser(i.designation), i.code);
  }
  for (const [k, v] of Object.entries(ALIAS_EMETTEURS)) alias.set(normaliser(k), v);
  return alias;
}

/** Retire la mention « (annule et remplace …) » qui suit parfois l'émetteur. */
function sansMention(libelle: string): string {
  return libelle.replace(/\s*\(annule[^)]*\)\s*$/i, '');
}

/** Code de l'émetteur que nomme le titre, ou null s'il n'en nomme aucun de connu. */
export function emetteurDuTitre(libelle: string, alias: Map<string, string>): string | null {
  const l = normaliser(sansMention(libelle));
  // « - ÉMETTEUR », « 2018- ÉMETTEUR » (BDFIN oublie parfois l'espace) ou « : ÉMETTEUR ».
  const suffixe = /(?:\s?[-–]\s|:\s*)([^-–:]{2,60})$/.exec(l)?.[1]?.trim();
  if (suffixe && alias.has(suffixe)) return alias.get(suffixe)!;
  const prefixe = /^([A-Z][A-Z0-9 .&'-]{1,25}):\s/.exec(l)?.[1]?.trim();
  if (prefixe && alias.has(prefixe)) return alias.get(prefixe)!;
  return null;
}

/**
 * Second indice, réservé aux documents rangés chez PLUSIEURS sociétés et dont
 * le titre ne nomme personne : le nom du fichier PDF. Il ne tranche que s'il
 * désigne UNE SEULE des sociétés candidates ; sinon null, et rien n'est touché.
 */
export function emetteurDuFichier(url: string | null, alias: Map<string, string>, candidats: Set<string>): string | null {
  if (!url) return null;
  let fichier: string;
  try { fichier = decodeURIComponent(url.split('/').pop() ?? ''); } catch { fichier = url.split('/').pop() ?? ''; }
  const f = ` ${normaliser(fichier).replace(/[^A-Z0-9&' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  const trouves = new Set<string>();
  for (const [nom, code] of alias) {
    if (!candidats.has(code) || nom.length < 4) continue;
    const n = normaliser(nom).replace(/[^A-Z0-9&' ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (n && f.includes(` ${n} `)) trouves.add(code);
  }
  return trouves.size === 1 ? [...trouves][0]! : null;
}

/**
 * Émetteur d'une publication d'après le titre ET le fichier.
 *
 * Recoupement RichBourse du 2026-10-07 : BDFIN se trompe parfois de TITRE
 * (fichier « … NEI-CEDA CI.pdf » sous le titre « … ECOBANK CI » ; fichier
 * « EVIOSYS PACKAGING SIEM … » sous le titre « … SGCI »), parfois de FICHIER
 * (titre « Prorogation … EVIOSYS » lié au rapport d'Orange CI). Quand titre et
 * fichier désignent deux sociétés différentes, rien n'est conclu : `conflit`.
 * Le fichier seul ne tranche que pour un document partagé entre plusieurs
 * sociétés (`partage`), dont le titre ne nomme personne.
 */
export function emetteurDuDocument(
  libelle: string,
  url: string | null,
  alias: Map<string, string>,
  codes: Set<string>,
  partage: Set<string> | null = null,
): { code: string | null; conflit: boolean; titre: string | null; fichier: string | null } {
  const titre = emetteurDuTitre(libelle, alias);
  const fichier = emetteurDuFichier(url, alias, codes);
  if (titre && fichier && titre !== fichier) return { code: null, conflit: true, titre, fichier };
  if (titre) return { code: titre, conflit: false, titre, fichier };
  if (partage && partage.size > 1) return { code: emetteurDuFichier(url, alias, partage), conflit: false, titre, fichier };
  return { code: null, conflit: false, titre, fichier };
}

/**
 * Code sous lequel le collecteur range une publication trouvée sur la page
 * BDFIN de `page`. Même règle que la commande de rattachement : on ne quitte
 * le code de la page que si le titre ET le nom du fichier désignent la même
 * autre société cotée. Lus le 2026-10-07, trois PDF titrés pour une autre
 * société (fichier muet) étaient ceux de la page : le titre seul ne suffit pas.
 */
export function codeDeCollecte(page: string, libelle: string, url: string | null, alias: Map<string, string>, codes: Set<string>): string {
  const d = emetteurDuDocument(libelle, url, alias, codes);
  return !d.conflit && d.code && d.code !== page && d.fichier === d.code && codes.has(d.code) ? d.code : page;
}

/**
 * Garde-fou des extractions de chiffres : renvoie le code d'une AUTRE société
 * si le titre OU le fichier en nomme une ; null sinon. Plus strict que le
 * rattachement : lire un PDF étranger fabrique des comptes faux.
 */
export function documentEtranger(code: string, libelle: string, url: string | null, alias: Map<string, string>, codes: Set<string>): string | null {
  const titre = emetteurDuTitre(libelle, alias);
  if (titre && titre !== code) return titre;
  const fichier = emetteurDuFichier(url, alias, codes);
  return fichier && fichier !== code ? fichier : null;
}

/**
 * Code que désigne le titre quand il CONTREDIT le code rattaché ; null si le
 * titre confirme le code ou ne nomme aucun émetteur.
 */
export function emetteurContredit(code: string, libelle: string, alias: Map<string, string>): string | null {
  const titre = emetteurDuTitre(libelle, alias);
  return titre && titre !== code ? titre : null;
}
