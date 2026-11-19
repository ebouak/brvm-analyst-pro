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
import { accesDossier } from '@/lib/dossier/acces';

export const dynamic = 'force-dynamic';

const DUREE_SECONDES = 600;

export async function GET(_req: Request, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const code = params.code.toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    return NextResponse.json({ error: 'Code invalide.' }, { status: 400 });
  }

  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const acces = await accesDossier(code);
  if (acces.motif === 'indisponible') {
    return NextResponse.json({ error: 'Vérification des droits temporairement impossible.' }, { status: 503 });
  }
  if (!acces.complet) {
    return NextResponse.json(
      { error: 'Ce dossier doit être acheté ou inclus dans votre abonnement Premium.', achat: `/analyses/dossiers/${code}` },
      { status: 403 },
    );
  }

  const admin = getServiceClient();
  const { data, error } = await admin.storage.from('dossiers').createSignedUrl(`${code}/dernier.pdf`, DUREE_SECONDES, {
    download: `westbourse-dossier-${code}.pdf`,
  });

  if (error || !data?.signedUrl) {
    /* Pas encore produit pour cette valeur (nouveau code, ou lot du samedi pas
       encore passé). On le dit ; la page imprimable reste disponible. */
    return NextResponse.json(
      { error: "Aucun PDF n'a encore été produit pour cette valeur. Consultez la fiche du dossier.", page: `/analyses/dossiers/${code}` },
      { status: 404 },
    );
  }

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
