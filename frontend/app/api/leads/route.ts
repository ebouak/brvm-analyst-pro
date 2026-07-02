import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { validateLead } from '@/lib/leads';
import { checkRateLimit, getClientIp } from '@/lib/server/rateLimit';

/**
 * POST /api/leads — soumission du formulaire de contact /debutant.
 * Insère via service_role (bypass RLS). Le consentement est obligatoire et
 * `consent_at` est horodaté CÔTÉ SERVEUR (jamais depuis le client). Aucune
 * lecture exposée ici : l'inbox admin lit via lib/admin/leads.ts.
 */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars manquantes');
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const { allowed } = await checkRateLimit({
      route: 'leads', ip: getClientIp(req), maxHits: 3, windowSeconds: 600,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, { status: 429 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const result = validateLead(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const lead = result.value;

    const supabase = getAdminClient();
    const { error } = await supabase.from('leads_brvm').insert({
      nom: lead.nom,
      email: lead.email,
      telephone: lead.telephone,
      pays: lead.pays,
      message: lead.message,
      niveau: lead.niveau,
      source: 'landing_debutant',
      statut: 'nouveau',
      consent: true,
      consent_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[leads] insert error', JSON.stringify(error));
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
}
