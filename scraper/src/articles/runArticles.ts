/**
 * Articles de presse du lot 1 : détecte, rédige, verrouille, écrit, diffuse
 * (spec docs/superpowers/specs/2026-10-28-articles-presse-design.md).
 *
 * Idempotent : un fait déjà en base (colonne `fait`, unique) n'est jamais
 * réécrit, un article déjà diffusé (colonne `diffuse`) jamais rediffusé.
 * DRY_RUN : journalise ce qui serait écrit, n'écrit ni ne diffuse rien.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { todayMarketDate } from '../utils/dates.js';
import { polishNarrative } from '../hebdo/polish.js';
import { resolveApiKeyForScraper } from '../hebdo/apiKey.js';
import { envoyerImageWaha, envoyerTexteWaha, wahaConfiguree } from '../whatsapp/passerelle.js';
import { detecter } from './detecteurs.js';
import { assembler, rediger } from './redaction.js';
import { verifier } from './verrous.js';
import { legende, legendeGroupe, planDiffusion } from './diffusion.js';
import { cleFait, TYPES_AUTOMATIQUES, type CoursRow, type DividendeRow, type OperationRow } from './types.js';

export interface ResultatArticles {
  detectes: number;
  crees: number;
  publies: number;
  bloques: number;
  posts: number;
}

const SITE = (process.env.SITE_URL || 'https://www.westbourse.com').replace(/\/+$/, '');
const COLS_COURS = 'code,date_marche,cours_jour,variation_pct,volume,cours_haut_52s,cours_bas_52s';
const decaler = (iso: string, jours: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + jours * 86_400_000).toISOString().slice(0, 10);

/** PostgREST tronque à 1000 lignes EN SILENCE : on pagine. */
async function paginer<T>(
  construire: (de: number, a: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await construire(de, de + 999);
    if (error) throw new Error(error.message);
    const lot = (data ?? []) as T[];
    out.push(...lot);
    if (lot.length < 1000) return out;
  }
}

export async function runArticles(opts: { mock?: boolean } = {}): Promise<ResultatArticles> {
  const res: ResultatArticles = { detectes: 0, crees: 0, publies: 0, bloques: 0, posts: 0 };
  if (opts.mock) return res;
  const sb = getSupabase();
  const dryRun = getConfig().DRY_RUN;
  const aujourdhui = todayMarketDate();

  const { data: der, error: eDer } = await sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  if (eDer) throw new Error(`dernière séance : ${eDer.message}`);
  const derniereSeance = (der?.[0] as { date_marche: string } | undefined)?.date_marche;
  if (!derniereSeance) throw new Error('aucune séance en base');

  const [cours, hist, divs, ops, instr] = await Promise.all([
    paginer<CoursRow>((de, a) => sb.from('brvm_actions_daily').select(COLS_COURS).eq('date_marche', derniereSeance).range(de, a)),
    paginer<CoursRow>((de, a) =>
      sb
        .from('brvm_actions_daily')
        .select(COLS_COURS)
        .gte('date_marche', decaler(derniereSeance, -60))
        .lt('date_marche', derniereSeance)
        .order('date_marche')
        .range(de, a),
    ),
    paginer<DividendeRow>((de, a) =>
      sb
        .from('dividends')
        .select('code,exercice,montant,ex_date,payment_date,source,created_at')
        .or(`created_at.gte.${decaler(aujourdhui, -5)},ex_date.gte.${decaler(aujourdhui, -7)},payment_date.gte.${decaler(aujourdhui, -1)}`)
        .range(de, a),
    ),
    sb.from('operations_titres').select('code,date_effet,type,ratio').gte('date_effet', decaler(aujourdhui, -6)).lte('date_effet', decaler(aujourdhui, 6)),
    sb.from('brvm_instruments').select('code,designation').eq('type', 'action'),
  ]);
  if (ops.error) logger.warn({ err: ops.error.message }, 'operations_titres illisible — aucune opération sur titres détectée');
  if (instr.error) throw new Error(`brvm_instruments : ${instr.error.message}`);

  const historique: Record<string, CoursRow[]> = {};
  for (const h of hist) (historique[h.code] ??= []).push(h);
  const ctx = {
    aujourdhui,
    derniereSeance,
    noms: Object.fromEntries(((instr.data ?? []) as { code: string; designation: string }[]).map((i) => [i.code, i.designation])),
    cours: Object.fromEntries(cours.map((c) => [c.code, c])),
    historique,
  };
  const operations = ((ops.data ?? []) as OperationRow[]).map((o) => ({ ...o, ratio: Number(o.ratio) }));
  const faits = detecter(ctx, divs, operations);
  res.detectes = faits.length;

  const cles = faits.map(cleFait);
  const { data: existants, error: eEx } = cles.length
    ? await sb.from('articles').select('fait').in('fait', cles)
    : { data: [], error: null };
  // À blanc, la table peut ne pas exister encore (0167 non appliquée) : on montre quand même les faits.
  if (eEx && !dryRun) throw new Error(`articles (existants) : ${eEx.message}`);
  const deja = new Set(((existants ?? []) as { fait: string }[]).map((e) => e.fait));

  for (const f of faits.filter((x) => !deja.has(cleFait(x)))) {
    const b = rediger(f, ctx.noms);
    const sections = await polishNarrative(b.sections, b.chiffres, resolveApiKeyForScraper).catch((e: Error) => {
      logger.warn({ err: e.message, fait: cleFait(f) }, 'articles : reformulation indisponible — squelette publié');
      return b.sections;
    });
    const corps_md = assembler(sections, b.sources);
    const verdict = verifier({ titre: b.titre, chapo: b.chapo, corps_md, sources: b.sources, chiffres: b.chiffres }, f, ctx);
    const statut = verdict.ok ? (TYPES_AUTOMATIQUES.has(f.type) ? 'publie' : 'a_valider') : 'brouillon';

    if (dryRun) {
      logger.info({ fait: cleFait(f), statut, titre: b.titre, blocage: verdict.manquants }, 'DRY_RUN — article non écrit');
      continue;
    }
    const { data: serie } = await sb
      .from('brvm_actions_daily')
      .select('date_marche,cours_jour')
      .eq('code', f.code)
      .gte('date_marche', decaler(derniereSeance, -365))
      .order('date_marche')
      .limit(400);
    const { error } = await sb.from('articles').upsert(
      {
        slug: b.slug,
        type: f.type,
        code: f.code,
        fait: cleFait(f),
        statut,
        titre: b.titre,
        chapo: b.chapo,
        corps_md,
        chiffres: {
          ...f.donnees,
          image: b.image,
          liste_blanche: b.chiffres,
          serie: ((serie ?? []) as { date_marche: string; cours_jour: number | null }[])
            .filter((s) => s.cours_jour != null)
            .map((s) => [s.date_marche, s.cours_jour]),
        },
        sources: b.sources,
        raison_blocage: verdict.ok ? null : verdict.manquants.join(', '),
        date_fait: f.dateFait,
        publie_le: statut === 'publie' ? new Date().toISOString() : null,
      },
      { onConflict: 'fait', ignoreDuplicates: true },
    );
    if (error) throw new Error(`articles : ${error.message}`);
    res.crees++;
    if (statut === 'publie') res.publies++;
    if (statut === 'brouillon') {
      res.bloques++;
      logger.warn({ fait: cleFait(f), manquants: verdict.manquants }, 'articles : bloqué en brouillon');
    }
  }

  if (!dryRun) res.posts = await diffuser(aujourdhui);
  logger.info({ ...res }, 'articles');
  return res;
}

