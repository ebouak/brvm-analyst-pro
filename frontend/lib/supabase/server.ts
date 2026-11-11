// Client Supabase côté serveur (Server Components / Route Handlers).
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Depuis Next 15, `cookies()` est asynchrone. Plutôt que de forcer un accès
 * synchrone (toléré en 15 avec avertissement, refusé en 16), on attend le
 * magasin DANS getAll/setAll, que @supabase/ssr accepte asynchrones :
 * createClient() reste synchrone et aucun appelant ne change.
 */
export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookies()).getAll();
        },
        async setAll(cookiesToSet: CookieToSet[]) {
          try {
            const cookieStore = await cookies();
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : ignoré (le middleware rafraîchit).
          }
        },
      },
    },
  );
}
