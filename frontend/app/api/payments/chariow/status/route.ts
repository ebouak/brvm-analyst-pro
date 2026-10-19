import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rapprocherVente } from '@/lib/billing/chariow/rapprochement';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/chariow/status?txn=<uuid>
 * Statut d'UNE transaction de l'utilisateur connecté. Lecture par la session :
 * la RLS `billing_owner_read` interdit de lire la transaction d'autrui.
 * N'accorde rien sur la foi du navigateur : si la transaction attend encore,
 * la vente est relue CHEZ CHARIOW (rapprocherVente) et n'est accordée que si
 * elle concorde.
 */
export async function GET(req: Request) {
  const txn = new URL(req.url).searchParams.get('txn') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(txn)) return NextResponse.json({ error: 'Référence invalide.' }, { status: 400 });

  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const lire = () => db
    .from('billing_transactions')
    .select('status, objet, product_code, paid_at, provider_sale_id, created_at')
    .eq('id', txn)
    .eq('provider', 'chariow')
    .maybeSingle();
  let { data } = await lire();
  if (!data) return NextResponse.json({ error: 'Transaction introuvable.' }, { status: 404 });

  // Filet si le Pulse n'arrive pas (constaté le 2026-10-19) : la transaction
  // est à CET utilisateur (lue par sa session, RLS), alors on relit la vente
  // chez Chariow et on accorde si elle concorde — mêmes contrôles que le
  // webhook, idempotent. On laisse 15 s au webhook, puis on interroge Chariow
  // environ une fois sur trois appels (la page interroge toutes les ~4 s).
  const age = Date.now() - new Date(String(data.created_at)).getTime();
  if (data.status === 'pending' && data.provider_sale_id && age > 15_000 && Math.floor(Date.now() / 4000) % 3 === 0) {
    const r = await rapprocherVente(txn);
    if (r.ok) ({ data } = await lire());
    if (!data) return NextResponse.json({ error: 'Transaction introuvable.' }, { status: 404 });
  }

  return NextResponse.json(
    { status: data.status, objet: data.objet, productCode: data.product_code, paidAt: data.paid_at },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
