import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { dateDepuisNom, listerBulletins, telechargerPdf, type BulletinPublie } from '../carnet/fetch.js';
import { parseAssemblees } from './assemblees.js';
import { fragmentsDesPages } from './fetch.js';
import { parseInformations } from './informations.js';
import { dateEnTete, lignes } from './tableau.js';
import {
  agAttenduesLe, fusionnerAvis, fusionnerSuivi, preparer,
  type AgBase, type AvisBase, type OperationBase,
} from './versBase.js';

/**
 * Calendrier des AG et page « Informations » du Bulletin Officiel de la Cote.
 *
 * Trois façons de l'appeler (CLI `boc:infos`) :
 *   - sans option : le DERNIER bulletin publié — c'est le passage quotidien ;
 *   - `--reprise` : TOUS les bulletins listés sur brvm.org (pages de liste
 *     parcourues jusqu'à ce qu'elles n'apportent plus rien), du plus ancien au
 *     plus récent, en sautant ceux déjà lus ;
 *   - `--fichier <pdf>` / `--dossier <dir>` : des bulletins déjà téléchargés,
 *     pour remonter plus loin que ce que le site expose encore.
 *
 * Idempotent : un bulletin déjà présent dans `boc_bulletins_lus` est sauté
 * (sauf `--forcer`), et toute écriture est un upsert sur une clé naturelle.
 * La fusion garde la première et la dernière date de bulletin, dans n'importe
 * quel ordre de lecture (`versBase.ts`).
 *
 * Politesse : robots.txt de brvm.org → `Crawl-delay: 10`. Toute requête vers le
 * site est espacée de 10 s ; les pages de liste sont plafonnées.
 */

const DELAI_MS = 10_000;
const PAGES_LISTE_MAX = 30;
const TAILLE_LOT = 50;

export interface BulletinTraite {
  date: string;
  source: string;
  assemblees: number;
  operations: number;
  avis: number;
  nonRapproches: string[];
  rejets: string[];
  saute: boolean;
}

export interface BocInfosResult {
  bulletins: BulletinTraite[];
  erreurs: { date: string | null; source: string; message: string }[];
}

export interface BocInfosOptions {
  date?: string;
  reprise?: boolean;
  fichiers?: string[];
  dossier?: string;
  forcer?: boolean;
  /** Lecture à blanc : rien n'est écrit. */
  aBlanc?: boolean;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const empreinte = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);

type Sb = ReturnType<typeof getSupabase>;

async function dejaLus(sb: Sb): Promise<Set<string>> {
  const { data, error } = await sb.from('boc_bulletins_lus').select('date_bulletin');
  if (error) throw new Error(`journal des bulletins illisible : ${error.message}`);
  return new Set((data ?? []).map((r: { date_bulletin: string }) => r.date_bulletin));
}

async function codesConnus(sb: Sb): Promise<Set<string>> {
  const { data, error } = await sb.from('brvm_instruments').select('code');
  if (error) throw new Error(`brvm_instruments illisible : ${error.message}`);
  return new Set((data ?? []).map((r: { code: string }) => r.code));
}

/** Lignes existantes pour ces clés, par lots (URL bornée). */
async function existantes<T extends { cle: string }>(sb: Sb, table: string, cles: string[]): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  for (let i = 0; i < cles.length; i += TAILLE_LOT) {
    const lot = cles.slice(i, i + TAILLE_LOT);
    const { data, error } = await sb.from(table).select('*').in('cle', lot);
    if (error) throw new Error(`${table} illisible : ${error.message}`);
    for (const r of (data ?? []) as T[]) out.set(r.cle, r);
  }
  return out;
}

async function ecrire<T extends { cle: string }>(sb: Sb, table: string, rows: T[]): Promise<void> {
  for (let i = 0; i < rows.length; i += TAILLE_LOT) {
    const lot = rows.slice(i, i + TAILLE_LOT).map((r) => ({ ...r, collecte_at: new Date().toISOString() }));
    const { error } = await sb.from(table).upsert(lot, { onConflict: 'cle' });
    if (error) throw new Error(`écriture ${table} refusée : ${error.message}`);
  }
}

