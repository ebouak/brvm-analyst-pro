'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendBatch } from '@/lib/server/email';
import { campaignHtml, siteUrl } from '@/lib/email/templates';
import { articleEmailHtml, libelleCampagne, sujetArticle, type ArticlePourEmail, type CampagneArticle } from '@/lib/email/articleEmail';

type R = { ok: boolean; message: string };
type Db = ReturnType<typeof getServiceClient>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pose le verrou d'envoi AVANT d'écrire à qui que ce soit : la clé primaire de
 * `article_campagnes` refuse un second envoi du même article (double clic,
 * deux onglets, relance réseau). Seul un échec total peut être relancé.
 */
async function prendreVerrou(db: Db, id: string, destinataires: number): Promise<R> {
  const maintenant = new Date().toISOString();
  const { error } = await db.from('article_campagnes').insert({ article_id: id, statut: 'en_cours', destinataires, lance_le: maintenant });
  if (!error) return { ok: true, message: '' };
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return { ok: false, message: 'Table article_campagnes absente : appliquez la migration 0169.' };
  }
  if (error.code !== '23505') return { ok: false, message: "Verrou d'envoi impossible, rien n'a été envoyé." };

  const { data: relance } = await db
    .from('article_campagnes')
    .update({ statut: 'en_cours', destinataires, envoyes: null, erreur: null, lance_le: maintenant, termine_le: null })
    .eq('article_id', id)
    .eq('statut', 'echec')
    .select('article_id');
  if (relance && relance.length > 0) return { ok: true, message: '' };

  const { data: existant } = await db
    .from('article_campagnes')
    .select('statut, destinataires, envoyes, lance_le')
    .eq('article_id', id)
    .maybeSingle();
  return { ok: false, message: existant ? `Déjà traité : ${libelleCampagne(existant as CampagneArticle)}.` : 'Article déjà envoyé.' };
}

/** Envoie un article PUBLIÉ à tous les abonnés confirmés, une seule fois. */
export async function envoyerArticleParEmail(id: string): Promise<R> {
  const ctx = await requirePermission('content.publish');
  if (!UUID.test(id)) return { ok: false, message: 'Article inconnu.' };
  const db = getServiceClient();

  const { data: art } = await db
    .from('articles')
    .select('id, slug, type, titre, chapo, date_fait, chiffres, statut')
    .eq('id', id)
    .maybeSingle();
  if (!art) return { ok: false, message: 'Article inconnu.' };
  // Le lien de l'email mène à la page publique : un brouillon y serait introuvable.
  if (art.statut !== 'publie') return { ok: false, message: "Publiez l'article avant de l'envoyer." };

  const { data: abonnes, error: eAb } = await db
    .from('newsletter_subscribers')
    .select('email, confirm_token')
    .eq('confirmed', true);
  if (eAb) return { ok: false, message: 'Lecture des abonnés impossible.' };
  const destinataires = (abonnes ?? []) as { email: string; confirm_token: string }[];
  if (destinataires.length === 0) return { ok: false, message: 'Aucun abonné confirmé.' };

  const verrou = await prendreVerrou(db, id, destinataires.length);
  if (!verrou.ok) return verrou;

  const a = art as ArticlePourEmail;
  const base = siteUrl();
  const sujet = sujetArticle(a);
  const corps = articleEmailHtml(a, base);
  const res = await sendBatch(
    destinataires.map((r) => ({
      to: r.email,
      subject: sujet,
      html: campaignHtml(corps, `${base}/api/newsletter/unsubscribe?token=${r.confirm_token}`),
    })),
  );

  const statut = res.ok ? 'envoye' : res.sent > 0 ? 'partiel' : 'echec';
  const { error: eFin } = await db
    .from('article_campagnes')
    .update({ statut, envoyes: res.sent, erreur: res.error ?? null, termine_le: new Date().toISOString() })
    .eq('article_id', id);
  await recordAudit(ctx, {
    action: 'newsletter.article',
    resourceType: 'article',
    resourceId: id,
    severity: 'warning',
    metadata: { slug: a.slug, recipients: destinataires.length, sent: res.sent, ok: res.ok, error: res.error ?? null, trace: eFin ? 'non écrite' : 'ok' },
  });
  revalidatePath('/admin/articles');
  revalidatePath('/admin/newsletter');

  if (statut === 'envoye') return { ok: true, message: `Article envoyé à ${res.sent} abonné${res.sent > 1 ? 's' : ''}.` };
  if (statut === 'partiel') return { ok: false, message: `Envoi partiel : ${res.sent} sur ${destinataires.length}. ${res.error ?? ''}`.trim() };
  return { ok: false, message: `Échec de l'envoi, aucun email parti. ${res.error ?? ''}`.trim() };
}
