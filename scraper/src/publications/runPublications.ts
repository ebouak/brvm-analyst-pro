import * as cheerio from 'cheerio';
import type { HttpClient } from '../client/http.js';
import { createHttpClient } from '../client/http.js';
import { login } from '../client/auth.js';
import { extractAspNetState, buildPostback } from '../client/aspnet.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { parsePublicationsTable } from './parser.js';
import { classifyPublication } from './classify.js';
import { upsertPublications, dedupeHash } from './repository.js';
import { buildMockPublications } from './mock.js';
import { getSupabase } from '../persistence/supabase.js';
import type { Publication } from './types.js';

// Paths candidats — testés dans l'ordre jusqu'à trouver une page contenant
// __VIEWSTATE + un dropdown émetteur. Sinon discovery via menu Default.aspx.
const PATH_CANDIDATES = [
  // CONFIRMÉ via discovery menu Default.aspx : "Publications" → /0/communiques.aspx
  '/0/communiques.aspx',
  // Patterns alternatifs / rapports annuels
  '/0/rapports_annuels_societes.aspx',
  '/Publications.aspx',
  '/Publication.aspx',
];

// Names probables du dropdown émetteur ASP.NET — CONFIRMÉ via discovery :
// /0/communiques.aspx utilise DropDownList2 avec ~145 options émetteurs
const EMETTEUR_FIELD_CANDIDATES = [
  'ctl00$Main$DropDownList2',
  'ctl00$Main$DropDownList1',
  'ctl00$Main$ddlEmetteur',
  'ctl00$Main$DropDownListEmetteur',
];

/** Considère présent un VIEWSTATE direct ou multi-part (__VIEWSTATE1, etc.) */
function hasViewstate(hidden: Record<string, string>): boolean {
  return Boolean(hidden['__VIEWSTATE'] || hidden['__VIEWSTATE1'] || hidden['__VIEWSTATEFIELDCOUNT']);
}

/** Normalise une chaîne pour fuzzy matching (lowercase, sans accents, espaces normalisés) */
function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface EmetteurOption {
  value: string;
  text: string;
}

/** Tente de matcher une désignation BRVM avec un emetteur du dropdown BDFIN */
function matchEmetteur(designation: string, options: EmetteurOption[]): EmetteurOption | null {
  if (!designation) return null;
  const norm = normalizeStr(designation);
  if (!norm) return null;
  // 1) Match exact normalisé
  const exact = options.find((o) => normalizeStr(o.text) === norm);
  if (exact) return exact;
  // 2) Substring : un contient l'autre
  const partial = options.find((o) => {
    const oNorm = normalizeStr(o.text);
    return oNorm && (norm.includes(oNorm) || oNorm.includes(norm));
  });
  return partial ?? null;
}

/** Extrait toutes les options [value, text] d'un select dans le HTML */
function extractSelectOptions(html: string, fieldName: string): EmetteurOption[] {
  const $ = cheerio.load(html);
  const out: EmetteurOption[] = [];
  $(`select[name="${fieldName}"] option`).each((_, o) => {
    const value = $(o).attr('value');
    const text = $(o).text().trim();
    if (value && text) out.push({ value, text });
  });
  return out;
}

