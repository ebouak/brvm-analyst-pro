import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** Liste des actions négociables (dernier cours connu) pour le paper trading. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dernière séance disponible
    const { data: lastRow } = await supabase
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1)
      .single();
    if (!lastRow) return NextResponse.json({ actions: [] }, { status: 200 });

    const { data, error } = await supabase
      .from('brvm_actions_daily')
      .select('code, designation, cours_jour')
      .eq('date_marche', lastRow.date_marche)
      .not('cours_jour', 'is', null)
      .order('code');
    if (error) {
      return NextResponse.json({ error: 'Échec chargement' }, { status: 500 });
    }
    return NextResponse.json({ actions: data ?? [] }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Échec chargement' }, { status: 500 });
  }
}
