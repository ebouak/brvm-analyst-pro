import { chromium, type Browser, type Page } from 'playwright';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { getSupabase } from '../persistence/supabase.js';
import { parsePublicationsTable } from './parser.js';
import { classifyPublication } from './classify.js';
import { upsertPublications, dedupeHash } from './repository.js';
import type { Publication } from './types.js';

export interface PubsRunResult {
  status: 'success' | 'failed';
  count: number;
  message?: string;
}

// --- fuzzy matching designation BRVM <-> texte option BDFIN ---
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

function matchEmetteur(designation: string, options: EmetteurOption[]): EmetteurOption | null {
  const norm = normalizeStr(designation);
  if (!norm) return null;
  const exact = options.find((o) => normalizeStr(o.text) === norm);
  if (exact) return exact;
  return (
    options.find((o) => {
      const on = normalizeStr(o.text);
      return on && (norm.includes(on) || on.includes(norm));
    }) ?? null
  );
}

async function loginBrowser(page: Page, cfg: ReturnType<typeof getConfig>): Promise<void> {
  await page.goto(cfg.BDFIN_BASE_URL + cfg.BDFIN_LOGIN_PATH, { waitUntil: 'domcontentloaded' });
  await page.fill('#ctl00_Main_Login1_UserName', cfg.BDFIN_USERNAME);
  await page.fill('#ctl00_Main_Login1_Password', cfg.BDFIN_PASSWORD);
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.click('#ctl00_Main_Login1_LoginButton'),
  ]);
}

export async function runPublicationsBrowser(): Promise<PubsRunResult> {
  const cfg = getConfig();
  if (!cfg.BDFIN_USERNAME || !cfg.BDFIN_PASSWORD) {
    return { status: 'failed', count: 0, message: 'identifiants BDFIN manquants' };
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await loginBrowser(page, cfg);

    // Naviguer sur la page Publications
    const pubUrl = cfg.BDFIN_BASE_URL + '/0/communiques.aspx';
    await page.goto(pubUrl, { waitUntil: 'domcontentloaded' });

    const SELECT = '#ctl00_Main_DropDownList2';
    await page.waitForSelector(SELECT, { timeout: 15000 });

    // Lire toutes les options [value, text]
    const options: EmetteurOption[] = await page.$$eval(`${SELECT} option`, (els) =>
      els
        .map((e) => ({
          value: e.getAttribute('value') ?? '',
          text: (e.textContent ?? '').trim(),
        }))
        .filter((o) => Boolean(o.value) && Boolean(o.text)),
    );
    logger.info({ totalOptions: options.length }, 'Options émetteurs BDFIN (browser)');

    // DIAG : mécanisme de postback + sélection par défaut
    const initialSelected = await page.$eval(SELECT, (el) => {
      const s = el as HTMLSelectElement;
      const o = s.options[s.selectedIndex];
      return { value: s.value, text: o ? o.textContent?.trim() : null };
    }).catch(() => null);
    const initialHtml = await page.content();
    const isUpdatePanel = initialHtml.includes('PageRequestManager') || initialHtml.includes('Sys.WebForms');
    logger.info({ initialSelected, isUpdatePanel }, 'DIAG postback mechanism');

    // Charger instruments BRVM actifs
    const sb = getSupabase();
    const { data: instruments, error } = await sb
      .from('brvm_instruments')
      .select('code, designation')
      .eq('type', 'action')
      .eq('actif', true);
    if (error) throw new Error(`load instruments: ${error.message}`);
    const brvm = (instruments ?? []) as Array<{ code: string; designation: string | null }>;

    const mappings: Array<{ code: string; value: string; text: string }> = [];
    for (const ins of brvm) {
      const opt = matchEmetteur(ins.designation ?? ins.code, options);
      if (opt) mappings.push({ code: ins.code, value: opt.value, text: opt.text });
    }
    logger.info(
      { matched: mappings.length, total: brvm.length },
      'Mapping BRVM -> BDFIN (browser)',
    );
    if (mappings.length === 0) {
      return { status: 'failed', count: 0, message: 'aucun mapping' };
    }

    // Helper : texte de la 1ère ligne de données (1ère cellule = date JJ/MM/AAAA)
    const firstDataRow = async (): Promise<string | null> =>
      page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('tr'));
        for (const tr of trs) {
          const td = tr.querySelector('td');
          const t = (td?.textContent ?? '').trim();
          if (/\d{2}\/\d{2}\/\d{4}/.test(t)) return (tr.textContent ?? '').trim().slice(0, 80);
        }
        return null;
      }).catch(() => null);

    const allPubs: Publication[] = [];
    let diagCount = 0;
    for (const m of mappings) {
      try {
        const before = await firstDataRow();
        // Sélectionne l'émetteur. selectOption met la valeur + dispatch 'change'
        // → __doPostBack. Le postback peut être AJAX (UpdatePanel) : on attend
        // alors que la 1ère ligne de données change, sinon on a la table précédente.
        await page.selectOption(SELECT, m.value);
        // Le postback (full page) vide d'abord la table puis la repeuple. On
        // attend une ligne de données NON VIDE et DIFFÉRENTE de la précédente —
        // sinon on capturait l'état transitoire vide (bug : after=null).
        // Un émetteur réellement sans publication atteindra le timeout (→ 0 pub).
        await page
          .waitForFunction(
            (prev) => {
              const trs = Array.from(document.querySelectorAll('tr'));
              for (const tr of trs) {
                const td = tr.querySelector('td');
                const t = (td?.textContent ?? '').trim();
                if (/\d{2}\/\d{2}\/\d{4}/.test(t)) {
                  const row = (tr.textContent ?? '').trim().slice(0, 80);
                  return row !== prev; // ligne peuplée et différente
                }
              }
              return false; // table vide/transitoire → continuer d'attendre
            },
            before,
            { timeout: 10000 },
          )
          .catch(() => {
            // timeout : émetteur sans publication (ou identique au précédent)
          });
        // Petite marge pour laisser la table finir de se peupler.
        await page.waitForTimeout(600);

        if (diagCount < 3) {
          const after = await firstDataRow();
          logger.info({ code: m.code, emetteur: m.text, before, after }, 'DIAG row change');
          diagCount++;
        }

        const html = await page.content();
        const rows = parsePublicationsTable(html, cfg.BDFIN_BASE_URL);

        for (const r of rows) {
          allPubs.push({
            code: m.code,
            date_publication: r.date_publication,
            libelle: r.libelle,
            type_publication: classifyPublication(r.libelle),
            source_url: r.source_url,
            source: 'bdfin',
            dedupe_hash: dedupeHash(m.code, r.date_publication, r.libelle),
          });
        }
        logger.info(
          { code: m.code, emetteur: m.text, found: rows.length },
          'Publications émetteur (browser)',
        );
      } catch (e) {
        logger.warn({ code: m.code, err: (e as Error).message }, 'Echec émetteur, suite');
      }
    }

    if (allPubs.length === 0) {
      return { status: 'failed', count: 0, message: 'aucune publication parsée' };
    }

    const n = await upsertPublications(allPubs);
    logger.info({ total: n, emetteurs: mappings.length }, 'Publications ingérées (browser)');
    return { status: 'success', count: n };
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'runPublicationsBrowser failed');
    return { status: 'failed', count: 0, message: (e as Error).message };
  } finally {
    if (browser) await browser.close();
  }
}