async function discoverPublicationsPath(http: HttpClient): Promise<{ path: string; field: string } | null> {
  // 1) Try direct candidates
  for (const path of PATH_CANDIDATES) {
    try {
      const resp = await http.get(path);
      const state = extractAspNetState(resp.data);
      const hasVS = hasViewstate(state.hidden);
      const htmlLen = (resp.data || '').length;
      const titleMatch = (resp.data || '').match(/<title>([^<]*)<\/title>/i);
      logger.info({ path, status: resp.status, htmlLen, hasVS, title: titleMatch?.[1] }, 'Candidat testé');
      if (resp.status !== 200) continue;

      // Si pas de VIEWSTATE mais la page est "Publication de l'émetteur", on dump la structure
      const isPublicationsPage = (titleMatch?.[1] || '').toLowerCase().includes('publication');
      if (!hasVS) {
        if (isPublicationsPage) {
          const $ = cheerio.load(resp.data);
          const forms = $('form').map((_, f) => ({
            action: $(f).attr('action'),
            method: $(f).attr('method'),
            id: $(f).attr('id'),
          })).get();
          const inputs = $('input').map((_, i) => ({
            name: $(i).attr('name'),
            type: $(i).attr('type'),
            id: $(i).attr('id'),
          })).get().slice(0, 30);
          const selects = $('select').map((_, s) => ({
            name: $(s).attr('name'),
            id: $(s).attr('id'),
            options: $(s).find('option').length,
          })).get();
          const links = $('a').map((_, a) => $(a).attr('href')).get().filter(h => h && h.includes('communique')).slice(0, 10);
          const tables = $('table').length;
          const allHidden = Object.keys(state.hidden).slice(0, 20);
          logger.info({ path, forms, inputs, selects, tables, links, allHidden }, 'STRUCTURE page Publications (debug)');
        }
        continue;
      }
      // Détecter dropdown émetteur
      const $ = cheerio.load(resp.data);
      // Lister TOUS les selects pour debug
      const allSelects: Array<{ name: string; options: number }> = [];
      $('select').each((_, s) => {
        const name = $(s).attr('name');
        if (name) allSelects.push({ name, options: $(s).find('option').length });
      });
      logger.info({ path, selects: allSelects }, 'Page candidate testée — selects présents');
      // Essayer les names probables
      for (const field of EMETTEUR_FIELD_CANDIDATES) {
        const sel = $(`select[name="${field}"]`);
        if (sel.length > 0) {
          const sampleOptions = sel.find('option').slice(0, 5).map((_, o) => ({
            value: $(o).attr('value'),
            text: $(o).text().trim(),
          })).get();
          logger.info({ path, field, sampleOptions }, 'Publications path découvert + sample options');
          return { path, field };
        }
      }
      // Fallback 1 : 1er select avec "emetteur"/"societe"/"ddl" dans le name
      for (const s of allSelects) {
        const n = s.name.toLowerCase();
        if (n.includes('emetteur') || n.includes('societe') || n.includes('société') || n.endsWith('ddl1') || n.includes('ddlsociete')) {
          logger.info({ path, field: s.name }, 'Publications path découvert (heuristique nom)');
          return { path, field: s.name };
        }
      }
      // Fallback 2 : prendre le 1er select de la page (souvent c'est l'emetteur)
      if (allSelects.length > 0 && allSelects[0]!.options >= 2) {
        logger.info({ path, field: allSelects[0]!.name }, 'Publications path découvert (1er select)');
        return { path, field: allSelects[0]!.name };
      }
    } catch (e) {
      logger.warn({ path, err: (e as Error).message }, 'Test candidat échoué');
    }
  }
  // 2) Discovery via le menu Default.aspx — chercher TOUS les <a> et identifier
  //    ceux qui ressemblent à une page Publications/Emetteurs/Rapports
  try {
    const home = await http.get('/Default.aspx');
    const $ = cheerio.load(home.data);
    const allLinks: Array<{ text: string; href: string }> = [];
    $('a').each((_, a) => {
      const text = ($(a).text() || '').trim();
      const href = $(a).attr('href');
      if (href && href.endsWith('.aspx')) {
        allLinks.push({ text, href });
      }
    });
    logger.info({ totalLinks: allLinks.length, sample: allLinks.slice(0, 30) }, 'Menu Default.aspx — TOUS liens .aspx');

    // Filtrer par texte ou href contenant publication/emetteur/rapport
    const candidates = allLinks.filter((l) => {
      const t = l.text.toLowerCase();
      const h = l.href.toLowerCase();
      return (
        t.includes('publication') || t.includes('émetteur') || t.includes('emetteur') || t.includes('rapport') ||
        h.includes('publication') || h.includes('emetteur') || h.includes('rapport')
      );
    });
    logger.info({ candidates }, 'Liens candidats (publication/emetteur/rapport)');

    for (const { text, href } of candidates) {
      const path = href.startsWith('/') ? href : '/' + href;
      try {
        const resp = await http.get(path);
        if (resp.status !== 200) continue;
        const state = extractAspNetState(resp.data);
        if (!state.hidden['__VIEWSTATE']) continue;
        const $$ = cheerio.load(resp.data);
        const selects: Array<{ name: string; options: number }> = [];
        $$('select').each((_, s) => {
          const name = $$(s).attr('name');
          if (name) selects.push({ name, options: $$(s).find('option').length });
        });
        logger.info({ path, text, selects }, 'Page testée');
        // Considérer comme bon candidat si au moins 1 select avec >5 options (probable emetteur dropdown)
        const dropdown = selects.find((s) => s.options > 5);
        if (dropdown) {
          logger.info({ path, field: dropdown.name }, 'Publications path découvert via menu');
          return { path, field: dropdown.name };
        }
      } catch { /* skip */ }
    }
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'Discovery menu Default.aspx échouée');
  }
  return null;
}

