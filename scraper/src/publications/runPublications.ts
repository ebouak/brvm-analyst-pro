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

const PUBLICATIONS_PATH = '/Publications.aspx';
// Probable name du dropdown emetteur (à calibrer si différent)
const EMETTEUR_FIELD = 'ctl00$Main$DropDownList1';

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

    // Liste des codes actions actives
    const sb = getSupabase();
    const { data: instruments, error } = await sb.from('brvm_instruments').select('code').eq('type', 'action').eq('actif', true);
    if (error) throw new Error(`load instruments: ${error.message}`);
    const codes = (instruments ?? []).map((i: { code: string }) => i.code).slice(0, 50); // safety cap

    // GET page publications
    const initial = await http.get(PUBLICATIONS_PATH);
    if (!initial.data || initial.status !== 200) {
      logger.warn({ status: initial.status }, 'Page publications inaccessible');
      return { status: 'failed', count: 0, message: 'page publications inaccessible' };
    }

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
