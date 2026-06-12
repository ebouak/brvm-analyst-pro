import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';

export const runtime = 'edge';

interface BriefData {
  tendance: 'haussiere' | 'baissiere' | 'mitigee';
  breadth: { hausses: number; baisses: number; stables: number };
  indices: { code: string; valeur: number | null; variation_pct: number | null }[];
  top_hausses: { code: string; variation_pct: number }[];
  top_baisses: { code: string; variation_pct: number }[];
  valeur_transactions: number | null;
}

const TENDANCE_LABEL = {
  haussiere: 'Tendance haussière',
  baissiere: 'Tendance baissière',
  mitigee: 'Séance mitigée',
} as const;

function pct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')} %`;
}

/**
 * Image OG de la note de conjoncture (1200×630).
 * GET /api/og/brief?date=YYYY-MM-DD (défaut : dernière note)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  let d: BriefData | null = null;
  let dateLabel = '';
  try {
    const supabase = createPublicClient();
    let q = supabase.from('brief_daily').select('date_marche, data').order('date_marche', { ascending: false }).limit(1);
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      q = supabase.from('brief_daily').select('date_marche, data').eq('date_marche', date).limit(1);
    }
    const { data: rows } = await q;
    const row = rows?.[0];
    if (row?.data) {
      d = row.data as BriefData;
      dateLabel = new Date(row.date_marche + 'T00:00:00Z').toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      });
    }
  } catch {
    /* image générique en repli */
  }

  const accent = '#56d7fd';
  const up = '#3fe18b';
  const down = '#ff6b6b';
  const toneColor = d ? (d.tendance === 'haussiere' ? up : d.tendance === 'baissiere' ? down : accent) : accent;
  const total = d ? Math.max(1, d.breadth.hausses + d.breadth.baisses + d.breadth.stables) : 1;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', backgroundColor: '#030303', padding: 56, fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 26, color: accent, fontWeight: 700 }}>
              BRVM Analyst Pro · Note de conjoncture
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: '#8b93a7' }}>{dateLabel}</div>
          </div>
          {d && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 30 }}>
              <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, backgroundColor: toneColor }} />
              <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#fcfcfc' }}>
                {TENDANCE_LABEL[d.tendance]}
              </div>
              <div style={{ display: 'flex', fontSize: 26, color: '#8b93a7', marginLeft: 12 }}>
                {`${d.breadth.hausses} hausses · ${d.breadth.baisses} baisses`}
              </div>
            </div>
          )}
        </div>

        {d ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Jauge breadth */}
            <div style={{ display: 'flex', height: 22, borderRadius: 11, overflow: 'hidden', width: '100%' }}>
              <div style={{ display: 'flex', backgroundColor: up, width: `${(d.breadth.hausses / total) * 100}%` }} />
              <div style={{ display: 'flex', backgroundColor: '#112b33', width: `${(d.breadth.stables / total) * 100}%` }} />
              <div style={{ display: 'flex', backgroundColor: down, width: `${(d.breadth.baisses / total) * 100}%` }} />
            </div>

            {/* Movers */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.top_hausses.slice(0, 3).map((m) => (
                  <div key={m.code} style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: up }}>
                    {`▲ ${m.code}  ${pct(m.variation_pct)}`}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                {d.top_baisses.slice(0, 3).map((m) => (
                  <div key={m.code} style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: down }}>
                    {`▼ ${m.code}  ${pct(m.variation_pct)}`}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: 24, color: '#8b93a7' }}>
                {d.valeur_transactions != null
                  ? `Transactions : ${(d.valeur_transactions / 1e9).toFixed(2).replace('.', ',')} Md FCFA`
                  : 'Données officielles BRVM'}
              </div>
              <div style={{ display: 'flex', fontSize: 22, color: accent }}>brvm-analyst.pro/brief</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 48, fontWeight: 700, color: accent }}>
            La note du jour arrive après la clôture →
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
