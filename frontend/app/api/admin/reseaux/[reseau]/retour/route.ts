import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { echangerCode } from '@/lib/server/social';
import { cheminRetour, estReseau } from '@/lib/social/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function memeState(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Retour OAuth : vérifie le `state`, échange le code, range les jetons dans
 * `social_tokens` (service_role). Les jetons ne passent jamais par le
 * navigateur ni par un journal ; l'audit ne garde que le réseau et le compte.
 */
export async function GET(req: NextRequest, { params }: { params: { reseau: string } }) {
  const ctx = await requirePermission('content.publish');
  const r = params.reseau;
  if (!estReseau(r)) return NextResponse.json({ erreur: 'Réseau inconnu.' }, { status: 404 });
  const origine = req.nextUrl.origin;
  const retour = (q: string) => {
    const res = NextResponse.redirect(`${origine}/admin/reseaux?${q}`);
    res.cookies.set(`ws_oauth_${r}`, '', { path: '/api/admin/reseaux', maxAge: 0 });
    return res;
  };

  const p = req.nextUrl.searchParams;
  const refus = p.get('error_description') ?? p.get('error');
  if (refus) return retour(`erreur=${encodeURIComponent(`${r} : ${refus.slice(0, 160)}`)}`);
  if (!memeState(p.get('state'), req.cookies.get(`ws_oauth_${r}`)?.value)) {
    return retour(`erreur=${encodeURIComponent(`${r} : état de connexion invalide ou expiré, recommencez`)}`);
  }
  const code = p.get('code');
  if (!code) return retour(`erreur=${encodeURIComponent(`${r} : aucun code reçu`)}`);

  try {
    const j = await echangerCode(r, code, `${origine}${cheminRetour(r)}`);
    const { error } = await getServiceClient()
      .from('social_tokens')
      .upsert({ reseau: r, ...j, actif: true, maj_le: new Date().toISOString() }, { onConflict: 'reseau' });
    if (error) {
      const msg = error.code === '42P01' || error.code === 'PGRST205' ? 'table social_tokens absente, appliquez la migration 0170' : 'enregistrement impossible';
      return retour(`erreur=${encodeURIComponent(`${r} : ${msg}`)}`);
    }
    await recordAudit(ctx, {
      action: 'reseaux.connexion',
      resourceType: 'social_tokens',
      resourceId: r,
      severity: 'warning',
      metadata: { compte: j.compte_nom, expire_le: j.expire_le, scopes: j.scopes },
    });
    return retour(`ok=${r}`);
  } catch (e) {
    return retour(`erreur=${encodeURIComponent((e as Error).message.slice(0, 200))}`);
  }
}
