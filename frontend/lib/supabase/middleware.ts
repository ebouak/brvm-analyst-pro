import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

const SUPER_ADMIN_EMAIL = 'ebouak@gmail.com';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Gating /premium/* : vérifie is_premium sauf super admin
  if (request.nextUrl.pathname.startsWith('/premium') &&
      !request.nextUrl.pathname.startsWith('/premium/upgrade')) {

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Super admin bypass
    if (user.email !== SUPER_ADMIN_EMAIL) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single();

      if (!profile?.is_premium) {
        const url = request.nextUrl.clone();
        url.pathname = '/premium/upgrade';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
