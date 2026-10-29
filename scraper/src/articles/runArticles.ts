/**
 * Articles de presse du lot 1 : détecte, rédige, verrouille, écrit, diffuse
 * (spec docs/superpowers/specs/2026-10-28-articles-presse-design.md).
 *
 * Idempotent : un fait déjà en base (colonne `fait`, unique) n'est jamais
 * réécrit, un article déjà diffusé (colonne `diffuse`) jamais rediffusé.
 * DRY_RUN : journalise ce qui serait écrit, n'écrit ni ne diffuse rien.
 * ARTICLES_REECRIRE=1 : régénère EN PLACE (même slug) les articles des faits
 * du jour, après une amélioration des gabarits — sans les rediffuser.
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
import { publierArticlesSociaux, type ResultatSocial } from '../social/runSocial.js';
import {
  cleFait,
  TYPES_AUTOMATIQUES,
  type CoursRow,
  type DividendeRow,
  type IndiceRow,
  type OperationRow,
  type RecordValeur,
  type Reperes,
} from './types.js';

export interface ResultatArticles {
  detectes: number;
  crees: number;
  publies: number;
  bloques: number;
  posts: number;
  /** LinkedIn / TikTok (src/social) : absent en essai ou en réécriture. */
  reseaux?: ResultatSocial;
}

const SITE = (process.env.SITE_URL || 'https://www.westbourse.com').replace(/\/+$/, '');
const COLS_COURS = 'code,date_marche,cours_jour,cours_precedent,variation_pct,volume,valeur_echangee,cours_haut_52s,cours_bas_52s';
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

/** Record de capitaux AVANT la séance, pour les valeurs qui pèsent le plus ce jour-là. */
async function recordsValeur(codes: string[], seance: string): Promise<Record<string, RecordValeur>> {
  const sb = getSupabase();
  const out: Record<string, RecordValeur> = {};
  for (const code of codes) {
    const [{ data: max }, { data: debut }] = await Promise.all([
      sb.from('brvm_actions_daily').select('date_marche,valeur_echangee').eq('code', code).lt('date_marche', seance)
        .not('valeur_echangee', 'is', null).order('valeur_echangee', { ascending: false }).limit(1),
      sb.from('brvm_actions_daily').select('date_marche').eq('code', code).order('date_marche').limit(1),
    ]);
    const m = (max?.[0] ?? null) as { date_marche: string; valeur_echangee: number } | null;
    const d = (debut?.[0] ?? null) as { date_marche: string } | null;
    if (m && d) out[code] = { valeur: Number(m.valeur_echangee), date: m.date_marche, depuis: d.date_marche };
  }
  return out;
}

/** Repères « thèse » d'une valeur : faits mesurés, chacun facultatif. */
async function chargerReperes(code: string): Promise<Reperes> {
  const sb = getSupabase();
  const [res, divs, liq, sig] = await Promise.all([
    sb.from('income_statements').select('periode,benefice_par_action').eq('code', code).eq('type_periode', 'annuel')
      .not('benefice_par_action', 'is', null).order('periode', { ascending: false }).limit(1),
    sb.from('dividends').select('exercice,montant').eq('code', code).gt('montant', 0).not('exercice', 'is', null)
      .order('exercice', { ascending: false }).limit(2),
    sb.from('liquidity_daily').select('score,classe').eq('code', code).order('date_marche', { ascending: false }).limit(1),
    sb.from('signals_daily').select('signal').eq('code', code).order('date_marche', { ascending: false }).limit(1),
  ]);
  const r = (res.data?.[0] ?? null) as { periode: string; benefice_par_action: number } | null;
  const l = (liq.data?.[0] ?? null) as { score: number | null; classe: string | null } | null;
  const s = (sig.data?.[0] ?? null) as { signal: string | null } | null;
  return {
    bpa: r ? Number(r.benefice_par_action) : null,
    exercice_bpa: r?.periode ?? null,
    dividendes: ((divs.data ?? []) as { exercice: number; montant: number }[]).map((x) => ({ exercice: x.exercice, montant: Number(x.montant) })),
    liquidite_classe: l?.classe ?? null,
    liquidite_score: l?.score ?? null,
    signal: s?.signal ?? null,
  };
}

