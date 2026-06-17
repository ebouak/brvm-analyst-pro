import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { simulateInvestment, type PricePoint } from '@/lib/simulate';

export const runtime = 'edge';

/**
 * OG image dynamique du simulateur (1200×630) — aperçu riche WhatsApp/X.
 * GET /api/og/simulateur?code=SNTS&montant=1000000&annees=5
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') ?? 'BRVM').toUpperCase().slice(0, 8);
  const montant = Math.max(0, parseInt(searchParams.get('montant') ?? '1000000', 10) || 1_000_000);
  const annees = Math.min(15, Math.max(1, parseInt(searchParams.get('annees') ?? '5', 10) || 5));

  let designation = code;
  let resultText: string | null = null;
  let pctText: string | null = null;
  let positive = true;

  try {
    const supabase = createPublicClient();
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - annees);
    const fromIso = fromDate.toISOString().split('T')[0]!;

    const [{ data: instr }, { data: rows }, { data: divs }] = await Promise.all([
      supabase.from('brvm_instruments').select('designation').eq('code', code).maybeSingle(),
      supabase
        .from('brvm_actions_daily')
        .select('date_marche, cours_jour')
        .eq('code', code)
        .gte('date_marche', fromIso)
        .order('date_marche', { ascending: true }),
      supabase.from('dividends').select('montant, payment_date, ex_date').eq('code', code),
    ]);

    if (instr?.designation) designation = instr.designation;

    const prices: PricePoint[] = (rows ?? [])
      .filter((r) => r.cours_jour != null && r.cours_jour > 0)
      .map((r) => ({ date: r.date_marche as string, close: r.cours_jour as number }));
    const dividends = (divs ?? [])
      .map((d) => ({ date: (d.payment_date ?? d.ex_date ?? '') as string, montant: d.montant as number }))
      .filter((d) => d.date);

    const sim = simulateInvestment(montant, fromIso, prices, dividends);
    if (sim) {
      positive = sim.gain >= 0;
      resultText = `${Math.round(sim.finalValue).toLocaleString('fr-FR')} FCFA`;
      pctText = `${positive ? '+' : ''}${sim.totalReturnPct.toFixed(1).replace('.', ',')} %`;
    }
  } catch {
    // Base inaccessible : on rend une image générique.
  }

  const fmtMontant = montant.toLocaleString('fr-FR');
  const accent = '#56d7fd';
  const upColor = '#3fe18b';
  const downColor = '#ff6b6b';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#030303',
          padding: 64,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 28, color: accent, fontWeight: 700 }}>
            WESTBOURSE · Simulateur
          </div>
          <div style={{ display: 'flex', fontSize: 40, color: '#fcfcfc', marginTop: 28, lineHeight: 1.3 }}>
            {`Si vous aviez investi ${fmtMontant} FCFA dans ${designation} il y a ${annees} an${annees > 1 ? 's' : ''}…`}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {resultText ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
              <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, color: '#fcfcfc' }}>
                {resultText}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 48,
                  fontWeight: 700,
                  color: positive ? upColor : downColor,
                }}
              >
                {pctText}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, color: accent }}>
              Calculez votre résultat →
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 24, color: '#8b93a7', marginTop: 20 }}>
            Dividendes inclus · Données BRVM officielles · brvm-analyst.pro
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
