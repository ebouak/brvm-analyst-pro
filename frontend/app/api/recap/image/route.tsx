import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { chargerRecap } from '@/lib/recap/donnees';
import { imageRecap } from '@/lib/recap/rendu';
import { verifierRecap } from '@/lib/recap/signature';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Image de la récap du portefeuille (spec 2026-10-24-recap-portefeuille).
 *
 * Deux voies d'identité, jamais d'autre :
 *   1. la SESSION — bouton de /portefeuille, l'utilisateur voit SA récap ;
 *   2. un LIEN SIGNÉ (u, exp, sig ; RECAP_SECRET, 10 min max) — envois du
 *      soir par les workers, qui n'ont pas de session.
 * Un lien signé invalide est refusé (401) SANS retomber sur la session : on ne
 * mélange pas les deux voies.
 *
 * Runtime Edge, comme toutes les images du site (next/og éprouvé en Edge).
 * Réponse privée et non mise en cache ; `?telecharger=1` propose le fichier.
 * Portefeuille vide → 404 (les workers n'envoient alors rien).
 */
const NON_CACHE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  let userId: string | null = null;

  if (p.has('sig')) {
    userId = await verifierRecap({ u: p.get('u'), exp: p.get('exp'), sig: p.get('sig') }, process.env.RECAP_SECRET);
    if (!userId) return NextResponse.json({ erreur: 'Lien invalide ou expiré.' }, { status: 401, headers: NON_CACHE });
  } else {
    const { data } = await createClient().auth.getUser();
    userId = data.user?.id ?? null;
    if (!userId) return NextResponse.json({ erreur: 'Connexion requise.' }, { status: 401, headers: NON_CACHE });
  }

  const db = getServiceClient();
  const recap = await chargerRecap(db, userId).catch((e) => {
    console.error('[recap] lecture impossible :', (e as Error).message);
    return null;
  });
  if (!recap) return NextResponse.json({ erreur: 'Données de marché indisponibles.' }, { status: 503, headers: NON_CACHE });
  if (recap.vide) return NextResponse.json({ erreur: 'Portefeuille vide.' }, { status: 404, headers: NON_CACHE });

  const { data: profil } = await db.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  const brut = ((profil?.display_name as string | null) ?? '').trim().split(/\s+/)[0] ?? '';
  // « feca » → « Feca » : le nom affiché est saisi librement par l'utilisateur.
  const prenom = brut ? brut.charAt(0).toLocaleUpperCase('fr-FR') + brut.slice(1) : null;
  const image = imageRecap(recap, prenom);

  if (p.get('telecharger') === '1') {
    const entetes = new Headers(image.headers);
    entetes.set('Content-Disposition', `attachment; filename="westbourse-recap-${recap.seance}.png"`);
    return new Response(image.body, { status: 200, headers: entetes });
  }
  return image;
}
