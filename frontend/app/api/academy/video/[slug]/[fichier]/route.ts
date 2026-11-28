// GET /api/academy/video/[slug]/[fichier]   (fichier = lecon-<n>.mp4 | lecon-<n>.jpg)
//
// Redirige vers une URL signée de courte durée sur le bucket PRIVÉ
// `academy-videos`, seulement si la personne peut suivre le niveau du cours
// (ou sur une leçon offerte, voir lib/academy/leconsOffertes.ts) ET que la requête provient d'un
// lecteur embarqué sur la plateforme (et non d'un onglet direct ou d'un
// scraper). Le lecteur <video> suit la redirection sans exposer d'URL longue durée.
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { peutSuivreNiveau } from '@/lib/server/academyAccess';
import { BUCKET_VIDEOS, FICHIER_VALIDE, SLUG_VALIDE } from '@/lib/academy/videos';
import { accesOffert, leconOuverte } from '@/lib/academy/leconsOffertes';
import { dureeUrlSignee, verifierRequeteVideo } from '@/lib/academy/videoProtection';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' } as const;

export async function GET(
  req: Request,
  props: { params: Promise<{ slug: string; fichier: string }> },
) {
  const params = await props.params;
  const { slug, fichier } = params;
  const match = FICHIER_VALIDE.exec(fichier);
  if (!SLUG_VALIDE.test(slug) || !match) {
    return NextResponse.json({ error: 'Ressource invalide.' }, { status: 400, headers: NO_STORE });
  }

  const verif = verifierRequeteVideo(req.headers, fichier);
  if (!verif.ok) {
    return NextResponse.json(
      { error: 'Lecture autorisée uniquement depuis la plateforme.' },
      { status: 403, headers: NO_STORE },
    );
  }

  // FICHIER_VALIDE borne le numéro à 1-99 : l'index du chemin JSON est un entier positif.
  const numero = Number(match[1]);
  const admin = getServiceClient();
  const { data: cours } = await admin
    .from('academy_courses')
    .select(`niveau, titre_lecon:content->lessons->${numero - 1}->>titre`)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!cours) return NextResponse.json({ error: 'Cours introuvable.' }, { status: 404, headers: NO_STORE });

  // L'analyseur de types de supabase-js ne lit pas un chemin JSON à index variable ;
  // la forme a été vérifiée en lecture réelle (titre exact, ou null hors limites).
  const { niveau, titre_lecon } = cours as unknown as { niveau: string | null; titre_lecon: string | null };
  const { allowed, acces } = await peutSuivreNiveau(niveau);
  if (!allowed && !leconOuverte(accesOffert(slug, titre_lecon), Boolean(acces.userId))) {
    return NextResponse.json({ error: 'Accès réservé.' }, { status: 403, headers: NO_STORE });
  }

  const { data, error } = await admin.storage
    .from(BUCKET_VIDEOS)
    .createSignedUrl(`${slug}/${fichier}`, dureeUrlSignee(fichier), { download: false });
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Aucune vidéo pour cette leçon.' }, { status: 404, headers: NO_STORE });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'same-origin',
      Vary: 'Cookie, Sec-Fetch-Dest, Sec-Fetch-Site',
    },
  });
}
