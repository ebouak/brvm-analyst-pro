import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { corpsCheckout, normaliserTelephone } from '@/lib/billing/chariow/regles';
import { demarrerAchat } from '@/lib/billing/chariow/checkout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/chariow/checkout
 * Corps accepté : { productCode, firstName, lastName, phone: { number, countryCode } }.
 * Tout autre champ (prix, product_id, plan, rôle…) fait échouer la requête.
 * Réponse : { url } vers la page de paiement Chariow.
 */
export async function POST(req: Request) {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connectez-vous pour acheter.' }, { status: 401 });

  let brut: unknown;
  try {
    brut = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  if (brut && typeof brut === 'object' && 'phone' in brut) {
    const p = (brut as { phone?: { number?: unknown } }).phone;
    if (p && typeof p.number === 'string') p.number = normaliserTelephone(p.number);
  }
  const parse = corpsCheckout.safeParse(brut);
  if (!parse.success) {
    return NextResponse.json({ error: 'Vérifiez vos informations (nom, téléphone, pays).' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const r = await demarrerAchat({ userId: user.id, email: user.email ?? '', corps: parse.data, ip });
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: r.statut });
  return NextResponse.json({ url: r.url, transactionId: r.transactionId });
}
