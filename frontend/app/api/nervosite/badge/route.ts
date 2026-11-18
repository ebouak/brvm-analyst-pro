// Pastille de l'indice de nervosité pour la barre de cote : donnée de MARCHÉ,
// publique. Aucune session, aucun cookie : la réponse est la même pour tous et
// se met en cache côté CDN. C'est ce qui permet à la barre (composant client,
// posée par le layout racine) de l'afficher sans rendre le layout dynamique.
import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerBadgeNervosite } from '@/lib/nervosite/lecture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 5 min : la valeur change une fois par jour, mais l'état « en retard » dépend
// de l'heure (lib/nervosite/badge.ts) ; un cache plus long le figerait.
const CACHE = 'public, s-maxage=300, stale-while-revalidate=600';

export async function GET() {
  try {
    const badge = await chargerBadgeNervosite(createPublicClient());
    return NextResponse.json({ badge }, { headers: { 'Cache-Control': CACHE } });
  } catch {
    // Le client n'affiche rien plutôt qu'une pastille qu'il ne peut pas étayer.
    return NextResponse.json({ erreur: 'indisponible' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
