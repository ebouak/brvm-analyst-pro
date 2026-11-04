import * as cheerio from 'cheerio';

/**
 * Parsers PURS (testables sur fixtures) de l'annuaire SGI de RichBourse.
 *
 * Page liste : https://www.richbourse.com/common/apprendre/liste-sgi
 *   → tableau (Noms des SGI | Pays | Note), lien « Détails » vers
 *     /common/apprendre/details-sgi/{slug}.
 * Fiche détail : format clé-valeur (Téléphone, Site Web, Pays, Adresse,
 *   Dépôt minimum) + lien « Consulter les tarifs » vers
 *   /common/apprendre/afficher-tarifs-sgi/{id}_{slug}.
 *
 * Approche résiliente (label/href, pas d'index de colonne fixe) — conforme à
 * la convention parsers du projet. Sélecteurs à confirmer sur le markup réel
 * (le site est protégé par anti-bot : navigation via Playwright, cf.
 * runSgiRichbourse.ts). L'email est masqué par JS sur les fiches → laissé null
 * (jamais deviné).
 */

/** Pays UEMOA (libellé RichBourse → code ISO2 stocké en base). */
const PAYS_ISO: Record<string, string> = {
  "cote d'ivoire": 'CI',
  'cote divoire': 'CI',
  senegal: 'SN',
  'burkina faso': 'BF',
  mali: 'ML',
  benin: 'BJ',
  togo: 'TG',
  niger: 'NE',
  'guinee-bissau': 'GW',
  'guinee bissau': 'GW',
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convertit un libellé de pays en code ISO2, ou null si non reconnu. */
export function paysToIso(label: string | null | undefined): string | null {
  if (!label) return null;
  return PAYS_ISO[normalize(label)] ?? null;
}

export interface SgiListEntry {
  nom: string;
  paysIso: string | null;
  slug: string; // dernier segment de /details-sgi/{slug}
  detailUrl: string; // chemin relatif
}

/**
 * Extrait les lignes de la table liste : pour chaque lien « Détails » vers
 * /details-sgi/{slug}, on lit le nom et le pays dans la même ligne <tr>.
 */
export function parseSgiListRows(html: string): SgiListEntry[] {
  const $ = cheerio.load(html);
  const out: SgiListEntry[] = [];
  const seen = new Set<string>();

  $('a[href*="/details-sgi/"]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').trim();
    const slugMatch = href.match(/\/details-sgi\/([^/?#]+)/);
    if (!slugMatch) return;
    const slug = slugMatch[1]!;
    if (seen.has(slug)) return;

    const $row = $(a).closest('tr');
    const cells = $row.find('td');
    // Le nom est soit le texte du lien lui-même, soit — quand le lien est un
    // bouton « Détails » — la première cellule PLAUSIBLE de la ligne : on
    // écarte le numéro de ligne (« 1 »…« 40 »), le pays et la note (« 4,9 »),
    // jamais un index de colonne fixe (markup réel : # | Nom | Pays | Note | action).
    let nom = $(a).text().trim();
    if (!nom || /détails|details/i.test(nom)) {
      nom = '';
      cells.each((_, td) => {
        const t = $(td).text().trim();
        if (!t) return undefined;
        if (/^\d+$/.test(t)) return undefined; // numéro de ligne
        if (paysToIso(t)) return undefined; // pays
        if (/^[\d,.\s]+$/.test(t)) return undefined; // note « 4,9 »
        if (/détails|details/i.test(t)) return undefined; // bouton
        nom = t;
        return false;
      });
    }
    if (!nom || /^\d+$/.test(nom)) return;

    // Le pays : cellule dont le texte matche un pays UEMOA.
    let paysIso: string | null = null;
    cells.each((_, td) => {
      const iso = paysToIso($(td).text().trim());
      if (iso) {
        paysIso = iso;
        return false;
      }
      return undefined;
    });

    seen.add(slug);
    out.push({ nom, paysIso, slug, detailUrl: href });
  });

  return out;
}

export interface SgiContactFiche {
  telephone: string | null;
  siteWeb: string | null;
  paysIso: string | null;
  adresse: string | null;
  depotMin: string | null;
  tarifsUrl: string | null; // /afficher-tarifs-sgi/{id}_{slug}
}

/** Valeur associée à un label (clé-valeur) : cherche le texte du label et
 *  renvoie le texte « voisin » (même bloc parent, hors label). */
function valueForLabel($: cheerio.CheerioAPI, labels: string[]): string | null {
  let val: string | null = null;
  const wanted = labels.map(normalize);
  $('*').each((_, el) => {
    const $el = $(el);
    if ($el.children().length > 0) return; // feuilles seulement (évite doublons)
    const t = normalize($el.text());
    if (!t) return;
    if (wanted.some((w) => t === w || t.startsWith(w))) {
      // valeur = texte du sibling suivant, ou du parent moins le label
      const sib = $el.next().text().trim();
      if (sib) {
        val = sib;
        return false;
      }
      const parentText = $el.parent().text().trim();
      const rawLabel = $el.text().trim();
      const rest = parentText.replace(rawLabel, '').trim();
      if (rest) {
        val = rest;
        return false;
      }
    }
    return undefined;
  });
  return val;
}

/** Parse une fiche détail SGI (contacts + lien tarifs). */
/** Liens qui ne sont jamais le site d'une SGI : RichBourse lui-même et les réseaux sociaux. */
const LIENS_NON_SITE = /richbourse\.com|facebook\.com|fb\.com|twitter\.com|\/\/(www\.)?x\.com|linkedin\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com|wa\.me|whatsapp\.com|t\.me/i;

export function parseSgiContactFiche(html: string): SgiContactFiche {
  const $ = cheerio.load(html);

  const telephoneBrut =
    $('a[href^="tel:"]').first().text().trim() ||
    valueForLabel($, ['téléphone', 'telephone', 'tél', 'tel']) ||
    '';
  // Le repli par libellé ramassait n'importe quel texte : trois SGI ont eu
  // un paragraphe éditorial en guise de téléphone. Au moins 8 chiffres, et
  // rien d'autre que chiffres, espaces et séparateurs usuels.
  const telephone = /^[\d\s+().\/-]+$/.test(telephoneBrut) && (telephoneBrut.match(/\d/g) ?? []).length >= 8
    ? telephoneBrut
    : '';

  // Le premier lien externe de la fiche était souvent la page Facebook de
  // RichBourse (pied de page) : 28 SGI l'avaient pour « site officiel ».
  const siteWeb =
    $('a[href^="http"]')
      .filter((_, a) => !LIENS_NON_SITE.test($(a).attr('href') ?? ''))
      .first()
      .attr('href') ?? valueForLabel($, ['site web', 'site internet', 'site']);

  const paysIso = paysToIso(valueForLabel($, ['pays']));
  const adresse = valueForLabel($, ['adresse']);
  const depotMin = valueForLabel($, ['dépôt minimum', 'depot minimum', 'dépôt', 'depot']);

  const tarifsHref = $('a[href*="/afficher-tarifs-sgi/"]').first().attr('href') ?? null;

  return {
    telephone: telephone || null,
    siteWeb: siteWeb || null,
    paysIso,
    adresse: adresse || null,
    depotMin: depotMin || null,
    tarifsUrl: tarifsHref,
  };
}

/* ── Fusion annuaire (pure, testable) ──────────────────────────────────────
 * Le scraper ENRICHIT sans écraser : il ne touche jamais aux champs curés
 * (type, groupe, dépôt) d'une SGI déjà connue — il ne fait que compléter des
 * contacts manquants (téléphone/site) et insère les SGI réellement nouvelles.
 * Jamais de fusion floue devinée : correspondance par nom normalisé strict
 * (suffixes juridiques / préfixe « SGI » retirés). Les variantes de nom non
 * résolues créent une nouvelle ligne (réconciliation humaine ultérieure), sans
 * perte ni écrasement de donnée.
 */

/** Normalise un nom de SGI pour la correspondance (suffixes juridiques ôtés). */
export function normalizeSgiName(nom: string): string {
  return normalize(nom)
    .replace(/^sgi\s+/, '')
    .replace(/\b(s\.?a\.?r\.?l|s\.?a|sa|& cie|cie)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ScrapedSgi {
  nom: string;
  paysIso: string | null;
  depotMin: string | null;
  siteWeb: string | null;
  telephone: string | null;
  tarifsUrl: string | null;
  slug: string;
}

export interface ExistingSgiRow {
  nom: string;
  telephone: string | null;
  site_web: string | null;
  email: string | null;
  /** Identifiant d'URL déjà attribué (migration 0190) : évite les collisions. */
  slug?: string | null;
}

/**
 * Identifiant d'URL dérivé du nom. Copie de `slugDepuisNom` du frontend
 * (frontend/lib/sgi-frais/identite.ts) : deux paquets TS distincts, à
 * corriger des deux côtés.
 */
export function slugDepuisNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Slug libre : suffixe -2, -3… si déjà pris ; « sgi » si le nom n'en donne aucun. */
function slugLibre(nom: string, pris: Set<string>): string {
  const base = slugDepuisNom(nom) || 'sgi';
  let slug = base;
  for (let i = 2; pris.has(slug); i++) slug = `${base}-${i}`;
  pris.add(slug);
  return slug;
}

export interface DirectoryInsert {
  nom: string;
  /** Obligatoire depuis la migration 0190 (non nul, unique). */
  slug: string;
  pays: string | null;
  type: 'Non déterminé';
  groupe: 'Non renseigné';
  depot_min: string;
  depot_min_source: 'relevé' | 'inconnu';
  site_web: string | null;
  telephone: string | null;
  email: null;
  source: 'richbourse';
  verifie_le: string;
}

export interface DirectoryEnrichment {
  nom: string; // nom existant (curé) à compléter
  patch: { telephone?: string; site_web?: string };
}

export interface MergePlan {
  inserts: DirectoryInsert[];
  enrichments: DirectoryEnrichment[];
}

/**
 * Construit le plan de fusion : inserts (SGI nouvelles) + enrichissements
 * (contacts manquants sur des SGI existantes). N'écrase jamais une valeur de
 * contact déjà présente ni aucun champ curé.
 */
export function planDirectoryMerge(
  scraped: ScrapedSgi[],
  existing: ExistingSgiRow[],
  today: string,
): MergePlan {
  const byNorm = new Map(existing.map((e) => [normalizeSgiName(e.nom), e]));
  const inserts: DirectoryInsert[] = [];
  const enrichments: DirectoryEnrichment[] = [];
  const slugsPris = new Set(existing.map((e) => e.slug).filter((x): x is string => !!x));

  for (const s of scraped) {
    const match = byNorm.get(normalizeSgiName(s.nom));
    if (match) {
      const patch: DirectoryEnrichment['patch'] = {};
      if (!match.telephone && s.telephone) patch.telephone = s.telephone;
      if (!match.site_web && s.siteWeb) patch.site_web = s.siteWeb;
      if (Object.keys(patch).length > 0) enrichments.push({ nom: match.nom, patch });
    } else {
      inserts.push({
        nom: s.nom,
        slug: slugLibre(s.nom, slugsPris),
        pays: s.paysIso,
        type: 'Non déterminé',
        groupe: 'Non renseigné',
        depot_min: s.depotMin ?? 'Non renseigné',
        depot_min_source: s.depotMin ? 'relevé' : 'inconnu',
        site_web: s.siteWeb,
        telephone: s.telephone,
        email: null,
        source: 'richbourse',
        verifie_le: today,
      });
    }
  }

  return { inserts, enrichments };
}
