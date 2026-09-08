// frontend/app/api/telegram/pairing/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { generatePairingCode, pairingExpiresAt } from '@/lib/pairingCodes';

export const dynamic = 'force-dynamic';

/**
 * Limitation de la GÉNÉRATION de codes. À ne pas confondre avec le rate-limit
 * de `redeemPairing` (route `telegram-pairing`), qui borne les tentatives de
 * consommation depuis une conversation Telegram. Ici on borne un utilisateur
 * authentifié qui cliquerait en boucle sur « Lier mon Telegram ».
 *
 * Clé : l'UUID du compte, et non l'IP — stable derrière un NAT ou un
 * changement de réseau, et ce n'est pas une donnée personnelle à protéger
 * comme l'est un identifiant de conversation (c'est un identifiant interne,
 * déjà présent dans `telegram_pairing_codes.user_id`).
 */
const MAX_GENERATIONS = 10;
const WINDOW_SECONDS = 10 * 60;

/**
 * Génère un code d'appairage à usage unique pour l'utilisateur connecté.
 *
 * La génération vit côté serveur parce que `pairingCodes.ts` s'appuie sur
 * `node:crypto` (aléa cryptographique) et parce que la table n'accepte aucune
 * écriture `authenticated` : seul le service-role insère (migration 0129).
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
    route: 'telegram-pairing-gen',
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
    .from('telegram_pairing_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('consumed_at', null);

  if (revokeError) {
    console.error(
      'telegram/pairing: invalidation des codes précédents impossible',
      revokeError.message,
    );
    return NextResponse.json({ error: 'Génération impossible pour le moment.' }, { status: 500 });
  }

  const code = generatePairingCode();
  const expiresAt = pairingExpiresAt();

  const { error: insertError } = await db
    .from('telegram_pairing_codes')
    .insert({ code, user_id: user.id, expires_at: expiresAt });

  if (insertError) {
    console.error('telegram/pairing: insertion du code impossible', insertError.message);
    return NextResponse.json({ error: 'Génération impossible pour le moment.' }, { status: 500 });
  }

  return NextResponse.json({ code, expiresAt });
}