/** Lit un bulletin (déjà téléchargé) et l'écrit. */
export async function traiterBulletin(
  sb: Sb | null,
  pdf: Uint8Array,
  attendu: { date: string | null; source: string },
  codes: ReadonlySet<string>,
): Promise<BulletinTraite> {
  const pages = await fragmentsDesPages(pdf);

  // La date qui fait foi est celle imprimée sur le bulletin ; le nom du
  // fichier doit la confirmer. Un désaccord = mauvais fichier : on refuse.
  let date: string | null = null;
  for (const p of pages.slice(0, 6)) {
    date = dateEnTete(lignes(p));
    if (date) break;
  }
  if (date && attendu.date && date !== attendu.date) {
    throw new Error(`le bulletin annonce la séance du ${date}, son nom dit ${attendu.date}`);
  }
  date = date ?? attendu.date;
  if (!date) throw new Error('date de séance introuvable (ni en tête de page, ni dans le nom du fichier)');

  const ag = parseAssemblees(pages);
  const infos = parseInformations(pages);
  const rejets = [...ag.rejets, ...infos.rejets];

  if (infos.sections.length === 0) throw new Error(`page « Informations » introuvable dans le bulletin du ${date}`);
  if (ag.pages.length === 0) {
    if (agAttenduesLe(date)) throw new Error(`calendrier des AG introuvable dans le bulletin du ${date}`);
    rejets.push('calendrier des AG absent (début d’année : toléré)');
  }

  const prep = preparer(
    { assemblees: ag.lignes, operations: infos.operations, avis: infos.avis },
    date, empreinte, codes,
  );

  const res: BulletinTraite = {
    date, source: attendu.source,
    assemblees: prep.assemblees.length, operations: prep.operations.length, avis: prep.avis.length,
    nonRapproches: prep.nonRapproches, rejets, saute: false,
  };
  if (!sb) return res;

  const exAg = await existantes<AgBase>(sb, 'boc_assemblees', prep.assemblees.map((r) => r.cle));
  await ecrire(sb, 'boc_assemblees', prep.assemblees.map((r) => fusionnerSuivi(r, exAg.get(r.cle))));
  const exOp = await existantes<OperationBase>(sb, 'boc_operations', prep.operations.map((r) => r.cle));
  await ecrire(sb, 'boc_operations', prep.operations.map((r) => fusionnerSuivi(r, exOp.get(r.cle))));
  const exAv = await existantes<AvisBase>(sb, 'boc_avis', prep.avis.map((r) => r.cle));
  await ecrire(sb, 'boc_avis', prep.avis.map((r) => fusionnerAvis(r, exAv.get(r.cle))));

  // Le journal en DERNIER : un bulletin n'est « lu » que si tout est écrit.
  const { error } = await sb.from('boc_bulletins_lus').upsert({
    date_bulletin: date, url: attendu.source,
    nb_assemblees: res.assemblees, nb_operations: res.operations, nb_avis: res.avis,
    non_rapproches: res.nonRapproches, rejets: res.rejets, lu_at: new Date().toISOString(),
  }, { onConflict: 'date_bulletin' });
  if (error) throw new Error(`journal des bulletins : écriture refusée : ${error.message}`);
  return res;
}

/** Bulletins listés sur le site, toutes pages de liste confondues. */
async function tousLesBulletinsListes(): Promise<BulletinPublie[]> {
  const parDate = new Map<string, BulletinPublie>();
  for (let page = 0; page < PAGES_LISTE_MAX; page++) {
    if (page > 0) await pause(DELAI_MS);
    let liste: BulletinPublie[];
    try {
      liste = await listerBulletins(page);
    } catch (e) {
      if (page === 0) throw e;
      logger.info({ page, err: (e as Error).message }, 'fin des pages de liste');
      break;
    }
    const nouveaux = liste.filter((b) => !parDate.has(b.date));
    // Une page qui ne rapporte rien de neuf : le site ignore la pagination, ou c'est la fin.
    if (nouveaux.length === 0) break;
    for (const b of nouveaux) parDate.set(b.date, b);
  }
  return [...parDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fichiersPdf(o: BocInfosOptions): Promise<string[]> {
  const out = [...(o.fichiers ?? [])];
  if (o.dossier) {
    for (const f of (await readdir(o.dossier)).sort()) {
      if (/\.pdf$/i.test(f) && dateDepuisNom(f)) out.push(join(o.dossier, f));
    }
  }
  return out;
}

export async function runBocInfos(o: BocInfosOptions = {}): Promise<BocInfosResult> {
  const sb = o.aBlanc ? null : getSupabase();
  const lus = sb ? await dejaLus(sb) : new Set<string>();
  const codes = sb ? await codesConnus(sb) : new Set<string>();
  const res: BocInfosResult = { bulletins: [], erreurs: [] };

  const sauter = (date: string | null, source: string): boolean => {
    if (!date || o.forcer || !lus.has(date)) return false;
    res.bulletins.push({ date, source, assemblees: 0, operations: 0, avis: 0, nonRapproches: [], rejets: [], saute: true });
    return true;
  };
  const tenter = async (date: string | null, source: string, lire: () => Promise<Uint8Array>) => {
    try {
      const t = await traiterBulletin(sb, await lire(), { date, source }, codes);
      res.bulletins.push(t);
      if (t.date) lus.add(t.date);
      logger.info({ ...t, rejets: t.rejets.length }, 'bulletin lu');
      if (t.nonRapproches.length) logger.warn({ date: t.date, noms: t.nonRapproches }, 'émetteurs non rapprochés (code NULL)');
      for (const r of t.rejets) logger.warn({ date: t.date, rejet: r }, 'ligne du bulletin écartée');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.erreurs.push({ date, source, message });
      logger.error({ date, source, err: message }, 'bulletin non lu');
    }
  };

  // 1) Fichiers locaux.
  const fichiers = await fichiersPdf(o);
  for (const f of fichiers) {
    const date = dateDepuisNom(basename(f));
    if (sauter(date, f)) continue;
    await tenter(date, f, async () => new Uint8Array(await readFile(f)));
  }
  if (fichiers.length > 0 && !o.reprise) return res;

  // 2) Site de la BRVM.
  let cibles: BulletinPublie[];
  if (o.reprise) {
    cibles = await tousLesBulletinsListes();
    logger.info({ listes: cibles.length, premier: cibles[0]?.date, dernier: cibles.at(-1)?.date }, 'bulletins listés sur brvm.org');
  } else {
    const liste = await listerBulletins();
    if (liste.length === 0) throw new Error('aucun bulletin listé sur brvm.org');
    const c = o.date ? liste.find((b) => b.date === o.date) : liste[0];
    if (!c) throw new Error(`aucun bulletin publié pour la séance ${o.date}`);
    cibles = [c];
  }

  for (const b of cibles) {
    if (sauter(b.date, b.url)) continue;
    await pause(DELAI_MS); // chaque téléchargement suit une requête au site
    await tenter(b.date, b.url, () => telechargerPdf(b.url));
  }
  return res;
}
