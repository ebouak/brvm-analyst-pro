import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { scoreToRating } from '@/lib/rating';

export const runtime = 'edge';

/**
 * OG image fiche société (1200×630) : nom, cours, variation, note BRVM.
 * GET /api/og/societe?code=SNTS
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get('code') ?? '').toUpperCase().slice(0, 8);

  let designation = code || 'BRVM';
  let secteur: string | null = null;
  let cours: number | null = null;
  let variation: number | null = null;
  let note = 'NR';

  try {
    const supabase = createPublicClient();
    const [{ data: instr }, { data: quote }, { data: sig }] = await Promise.all([
      supabase.from('brvm_instruments').select('designation, secteur').eq('code', code).maybeSingle(),
      supabase
        .from('brvm_actions_daily')
        .select('cours_jour, variation_pct')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(1),
      supabase
        .from('signals_daily')
        .select('score_total, confiance')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(1),
    ]);
    if (instr?.designation) {
      designation = instr.designation;
      secteur = (instr.secteur as string | null) ?? null;
    }
    cours = quote?.[0]?.cours_jour ?? null;
    variation = quote?.[0]?.variation_pct ?? null;
    const s = sig?.[0];
    note = scoreToRating(s?.score_total, s?.confiance).note;
  } catch {
    /* image générique */
  }

  const accent = '#56d7fd';
  const up = '#3fe18b';
  const down = '#ff6b6b';
  const positive = (variation ?? 0) >= 0;
  const noteColor = note.startsWith('A')
    ? up
    : note === 'D' || note === 'E'
      ? down
      : note === 'NR'
        ? '#8b93a7'
        : accent;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', backgroundColor: '#030303', padding: 60, fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, color: accent, fontWeight: 700 }}>
              WESTBOURSE
            </div>
            <div style={{ display: 'flex', fontSize: 52, color: '#fcfcfc', fontWeight: 800, marginTop: 20, maxWidth: 800 }}>
              {designation}
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: '#8b93a7', marginTop: 8 }}>
              {`${code}${secteur ? ' · ' + secteur : ''} · Bourse Régionale des Valeurs Mobilières`}
            </div>
          </div>
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 130, height: 130, borderRadius: 24,
              border: `4px solid ${noteColor}`, color: noteColor,
              fontSize: 56, fontWeight: 800,
            }}
          >
            {note}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 22, color: '#8b93a7' }}>Dernier cours</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#fcfcfc' }}>
                {cours != null ? `${cours.toLocaleString('fr-FR')} FCFA` : '—'}
              </div>
              {variation != null && (
                <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: positive ? up : down }}>
                  {`${positive ? '+' : ''}${variation.toFixed(2).replace('.', ',')} %`}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: accent }}>
            Fiche complète gratuite →
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
