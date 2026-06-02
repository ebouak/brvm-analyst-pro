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

// Map curée code BRVM -> ID émetteur BDFIN, pour les tickers/acronymes que le
// fuzzy ne peut pas relier au nom légal complet (ex. SGBC -> "Société Générale
// Côte d'Ivoire"). IDs relevés sur le dropdown /0/communiques.aspx (145 options).
const CODE_TO_BDFIN_ID: Record<string, string> = {
  BICC: '1000', // BICICI
  BNBC: '1003', // BERNABE CI
  BOAB: '1057', // Bank Of Africa - Bénin
  BOAC: '1083', // Bank Of Africa - Côte d'Ivoire
  CABC: '1025', // Société Ivoirienne de Câbles (SICABLE)
  CFAC: '1004', // CFAO
  CIEC: '1020', // Compagnie Ivoirienne d'Electricité
  ECOC: '1092', // ECOBANK CI
  ETIT: '1070', // Ecobank Transnational Incorporated
  FTSC: '1021', // Filature, Tissage, Sacs (FILTISAC)
  NSBC: '1132', // NSIA BANQUE CI
  NTLC: '1014', // NESTLE CI
  ONTBF: '1068', // Office National des Télécommunications du Burkina (ONATEL)
  ORAC: '1146', // ORANGE COTE D'IVOIRE
  ORGT: '1090', // ORAGROUP
  PALC: '1050', // PALM CI
  PRSC: '1005', // Tractafric Motors CI
  SAFC: '1001', // Société Africaine de Crédit Automobile (SAFCA)
  SDCC: '1019', // Société de Distribution d'Eau de la CI (SODECI)
  SDSC: '1010', // Bolloré Transport & Logistics CI (AGL)
  SEMC: '1032', // Société Ivoirienne d'Emballages Métalliques (CROWN SIEM)
  SGBC: '1002', // Société Générale Côte d'Ivoire (SGBCI)
  SHEC: '1026', // VIVO ENERGY CI
  SICC: '1022', // Société Ivoirienne de Coco Râpé (SICOR)
  SLBC: '1042', // Société de Limonaderies et Brasseries d'Afrique (SOLIBRA)
  SMBC: '1028', // Société Multinationale de Bitumes (SMB)
  SNTS: '1037', // Société Nationale des Télécommunications du Sénégal (SONATEL)
  SOGC: '1029', // Société des Caoutchoucs de Grand Bereby (SOGB)
  SPHC: '1031', // Société Africaine des Plantations d'Hévéas (SAPH)
  STAC: '1018', // Société d'Etudes et de Travaux pour l'Afrique de l'Ouest (SETAO)
  STBC: '1012', // Société Ivoirienne des Tabacs (SITAB)
  TTLC: '1008', // TOTAL Côte d'Ivoire
  UNLC: '1011', // UNILEVER Côte d'Ivoire
};

// Mots vides / suffixes pays ignorés dans la comparaison par tokens.
const STOPWORDS = new Set([
  'ci', 'sn', 'bf', 'tg', 'bj', 'ne', 'ml', 'gw',
  'sa', 'sas', 'sarl', 'group', 'groupe', 'cote', 'ivoire',
  'd', 'de', 'du', 'des', 'la', 'le', 'les', 'et', 'pour',
  'benin', 'burkina', 'faso', 'mali', 'niger', 'senegal', 'togo', 'guinee', 'bissau',
]);

function tokens(s: string): string[] {
  return normalizeStr(s)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Score de similarité [0..1] entre une désignation BRVM et un texte BDFIN,
 * basé sur le chevauchement des tokens significatifs (Jaccard pondéré).
 */
function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  let inter = 0;
  for (const t of ta) {
    if (setB.has(t)) inter += 1;
    // correspondance par préfixe (sodeci ~ sodec, unilever ~ unile)
    else if (tb.some((x) => x.startsWith(t) || t.startsWith(x))) inter += 0.6;
  }
  return inter / Math.max(ta.length, tb.length);
}

function matchEmetteur(designation: string, options: EmetteurOption[]): EmetteurOption | null {
  const norm = normalizeStr(designation);
  if (!norm) return null;

  // 1) Exact normalisé
  const exact = options.find((o) => normalizeStr(o.text) === norm);
  if (exact) return exact;

  // 2) Substring (un contient l'autre, len >= 5 pour éviter les faux positifs)
  const sub = options.find((o) => {
    const on = normalizeStr(o.text);
    return on.length >= 5 && (norm.includes(on) || on.includes(norm));
  });
  if (sub) return sub;

  // 3) Meilleur score de chevauchement de tokens (seuil 0.5)
  let best: EmetteurOption | null = null;
  let bestScore = 0;
  for (const o of options) {
    const s = similarity(designation, o.text);
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return bestScore >= 0.5 ? best : null;
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
    const unmatched: string[] = [];
    for (const ins of brvm) {
      // 1) map curée par code (prioritaire) ; 2) fuzzy sur la désignation
      const curatedId = CODE_TO_BDFIN_ID[ins.code];
      const opt = curatedId
        ? options.find((o) => o.value === curatedId) ?? null
        : matchEmetteur(ins.designation ?? ins.code, options);
      if (opt) mappings.push({ code: ins.code, value: opt.value, text: opt.text });
      else unmatched.push(`${ins.code}=${ins.designation}`);
    }
    logger.info(
      { matched: mappings.length, total: brvm.length, unmatched },
      'Mapping BRVM -> BDFIN (browser)',
    );
    if (mappings.length === 0) {
      return { status: 'failed', count: 0, message: 'aucun mapping' };
    }

    const allPubs: Publication[] = [];
    for (const m of mappings) {
      try {
        // IMPORTANT : recharger la page Publications à chaque émetteur. Les
        // postbacks ASP.NET successifs accumulent un état (__VIEWSTATE) qui
        // finit par renvoyer la page par défaut (table vide). Repartir d'un
        // goto frais garantit que chaque émetteur se comporte comme le 1er.
        await page.goto(pubUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(SELECT, { timeout: 15000 });

        // Sélectionne l'émetteur → onchange déclenche __doPostBack (full page).
        // On attend qu'une ligne de données (date en col 0) apparaisse.
        await page.selectOption(SELECT, m.value);
        await page
          .waitForFunction(
            () => {
              const trs = Array.from(document.querySelectorAll('tr'));
              for (const tr of trs) {
                const td = tr.querySelector('td');
                const t = (td?.textContent ?? '').trim();
                if (/\d{2}\/\d{2}\/\d{4}/.test(t)) return true; // table peuplée
              }
              return false;
            },
            undefined,
            { timeout: 10000 },
          )
          .catch(() => {
            // timeout : émetteur sans publication → 0 pub
          });
        await page.waitForTimeout(400);

        const html = await page.content();
        // baseUrl = URL de la PAGE (pas la racine du site) : les liens
        // "Visualiser" sont relatifs (Communiques_emetteurs/x.pdf) et doivent
        // se résoudre sous /0/ → https://bfin.brvm.org/0/Communiques_emetteurs/...
        const rows = parsePublicationsTable(html, pubUrl);

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
