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
  '/Publications.aspx',
  '/Publication.aspx',
  '/PublicationEmetteur.aspx',
  '/PublicationsEmetteur.aspx',
  '/PublicationEmetteurs.aspx',
];

// Names probables du dropdown émetteur ASP.NET — testés tous, premier qui matche gagne
const EMETTEUR_FIELD_CANDIDATES = [
  'ctl00$Main$DropDownList1',
  'ctl00$Main$ddlEmetteur',
  'ctl00$Main$DropDownListEmetteur',
];

async function discoverPublicationsPath(http: HttpClient): Promise<{ path: string; field: string } | null> {
  // 1) Try direct candidates
  for (const path of PATH_CANDIDATES) {
    try {
      const resp = await http.get(path);
      if (resp.status !== 200) continue;
      const state = extractAspNetState(resp.data);
      if (!state.hidden['__VIEWSTATE']) continue;
      // Détecter dropdown émetteur
      const $ = cheerio.load(resp.data);
      for (const field of EMETTEUR_FIELD_CANDIDATES) {
        if ($(`select[name="${field}"]`).length > 0) {
          logger.info({ path, field }, 'Publications path découvert (candidat direct)');
          return { path, field };
        }
      }
      // Fallback : prendre le 1er <select> de la page
      const firstSelect = $('select').first().attr('name');
      if (firstSelect && firstSelect.toLowerCase().includes('emetteur')) {
        logger.info({ path, field: firstSelect }, 'Publications path découvert (1er select emetteur)');
        return { path, field: firstSelect };
      }
    } catch {
      // skip
    }
  }
  // 2) Discovery via le menu Default.aspx — chercher un <a> contenant "Publication"
  try {
    const home = await http.get('/Default.aspx');
    const $ = cheerio.load(home.data);
    const links: string[] = [];
    $('a').each((_, a) => {
      const text = ($(a).text() || '').trim().toLowerCase();
      const href = $(a).attr('href');
      if (href && text.includes('publication')) links.push(href);
    });
    logger.info({ links: links.slice(0, 10) }, 'Menu Default.aspx — liens contenant "publication"');
    for (const href of links) {
      const path = href.startsWith('/') ? href : '/' + href;
      try {
        const resp = await http.get(path);
        if (resp.status !== 200) continue;
        const state = extractAspNetState(resp.data);
        if (!state.hidden['__VIEWSTATE']) continue;
        const $$ = cheerio.load(resp.data);
        const firstSelect = $$('select').first().attr('name');
        if (firstSelect) {
          logger.info({ path, field: firstSelect }, 'Publications path découvert via menu');
          return { path, field: firstSelect };
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

    // Liste des codes actions actives
    const sb = getSupabase();
    const { data: instruments, error } = await sb.from('brvm_instruments').select('code').eq('type', 'action').eq('actif', true);
    if (error) throw new Error(`load instruments: ${error.message}`);
    const codes = (instruments ?? []).map((i: { code: string }) => i.code).slice(0, 50); // safety cap

    const allPubs: Publication[] = [];
    for (const code of codes) {
      try {
        // Re-GET pour fresh VIEWSTATE
        const page = await http.get(PUBLICATIONS_PATH);
        const state = extractAspNetState(page.data);
        if (!state.hidden['__VIEWSTATE']) {
          logger.warn({ code }, 'VIEWSTATE absent page publications');
          continue;
        }
        // Postback : sélectionner emetteur
        const form = buildPostback(state, EMETTEUR_FIELD, '', { [EMETTEUR_FIELD]: code });
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
        logger.info({ code, found: rows.length }, 'Publications emetteur');
      } catch (e) {
        logger.warn({ code, err: (e as Error).message }, 'Echec emetteur, suite');
      }
    }

    if (allPubs.length === 0) {
      logger.warn('Aucune publication trouvee — calibrage requis');
      return { status: 'failed', count: 0, message: 'aucune publication parsee (calibrage requis)' };
    }

    const n = await upsertPublications(allPubs);
    logger.info({ total: n, codes: codes.length }, 'Publications ingerees');
    return { status: 'success', count: n };
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'runPublications failed');
    return { status: 'failed', count: 0, message: (e as Error).message };
  }
}
