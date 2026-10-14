// GET /api/academy/video/[slug]/[fichier]   (fichier = lecon-<n>.mp4 | lecon-<n>.jpg)
//
// Redirige vers une URL signée de courte durée sur le bucket PRIVÉ
// `academy-videos`, seulement si la personne peut suivre le niveau du cours :
// la même règle que le texte de la leçon (abonnement ou achat Chariow). Le
// lecteur <video> suit la redirection, et l'URL signée n'apparaît jamais dans
// le HTML de la page.
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';
import { BUCKET_VIDEOS, FICHIER_VALIDE, SLUG_VALIDE } from '@/lib/academy/videos';

export const dynamic = 'force-dynamic';

// Deux heures : une vidéo de quelques minutes, mise en pause puis reprise
// (chaque saut relit l'URL signée par plage d'octets), ne doit pas expirer.
const DUREE_SECONDES = 2 * 60 * 60;

export async function GET(_req: Request, { params }: { params: { slug: string; fichier: string } }) {
  const { slug, fichier } = params;
  if (!SLUG_VALIDE.test(slug) || !FICHIER_VALIDE.test(fichier)) {
    return NextResponse.json({ error: 'Ressource invalide.' }, { status: 400 });
  }

  const admin = getServiceClient();
  const { data: cours } = await admin
    .from('academy_courses')
    .select('niveau')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!cours) return NextResponse.json({ error: 'Cours introuvable.' }, { status: 404 });

  const { allowed } = await peutSuivreNiveau((cours as { niveau: string | null }).niveau);
  if (!allowed) return NextResponse.json({ error: 'Accès réservé.' }, { status: 403 });

  const { data, error } = await admin.storage.from(BUCKET_VIDEOS).createSignedUrl(`${slug}/${fichier}`, DUREE_SECONDES);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Aucune vidéo pour cette leçon.' }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
}
