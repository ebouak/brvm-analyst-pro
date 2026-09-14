// GET /api/dossier/[code]/pdf
//
// Redirige un utilisateur CONNECTÉ vers le dernier PDF du dossier valeur, par
// URL signée de courte durée sur le bucket privé `dossiers`. Le bucket n'a
// aucune policy : seul le service_role y lit, et il ne le fait qu'après avoir
// vérifié la session ici. Un anonyme reçoit 401, jamais une redirection vers
// /login — c'est une ressource, pas une page.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

const DUREE_SECONDES = 600;

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    return NextResponse.json({ error: 'Code invalide.' }, { status: 400 });
  }

  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const admin = getServiceClient();
  const { data, error } = await admin.storage.from('dossiers').createSignedUrl(`${code}/dernier.pdf`, DUREE_SECONDES, {
    download: `westbourse-dossier-${code}.pdf`,
  });

  if (error || !data?.signedUrl) {
    /* Pas encore produit pour cette valeur (nouveau code, ou lot du samedi pas
       encore passé). On le dit ; la page imprimable reste disponible. */
    return NextResponse.json(
      { error: "Aucun PDF n'a encore été produit pour cette valeur. La page du dossier reste imprimable.", page: `/rapports/dossier/${code}` },
      { status: 404 },
    );
  }

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