export async function runArticles(opts: { mock?: boolean } = {}): Promise<ResultatArticles> {
  const res: ResultatArticles = { detectes: 0, crees: 0, publies: 0, bloques: 0, posts: 0 };
  if (opts.mock) return res;
  const sb = getSupabase();
  const dryRun = getConfig().DRY_RUN;
  const reecrire = process.env.ARTICLES_REECRIRE === '1';
  const aujourdhui = todayMarketDate();

  const { data: der, error: eDer } = await sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
  if (eDer) throw new Error(`dernière séance : ${eDer.message}`);
  const derniereSeance = (der?.[0] as { date_marche: string } | undefined)?.date_marche;
  if (!derniereSeance) throw new Error('aucune séance en base');

  const [cours, hist, divs, ops, instr, idx] = await Promise.all([
    paginer<CoursRow>((de, a) => sb.from('brvm_actions_daily').select(COLS_COURS).eq('date_marche', derniereSeance).range(de, a)),
    paginer<CoursRow>((de, a) =>
      sb.from('brvm_actions_daily').select(COLS_COURS).gte('date_marche', decaler(derniereSeance, -60)).lt('date_marche', derniereSeance)
        .order('date_marche').range(de, a),
    ),
    paginer<DividendeRow>((de, a) =>
      sb.from('dividends').select('code,exercice,montant,ex_date,payment_date,source,created_at')
        .or(`created_at.gte.${decaler(aujourdhui, -5)},ex_date.gte.${decaler(aujourdhui, -7)},payment_date.gte.${decaler(aujourdhui, -1)}`)
        .range(de, a),
    ),
    sb.from('operations_titres').select('code,date_effet,type,ratio').gte('date_effet', decaler(aujourdhui, -12)).lte('date_effet', decaler(aujourdhui, 6)),
    sb.from('brvm_instruments').select('code,designation,shares').eq('type', 'action'),
    sb.from('brvm_indices_daily').select('code,valeur,variation_pct').eq('date_marche', derniereSeance),
  ]);
  if (ops.error) logger.warn({ err: ops.error.message }, 'operations_titres illisible — aucune opération sur titres détectée');
  if (instr.error) throw new Error(`brvm_instruments : ${instr.error.message}`);

  const historique: Record<string, CoursRow[]> = {};
  for (const h of hist) (historique[h.code] ??= []).push(h);
  const instruments = (instr.data ?? []) as { code: string; designation: string; shares: number | null }[];
  const parValeur = [...cours].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0)).slice(0, 5).map((c) => c.code);
  const ctx = {
    aujourdhui,
    derniereSeance,
    noms: Object.fromEntries(instruments.map((i) => [i.code, i.designation])),
    cours: Object.fromEntries(cours.map((c) => [c.code, c])),
    historique,
    indices: (idx.data ?? []) as IndiceRow[],
    actions: Object.fromEntries(instruments.map((i) => [i.code, i.shares != null ? Number(i.shares) : null])),
    recordsValeur: await recordsValeur(parValeur, derniereSeance),
  };
  // Opérations sur 12 jours pour le rappel dans la séance, 5 jours pour l'article dédié (détecteur).
  const operations = ((ops.data ?? []) as OperationRow[]).map((o) => ({ ...o, ratio: Number(o.ratio) }));
  const faits = detecter(ctx, divs, operations);
  res.detectes = faits.length;

  const slugsDe = new Map(faits.map((f) => [cleFait(f), rediger(f, ctx.noms).slug]));
  const { data: existants, error: eEx } = faits.length
    ? await sb.from('articles').select('fait,slug').or(`fait.in.(${faits.map((f) => `"${cleFait(f)}"`).join(',')}),slug.in.(${[...slugsDe.values()].join(',')})`)
    : { data: [], error: null };
  // À blanc, la table peut ne pas exister encore : on montre quand même les faits.
  if (eEx && !dryRun) throw new Error(`articles (existants) : ${eEx.message}`);
  const deja = new Set(((existants ?? []) as { fait: string; slug: string }[]).flatMap((e) => [e.fait, e.slug]));
  const aTraiter = faits.filter((f) => reecrire || !(deja.has(cleFait(f)) || deja.has(slugsDe.get(cleFait(f))!)));

  for (const f of aTraiter) {
    const reperes = await chargerReperes(f.code).catch(() => null);
    const b = rediger(f, ctx.noms, reperes);
    const sections = await polishNarrative(b.sections, b.chiffres, resolveApiKeyForScraper).catch((e: Error) => {
      logger.warn({ err: e.message, fait: cleFait(f) }, 'articles : reformulation indisponible — squelette publié');
      return b.sections;
    });
    const corps_md = assembler(sections, b.sources);
    const verdict = verifier({ titre: b.titre, chapo: b.chapo, corps_md, sources: b.sources, chiffres: b.chiffres }, f, ctx);
    const statut = verdict.ok ? (TYPES_AUTOMATIQUES.has(f.type) ? 'publie' : 'a_valider') : 'brouillon';

    if (dryRun) {
      logger.info({ fait: cleFait(f), statut, titre: b.titre, chapo: b.chapo, blocage: verdict.manquants }, 'DRY_RUN — article non écrit');
      logger.info(corps_md);
      continue;
    }
    const [{ data: serie }, { data: liens }] = await Promise.all([
      sb.from('brvm_actions_daily').select('date_marche,cours_jour').eq('code', f.code)
        .gte('date_marche', decaler(derniereSeance, -365)).order('date_marche').limit(400),
      sb.from('articles').select('slug,titre').eq('code', f.code).eq('statut', 'publie').neq('slug', b.slug)
        .order('publie_le', { ascending: false }).limit(3),
    ]);
    const ligne = {
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
        liens: liens ?? [],
        serie: ((serie ?? []) as { date_marche: string; cours_jour: number | null }[])
          .filter((s) => s.cours_jour != null)
          .map((s) => [s.date_marche, s.cours_jour]),
      },
      sources: b.sources,
      raison_blocage: verdict.ok ? null : verdict.manquants.join(', '),
      date_fait: f.dateFait,
      updated_at: new Date().toISOString(),
    };
    if (reecrire && deja.has(b.slug)) {
      // Réécriture en place : publication et diffusion d'origine conservées.
      const { error } = await sb.from('articles').update(ligne).eq('slug', b.slug);
      if (error) throw new Error(`articles (réécriture) : ${error.message}`);
      logger.info({ slug: b.slug, statut }, 'articles : réécrit en place');
      continue;
    }
    const { error } = await sb
      .from('articles')
      .upsert({ ...ligne, publie_le: statut === 'publie' ? new Date().toISOString() : null }, { onConflict: 'fait', ignoreDuplicates: true });
    if (error) throw new Error(`articles : ${error.message}`);
    res.crees++;
    if (statut === 'publie') res.publies++;
    if (statut === 'brouillon') {
      res.bloques++;
      logger.warn({ fait: cleFait(f), manquants: verdict.manquants }, 'articles : bloqué en brouillon');
    }
  }

  if (!dryRun && !reecrire) {
    res.posts = await diffuser(aujourdhui);
    // Après WhatsApp/Telegram, et isolé : une panne LinkedIn/TikTok est
    // alertée par src/social, elle ne doit pas faire échouer les articles.
    try {
      res.reseaux = await publierArticlesSociaux(aujourdhui);
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'articles : publication réseaux impossible');
    }
  }
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
