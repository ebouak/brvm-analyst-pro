import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/chariow/status?txn=<uuid>
 * Statut d'UNE transaction de l'utilisateur connecté. Lecture par la session :
 * la RLS `billing_owner_read` interdit de lire la transaction d'autrui.
 * Lecture seule — n'accorde jamais rien.
 */
export async function GET(req: Request) {
  const txn = new URL(req.url).searchParams.get('txn') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(txn)) return NextResponse.json({ error: 'Référence invalide.' }, { status: 400 });

  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });

  const { data } = await db
    .from('billing_transactions')
    .select('status, objet, product_code, paid_at')
    .eq('id', txn)
    .eq('provider', 'chariow')
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Transaction introuvable.' }, { status: 404 });

  return NextResponse.json(
    { status: data.status, objet: data.objet, productCode: data.product_code, paidAt: data.paid_at },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
