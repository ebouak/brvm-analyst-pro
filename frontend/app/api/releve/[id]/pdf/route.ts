// GET /api/releve/[id]/pdf
//
// Redirige le PROPRIÉTAIRE connecté vers le PDF de son relevé mensuel, par URL
// signée de 10 minutes sur le bucket privé `releves`. DONNÉES PRIVÉES :
//  - session obligatoire ; un anonyme reçoit 401 (c'est une ressource, pas une page) ;
//  - la ligne est lue avec le client de l'utilisateur : la RLS ne lui rend que
//    les siennes, et on revérifie `user_id` ;
//  - le chemin signé vient de la base (`report_url`), jamais de l'URL appelée ;
//  - aucune donnée de portefeuille dans l'adresse : seulement l'identifiant du relevé.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { idReleveValide } from '@/lib/releve/renduAutorise';

export const dynamic = 'force-dynamic';

const DUREE_SECONDES = 600;
const SANS_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!idReleveValide(id)) return NextResponse.json({ error: 'Relevé introuvable.' }, { status: 404, headers: SANS_CACHE });

  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401, headers: SANS_CACHE });

  const { data: ligne, error } = await sb
    .from('monthly_reports')
    .select('id, user_id, month, report_url')
    .eq('id', id)
    .maybeSingle();
  if (error || !ligne || ligne.user_id !== user.id) {
    return NextResponse.json({ error: 'Relevé introuvable.' }, { status: 404, headers: SANS_CACHE });
  }
  if (!ligne.report_url) {
    return NextResponse.json(
      { error: 'Le PDF de ce relevé n’est pas encore prêt. La page du relevé reste consultable.', page: `/rapports/releve/${ligne.id}` },
      { status: 404, headers: SANS_CACHE },
    );
  }

  const { data, error: errSign } = await getServiceClient()
    .storage.from('releves')
    .createSignedUrl(ligne.report_url, DUREE_SECONDES, { download: `westbourse-releve-${ligne.month}.pdf` });
  if (errSign || !data?.signedUrl) {
    return NextResponse.json({ error: 'PDF momentanément indisponible.' }, { status: 502, headers: SANS_CACHE });
  }
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: SANS_CACHE });
}
