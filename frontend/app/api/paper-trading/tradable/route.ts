import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { toutesLesPages } from '@/lib/dashboard/pagination';

/** Liste des actions négociables (dernier cours connu) pour le paper trading. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dernière séance disponible
    const { data: lastRow, error: lastError } = await supabase
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) {
      console.error('Paper trading latest session error:', lastError);
      return NextResponse.json({ error: 'Échec chargement' }, { status: 500 });
    }
    if (!lastRow) return NextResponse.json({ sessionDate: null, actions: [] }, { status: 200 });

    const actions = await toutesLesPages<{ code: string; designation: string | null; cours_jour: number | null }>(
      (from, to) =>
        supabase
          .from('brvm_actions_daily')
          .select('code, designation, cours_jour')
          .eq('date_marche', lastRow.date_marche)
          .not('cours_jour', 'is', null)
          .order('code')
          .range(from, to),
    );
    const codes = actions.map((action) => action.code);

    const books = codes.length
      ? await toutesLesPages<{
          code: string;
          date_marche: string;
          qte_achat: number | null;
          cours_achat: number | null;
          qte_vente: number | null;
          cours_vente: number | null;
          achat_au_marche: boolean;
          vente_au_marche: boolean;
          collecte_at: string;
        }>((from, to) =>
          supabase
            .from('brvm_carnet_daily')
            .select('code, date_marche, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche, collecte_at')
            .in('code', codes)
            .lte('date_marche', lastRow.date_marche)
            .lte('collecte_at', new Date().toISOString())
            .order('code')
            .order('date_marche', { ascending: false })
            .range(from, to),
        )
      : [];

    const latestBookByCode = new Map<string, (typeof books)[number]>();
    for (const book of books) {
      if (!latestBookByCode.has(book.code)) latestBookByCode.set(book.code, book);
    }

    return NextResponse.json(
      {
        sessionDate: lastRow.date_marche,
        actions: actions.map((action) => ({
          code: action.code,
          designation: action.designation,
          cours_jour: action.cours_jour,
          book: (() => {
            const book = latestBookByCode.get(action.code);
            return book
              ? {
                  date: book.date_marche,
                  collectedAt: book.collecte_at,
                  buyQuantity: book.qte_achat,
                  buyPrice: book.cours_achat,
                  sellQuantity: book.qte_vente,
                  sellPrice: book.cours_vente,
                  buyAtMarket: book.achat_au_marche,
                  sellAtMarket: book.vente_au_marche,
                }
              : null;
          })(),
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Paper trading tradable error:', error);
    return NextResponse.json({ error: 'Échec chargement' }, { status: 500 });
  }
}