/** Image carrée lue sur la route publique : l'article doit déjà être publié. */
async function image(slug: string): Promise<Buffer | null> {
  try {
    const r = await fetch(`${SITE}/api/articles/${slug}/image?format=carre`, { signal: AbortSignal.timeout(30_000) });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

async function telegram(texte: string, png: Buffer | null): Promise<string> {
  const jeton = process.env.TELEGRAM_BOT_TOKEN;
  const canal = process.env.TELEGRAM_CANAL;
  if (!jeton || !canal) return 'non_configure';
  const brut = texte.replace(/\*/g, '');
  try {
    let r: Response;
    if (png) {
      const form = new FormData();
      form.set('chat_id', canal);
      form.set('photo', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'westbourse-article.png');
      form.set('caption', brut.slice(0, 1024));
      r = await fetch(`https://api.telegram.org/bot${jeton}/sendPhoto`, { method: 'POST', body: form });
    } else {
      r = await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: canal, text: brut.slice(0, 4096) }),
      });
    }
    // L'URL appelée porte le jeton : seule la description de Telegram est relayée.
    const rep = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return rep.ok ? 'ok' : `echec: ${rep.description ?? r.status}`;
  } catch {
    return 'echec: injoignable';
  }
}

async function whatsapp(texte: string, png: Buffer | null): Promise<string> {
  const chaine = process.env.WHATSAPP_CHAINE_ID;
  if (!chaine || !wahaConfiguree()) return 'non_configure';
  const r = png ? await envoyerImageWaha(chaine, png, texte) : await envoyerTexteWaha(chaine, texte);
  return r.ok ? 'ok' : `echec: ${r.erreur}`;
}

/** Diffuse les articles publiés aujourd'hui et pas encore diffusés. Retourne le nombre de posts. */
async function diffuser(aujourdhui: string): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('articles')
    .select('id,slug,titre,chapo,diffuse')
    .eq('statut', 'publie')
    .gte('publie_le', `${aujourdhui}T00:00:00Z`)
    .order('publie_le');
  if (error) throw new Error(`articles (diffusion) : ${error.message}`);
  type Ligne = { id: string; slug: string; titre: string; chapo: string; diffuse: { jour?: string; mode?: string } | null };
  const lignes = (data ?? []) as Ligne[];
  const faits = lignes.filter((l) => l.diffuse?.jour === aujourdhui);
  const postsFaits =
    faits.filter((l) => l.diffuse?.mode === 'individuel').length + (faits.some((l) => l.diffuse?.mode === 'groupe') ? 1 : 0);
  const plan = planDiffusion(lignes.filter((l) => !l.diffuse), postsFaits);
  const marquer = async (id: string, diffuse: Record<string, string>) => {
    const { error: e } = await sb.from('articles').update({ diffuse, updated_at: new Date().toISOString() }).eq('id', id);
    if (e) logger.warn({ err: e.message, id }, 'articles : diffusion non journalisée');
  };

  let posts = 0;
  for (const a of plan.individuels) {
    const png = await image(a.slug);
    const texte = legende(a, SITE);
    await marquer(a.id, { jour: aujourdhui, mode: 'individuel', whatsapp: await whatsapp(texte, png), telegram: await telegram(texte, png) });
    posts++;
  }
  if (plan.groupe.length) {
    const texte = legendeGroupe(plan.groupe, SITE);
    const etat = { jour: aujourdhui, mode: 'groupe', whatsapp: await whatsapp(texte, null), telegram: await telegram(texte, null) };
    for (const a of plan.groupe) await marquer(a.id, etat);
    posts++;
  }
  for (const a of plan.ignores) await marquer(a.id, { jour: aujourdhui, mode: 'plafond' });
  return posts;
}
