import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminEmail } from './admin-emails';

export { ADMIN_EMAILS, isAdminEmail } from './admin-emails';

/**
 * Garde pour route API : renvoie l'email admin, ou une NextResponse d'erreur
 * (401 non connecté, 403 non-admin) à retourner telle quelle.
 */
export async function requireAdmin(
  supabase: SupabaseClient,
): Promise<{ email: string } | { error: NextResponse }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }),
    };
  }
  if (!isAdminEmail(user.email)) {
    return {
      error: NextResponse.json(
        { error: "Accès réservé à l'administrateur" },
        { status: 403 },
      ),
    };
  }
  return { email: user.email! };
}
