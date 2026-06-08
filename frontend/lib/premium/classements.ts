import { createClient } from '@/lib/supabase/server';

export type CritereClassement =
  | 'performance' | 'liquidite' | 'volatilite' | 'valeur_echangee'
  | 'marge_nette' | 'taux_rotation' | 'reserve' | 'per' | 'pbr';

export interface LigneClassement {
  code: string;
  designation: string;
  secteur: string | null;
  signal: string | null;
  valeur: number | null;
  valeur_label: string;
  unite: string;
}

export async function getClassement(critere: CritereClassement): Promise<LigneClassement[]> {
  const supabase = createClient();

  if (['performance', 'liquidite', 'volatilite', 'valeur_echangee'].includes(critere)) {
    const { data: actions } = await supabase
      .from('brvm_actions_daily')
      .select('code, designation, secteur, cours_jour, variation_pct, volume, valeur_echangee, date_marche')
      .order('date_marche', { ascending: false })
      .limit(2000);

    if (!actions) return [];

    const byCode = new Map<string, typeof actions>();
    for (const row of actions) {
      if (!byCode.has(row.code)) byCode.set(row.code, []);
      if (byCode.get(row.code)!.length < 20) byCode.get(row.code)!.push(row);
    }

    const { data: signals } = await supabase
      .from('signals_daily')
      .select('code, signal, date_marche')
      .order('date_marche', { ascending: false })
      .limit(200);
    const signalMap = new Map<string, string>();
    for (const s of signals ?? []) {
      if (!signalMap.has(s.code)) signalMap.set(s.code, s.signal);
    }

    const result: LigneClassement[] = [];
    for (const [code, rows] of byCode) {
      if (rows.length < 2) continue;
      const latest = rows[0]!;
      const designation = latest.designation ?? code;
      const secteur = latest.secteur;
      const signal = signalMap.get(code) ?? null;

      let valeur: number | null = null;
      let valeur_label = '—';
      let unite = '';

      if (critere === 'performance') {
        const oldest = rows[rows.length - 1]!;
        if (oldest.cours_jour && latest.cours_jour) {
          valeur = ((latest.cours_jour - oldest.cours_jour) / oldest.cours_jour) * 100;
          valeur_label = `${valeur >= 0 ? '+' : ''}${valeur.toFixed(2)}%`;
          unite = '%';
        }
      } else if (critere === 'liquidite') {
        const avg = rows.reduce((s, r) => s + (r.valeur_echangee ?? 0), 0) / rows.length;
        valeur = avg;
        valeur_label = avg > 1e6 ? `${(avg / 1e6).toFixed(1)} M` : `${avg.toFixed(0)}`;
        unite = 'FCFA moy/j';
      } else if (critere === 'volatilite') {
        const variations = rows.map((r) => r.variation_pct ?? 0);
        const mean = variations.reduce((s, v) => s + v, 0) / variations.length;
        const variance = variations.reduce((s, v) => s + (v - mean) ** 2, 0) / variations.length;
        valeur = Math.sqrt(variance);
        valeur_label = `${valeur.toFixed(2)}%`;
        unite = '% σ';
      } else if (critere === 'valeur_echangee') {
        valeur = rows.reduce((s, r) => s + (r.valeur_echangee ?? 0), 0);
        valeur_label = valeur > 1e9 ? `${(valeur / 1e9).toFixed(2)} Md` : `${(valeur / 1e6).toFixed(1)} M`;
        unite = 'FCFA total';
      }

      result.push({ code, designation, secteur, signal, valeur, valeur_label, unite });
    }

    result.sort((a, b) => {
      if (critere === 'volatilite') return (a.valeur ?? 0) - (b.valeur ?? -Infinity);
      return (b.valeur ?? -Infinity) - (a.valeur ?? -Infinity);
    });
    return result;
  }

  // Critères fondamentaux
  const { data: fonds } = await supabase
    .from('fundamentals')
    .select('code, year, revenue, net_income, equity')
    .order('year', { ascending: false });

  const fondMap = new Map<string, { revenue: number | null; net_income: number | null; equity: number | null }>();
  for (const f of fonds ?? []) {
    if (!fondMap.has(f.code)) {
      fondMap.set(f.code, { revenue: f.revenue, net_income: f.net_income, equity: f.equity });
    }
  }

  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .eq('type', 'action');

  const { data: signals } = await supabase
    .from('signals_daily')
    .select('code, signal')
    .order('date_marche', { ascending: false })
    .limit(200);
  const signalMap = new Map<string, string>();
  for (const s of signals ?? []) {
    if (!signalMap.has(s.code)) signalMap.set(s.code, s.signal);
  }

  const result: LigneClassement[] = [];
  for (const inst of instruments ?? []) {
    const f = fondMap.get(inst.code);
    if (!f) {
      result.push({ code: inst.code, designation: inst.designation, secteur: inst.secteur, signal: signalMap.get(inst.code) ?? null, valeur: null, valeur_label: '—', unite: '' });
      continue;
    }
    let valeur: number | null = null;
    let valeur_label = '—';
    let unite = '';

    if (critere === 'marge_nette' && f.revenue && f.net_income) {
      valeur = (f.net_income / f.revenue) * 100;
      valeur_label = `${valeur.toFixed(1)}%`;
      unite = '%';
    } else if (critere === 'taux_rotation' && f.revenue && f.equity) {
      valeur = f.revenue / f.equity;
      valeur_label = `${valeur.toFixed(2)}x`;
      unite = 'x';
    } else if (critere === 'reserve' && f.equity) {
      valeur = f.equity / 1e9;
      valeur_label = `${valeur.toFixed(2)} Md`;
      unite = 'FCFA';
    } else if (critere === 'per' || critere === 'pbr') {
      valeur_label = 'N/D';
    }

    result.push({ code: inst.code, designation: inst.designation, secteur: inst.secteur, signal: signalMap.get(inst.code) ?? null, valeur, valeur_label, unite });
  }

  result.sort((a, b) => (b.valeur ?? -Infinity) - (a.valeur ?? -Infinity));
  return result;
}
