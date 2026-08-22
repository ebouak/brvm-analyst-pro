// frontend/app/api/whatsapp/pairing/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { generatePairingCode, pairingExpiresAt } from '@/lib/whatsappAgent/pairing';

export const dynamic = 'force-dynamic';

/**
 * Limitation de la GÉNÉRATION de codes. À ne pas confondre avec le rate-limit
 * de `redeemPairing` (route `whatsapp-pairing`), qui borne les tentatives de
 * consommation depuis un numéro WhatsApp. Ici on borne un utilisateur
 * authentifié qui cliquerait en boucle sur « Lier mon numéro ».
 *
 * Clé : l'UUID du compte, et non l'IP — il est stable derrière un NAT ou un
 * changement de réseau, et n'est pas une donnée personnelle à protéger comme
 * l'est un numéro (c'est un identifiant interne, déjà présent dans
 * `whatsapp_pairing_codes.user_id`).
 */
const MAX_GENERATIONS = 10;
const WINDOW_SECONDS = 10 * 60;

/**
 * Génère un code d'appairage à usage unique pour l'utilisateur connecté.
 *
 * La génération vit côté serveur parce que `pairing.ts` s'appuie sur
 * `node:crypto` (aléa cryptographique) et parce que la table n'accepte aucune
 * écriture `authenticated` : seul le service-role insère (migration 0128).
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { allowed } = await checkRateLimit({
    route: 'whatsapp-pairing-gen',
    ip: user.id,
    maxHits: MAX_GENERATIONS,
    windowSeconds: WINDOW_SECONDS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Trop de codes générés. Réessayez dans quelques minutes.' },
      { status: 429 },
    );
  }

  const db = getServiceClient();

  // Un seul code vivant à la fois : les précédents non consommés sont marqués
  // consommés. Sans ça, un utilisateur qui régénère laisse derrière lui des
  // codes toujours valables jusqu'à leur expiration — autant de secrets
  // affichés puis oubliés qui restent utilisables.
  const { error: revokeError } = await db
    .from('whatsapp_pairing_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('consumed_at', null);

  if (revokeError) {
    console.error('whatsapp/pairing: invalidation des codes précédents impossible', revokeError.message);
    return NextResponse.json({ error: 'Génération impossible pour le moment.' }, { status: 500 });
  }

  const code = generatePairingCode();
  const expiresAt = pairingExpiresAt();

  const { error: insertError } = await db
    .from('whatsapp_pairing_codes')
    .insert({ code, user_id: user.id, expires_at: expiresAt });

  if (insertError) {
    console.error('whatsapp/pairing: insertion du code impossible', insertError.message);
    return NextResponse.json({ error: 'Génération impossible pour le moment.' }, { status: 500 });
  }

  return NextResponse.json({ code, expiresAt });
}