export interface PubsRunResult {
  status: 'success' | 'failed' | 'mock';
  count: number;
  message?: string;
}

export async function runPublications(opts: { mock?: boolean } = {}): Promise<PubsRunResult> {
  if (opts.mock) {
    const pubs = buildMockPublications();
    const n = await upsertPublications(pubs);
    logger.info({ count: n }, 'Publications mock ingerees');
    return { status: 'mock', count: n };
  }
  try {
    const http = createHttpClient();
    await login(http);
    const cfg = getConfig();

    // Discovery : trouve dynamiquement le bon path + le bon name de dropdown
    const discovered = await discoverPublicationsPath(http);
    if (!discovered) {
      logger.warn('Aucune page Publications trouvée sur BDFIN — abandon');
      return { status: 'failed', count: 0, message: 'page publications introuvable (discovery échouée)' };
    }
    const PUBLICATIONS_PATH = discovered.path;
    const EMETTEUR_FIELD = discovered.field;

    // Liste des instruments BRVM actifs (avec designation pour matching)
    const sb = getSupabase();
    const { data: instruments, error } = await sb
      .from('brvm_instruments')
      .select('code, designation')
      .eq('type', 'action')
      .eq('actif', true);
    if (error) throw new Error(`load instruments: ${error.message}`);
    const brvmInstruments = (instruments ?? []) as Array<{ code: string; designation: string | null }>;

    // Extraire la liste complète des options du dropdown (ID BDFIN → text)
    const firstPage = await http.get(PUBLICATIONS_PATH);
    const options = extractSelectOptions(firstPage.data, EMETTEUR_FIELD);
    logger.info({ totalOptions: options.length, sample: options.slice(0, 5) }, 'Options émetteurs BDFIN');

    // Mapping BRVM code → option BDFIN par fuzzy match designation/text
    const mappings: Array<{ code: string; bdfinValue: string; bdfinText: string }> = [];
    const unmatched: string[] = [];
    for (const instr of brvmInstruments) {
      const opt = matchEmetteur(instr.designation ?? instr.code, options);
      if (opt) {
        mappings.push({ code: instr.code, bdfinValue: opt.value, bdfinText: opt.text });
      } else {
        unmatched.push(`${instr.code}=${instr.designation}`);
      }
    }
    logger.info({ matched: mappings.length, unmatched: unmatched.length, unmatchedSample: unmatched.slice(0, 10) }, 'Mapping BRVM → BDFIN');

    if (mappings.length === 0) {
      logger.warn('Aucun mapping trouvé entre instruments BRVM et options BDFIN');
      return { status: 'failed', count: 0, message: 'aucun mapping BRVM/BDFIN' };
    }

    const allPubs: Publication[] = [];
    for (const { code, bdfinValue, bdfinText } of mappings) {
      try {
        // Re-GET pour fresh VIEWSTATE
        const page = await http.get(PUBLICATIONS_PATH);
        const state = extractAspNetState(page.data);
        if (!hasViewstate(state.hidden)) {
          logger.warn({ code }, 'VIEWSTATE absent page publications');
          continue;
        }
        // Postback : sélectionner emetteur via son ID BDFIN
        const form = buildPostback(state, EMETTEUR_FIELD, '', { [EMETTEUR_FIELD]: bdfinValue });
        const resp = await http.postForm(PUBLICATIONS_PATH, form);
        const rows = parsePublicationsTable(resp.data, cfg.BDFIN_BASE_URL);
        for (const r of rows) {
          allPubs.push({
            code,
            date_publication: r.date_publication,
            libelle: r.libelle,
            type_publication: classifyPublication(r.libelle),
            source_url: r.source_url,
            source: 'bdfin',
            dedupe_hash: dedupeHash(code, r.date_publication, r.libelle),
          });
        }
        logger.info({ code, bdfinText, found: rows.length }, 'Publications émetteur');
      } catch (e) {
        logger.warn({ code, err: (e as Error).message }, 'Echec emetteur, suite');
      }
    }

    if (allPubs.length === 0) {
      logger.warn('Aucune publication trouvee — calibrage requis');
      return { status: 'failed', count: 0, message: 'aucune publication parsee (calibrage requis)' };
    }

    const n = await upsertPublications(allPubs);
    logger.info({ total: n, emetteurs: mappings.length }, 'Publications ingerees');
    return { status: 'success', count: n };
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'runPublications failed');
    return { status: 'failed', count: 0, message: (e as Error).message };
  }
}
