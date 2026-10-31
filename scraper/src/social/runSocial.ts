import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sendTelegramText } from '../alerts/channels.js';
import { jetonUtilisable, type ReseauSocial } from './jetons.js';
import { prendreVerrou, terminer, ignorer, proposer } from './verrou.js';
import { publierLinkedIn } from './linkedin.js';
import { PLAFOND_SOCIAL_JOUR, repartir, texteLinkedIn, texteTikTok, type ArticleSocial } from './texte.js';

/**
 * Articles PUBLIÉS aujourd'hui vers les réseaux. Appelée par le cron des
 * articles (17:00 UTC) après WhatsApp/Telegram, et seule par `social:articles`
 * pour une reprise manuelle.
 *
 * - LinkedIn : publication directe sur le profil de l'exploitant.
 * - TikTok : la publication est PRÉPARÉE (`a_valider`) puis publiée par
 *   l'exploitant depuis /admin/reseaux/tiktok. Les règles d'audit de TikTok
 *   (Content Sharing Guidelines) exigent un choix explicite à chaque envoi —
 *   visibilité, interactions, déclaration commerciale — qu'un cron ne peut pas
 *   faire à sa place.
 *
 * Garde-fous : interrupteur `actif` par réseau, plafond quotidien par réseau
 * (PLAFOND_SOCIAL_JOUR), une ligne par (article, réseau), et toute panne part
 * sur la conversation d'EXPLOITATION Telegram — jamais d'échec silencieux.
 */
const SITE = (process.env.SITE_URL || 'https://www.westbourse.com').replace(/\/+$/, '');

export interface ResultatSocial {
  linkedin: number;
  /** Publications TikTok préparées, en attente de validation. */
  tiktok: number;
  echecs: number;
  ignores: number;
}

async function alerter(sujet: string, corps: string): Promise<void> {
  try {
    await sendTelegramText({ subject: sujet, body: corps, operateur: true });
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'réseaux : alerte Telegram impossible');
  }
}

async function imagePaysage(slug: string): Promise<Buffer | null> {
  try {
    const r = await fetch(`${SITE}/api/articles/${slug}/image`, { signal: AbortSignal.timeout(30_000) });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function publierArticlesSociaux(aujourdhui: string): Promise<ResultatSocial> {
  const sb = getSupabase();
  const res: ResultatSocial = { linkedin: 0, tiktok: 0, echecs: 0, ignores: 0 };
  const debut = `${aujourdhui}T00:00:00Z`;
  const { data, error } = await sb
    .from('articles')
    .select('id, slug, type, titre, chapo')
    .eq('statut', 'publie')
    .gte('publie_le', debut)
    .order('publie_le');
  if (error) throw new Error(`articles (réseaux) : ${error.message}`);
  const articles = (data ?? []) as ArticleSocial[];
  if (articles.length === 0) return res;

  for (const reseau of ['linkedin', 'tiktok'] as ReseauSocial[]) {
    const jeton = await jetonUtilisable(reseau);
    if (!jeton.ok) {
      logger.info({ reseau, raison: jeton.raison }, 'réseaux : abstention');
      if (jeton.alerter) await alerter(`Réseaux : ${reseau} en panne`, `${articles.length} article(s) du jour non publiés sur ${reseau} : ${jeton.raison}.`);
      continue;
    }

    const { data: lignes, error: eL } = await sb
      .from('publications_sociales')
      .select('cible_id, statut, lance_le')
      .eq('cible', 'article')
      .eq('reseau', reseau)
      .in('cible_id', articles.map((a) => a.id));
    if (eL) throw new Error(`publications_sociales : ${eL.message}`);
    const traces = (lignes ?? []) as { cible_id: string; statut: string; lance_le: string }[];
    const dejaTraites = new Set(traces.filter((t) => t.statut !== 'echec').map((t) => t.cible_id));
    const dejaAujourdhui = traces.filter((t) => ['publie', 'en_cours', 'a_valider'].includes(t.statut) && t.lance_le >= debut).length;
    const { aPublier, auDela } = repartir(articles.filter((a) => !dejaTraites.has(a.id)), dejaAujourdhui);

    for (const a of auDela) {
      await ignorer('article', a.id, reseau, `plafond de ${PLAFOND_SOCIAL_JOUR} articles par jour atteint`);
      res.ignores++;
    }

    if (reseau === 'tiktok') {
      for (const a of aPublier) {
        const t = texteTikTok(a);
        const contenu = { type: 'photo', titre: t.titre, description: t.description, media: [`${SITE}/api/articles/${a.slug}/photo.jpg`], lien: `${SITE}/actualites/${a.slug}` };
        if (await proposer('article', a.id, 'tiktok', contenu)) res.tiktok++;
      }
      if (res.tiktok > 0) {
        await alerter('TikTok : publications à valider', `${res.tiktok} article(s) prêt(s) pour TikTok. À publier ici : ${SITE}/admin/reseaux/tiktok`);
      }
      continue;
    }

    for (const a of aPublier) {
      if (!(await prendreVerrou('article', a.id, reseau))) continue;
      try {
        if (!jeton.compteId) throw new Error('identifiant du profil LinkedIn absent, reconnectez LinkedIn');
        const postId = await publierLinkedIn({ token: jeton.token, auteur: jeton.compteId, texte: texteLinkedIn(a, SITE), image: await imagePaysage(a.slug), titreImage: a.titre });
        await terminer('article', a.id, reseau, { statut: 'publie', postId });
        res.linkedin++;
        logger.info({ reseau, slug: a.slug, postId }, 'réseaux : publié');
      } catch (e) {
        const msg = (e as Error).message;
        await terminer('article', a.id, reseau, { statut: 'echec', erreur: msg });
        res.echecs++;
        logger.error({ reseau, slug: a.slug, err: msg }, 'réseaux : échec');
        await alerter(`Réseaux : échec ${reseau}`, `« ${a.titre} » n'est pas parti sur ${reseau} : ${msg}. Relance possible (social:articles).`);
      }
    }
  }
  return res;
}
