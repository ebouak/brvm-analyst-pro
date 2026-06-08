import { createClient } from '@/lib/supabase/server';

export interface ActionProcheBas {
  code: string;
  designation: string;
  secteur: string | null;
  cours_actuel: number;
  cours_bas_52s: number;
  distance_pct: number;   // % au-dessus du plus bas (0 = au plus bas)
  cours_haut_52s: number;
  signal: string | null;
}

export interface MoisSaisonnalite {
  mois: number;           // 1-12
  nom_mois: string;
  nb_hausses: number;
  nb_baisses: number;
  perf_moyenne: number;   // en %
  taux_hausse: number;    // en %
}

export interface ReactionEtatFinancier {
  code: string;
  designation: string;
  date_publication: string;
  perf_j1: number;   // J+1 vs veille
  perf_j5: number;   // J+5 vs veille
  type_event: string;
}

export interface OutilsData {
  actionsProchesBas: ActionProcheBas[];
  saisonnalite: MoisSaisonnalite[];
  reactionsEtats: ReactionEtatFinancier[];
}

const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export async function getOutilsData(): Promise<OutilsData> {
  const supabase = createClient();

  // ── 1. Actions proches de leurs plus bas 52 semaines ──
  const [actionsRes, dailyRes] = await Promise.all([
    supabase
      .from('brvm_instruments')
      .select('code, designation, secteur')
      .eq('type', 'action'),
    supabase
      .from('brvm_actions_daily')
      .select('code, cours_cloture, date_marche')
      .gte('date_marche', new Date(Date.now() - 365 * 86400 * 1000).toISOString().split('T')[0])
      .order('date_marche', { ascending: false }),
  ]);

  const instruments = actionsRes.data ?? [];
  const rows = dailyRes.data ?? [];

  // Group by code, compute 52w high/low + last price
  const byCode = new Map<string, number[]>();
  for (const r of rows) {
    const c = r.cours_cloture as number;
    if (!c) continue;
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push(c);
  }

  // Signals
  const signalRes = await supabase
    .from('signals_daily')
    .select('code, signal')
    .in('code', [...byCode.keys()])
    .order('date_calcul', { ascending: false });
  const signalMap = new Map<string, string>();
  for (const s of signalRes.data ?? []) {
    if (!signalMap.has(s.code)) signalMap.set(s.code, s.signal);
  }

  const infoMap = new Map(instruments.map((i) => [i.code, i]));
  const actionsProchesBas: ActionProcheBas[] = [];

  for (const [code, prix] of byCode) {
    if (prix.length < 20) continue;
    const cours_actuel = prix[0]!;
    const cours_bas_52s = Math.min(...prix);
    const cours_haut_52s = Math.max(...prix);
    const distance_pct = cours_bas_52s > 0 ? ((cours_actuel - cours_bas_52s) / cours_bas_52s) * 100 : 0;
    const info = infoMap.get(code);
    actionsProchesBas.push({
      code,
      designation: info?.designation ?? code,
      secteur: info?.secteur ?? null,
      cours_actuel,
      cours_bas_52s,
      cours_haut_52s,
      distance_pct,
      signal: signalMap.get(code) ?? null,
    });
  }
  actionsProchesBas.sort((a, b) => a.distance_pct - b.distance_pct);

  // ── 2. Saisonnalité ──
  const histRes = await supabase
    .from('brvm_actions_daily')
    .select('code, cours_cloture, date_marche')
    .gte('date_marche', new Date(Date.now() - 5 * 365 * 86400 * 1000).toISOString().split('T')[0])
    .order('date_marche', { ascending: true });

  // Compute monthly average variation per stock, then aggregate
  const moisStats: Record<number, { hausses: number; baisses: number; somme: number; count: number }> = {};
  for (let m = 1; m <= 12; m++) moisStats[m] = { hausses: 0, baisses: 0, somme: 0, count: 0 };

  const byCodeChron = new Map<string, { date: string; cours: number }[]>();
  for (const r of histRes.data ?? []) {
    if (!byCodeChron.has(r.code)) byCodeChron.set(r.code, []);
    byCodeChron.get(r.code)!.push({ date: r.date_marche, cours: r.cours_cloture as number });
  }

  for (const series of byCodeChron.values()) {
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1]!;
      const curr = series[i]!;
      if (!prev.cours || !curr.cours) continue;
      const mois = new Date(curr.date).getMonth() + 1;
      const var_pct = ((curr.cours - prev.cours) / prev.cours) * 100;
      moisStats[mois]!.somme += var_pct;
      moisStats[mois]!.count++;
      if (var_pct > 0) moisStats[mois]!.hausses++;
      else if (var_pct < 0) moisStats[mois]!.baisses++;
    }
  }

  const saisonnalite: MoisSaisonnalite[] = Object.entries(moisStats).map(([m, s]) => {
    const total = s.hausses + s.baisses;
    return {
      mois: parseInt(m),
      nom_mois: MOIS_FR[parseInt(m) - 1]!,
      nb_hausses: s.hausses,
      nb_baisses: s.baisses,
      perf_moyenne: s.count > 0 ? s.somme / s.count : 0,
      taux_hausse: total > 0 ? (s.hausses / total) * 100 : 50,
    };
  });

  // ── 3. Réaction aux états financiers ──
  const eventsRes = await supabase
    .from('market_events')
    .select('instrument_code, event_date, event_type, brvm_instruments(designation)')
    .in('event_type', ['publication', 'resultats', 'rapport_annuel'])
    .order('event_date', { ascending: false })
    .limit(50);

  const reactionsEtats: ReactionEtatFinancier[] = [];

  for (const ev of eventsRes.data ?? []) {
    const code = ev.instrument_code as string;
    const dateEv = ev.event_date as string;
    if (!code || !dateEv) continue;

    const [before, after] = await Promise.all([
      supabase
        .from('brvm_actions_daily')
        .select('cours_cloture')
        .eq('code', code)
        .lt('date_marche', dateEv)
        .order('date_marche', { ascending: false })
        .limit(1),
      supabase
        .from('brvm_actions_daily')
        .select('cours_cloture, date_marche')
        .eq('code', code)
        .gte('date_marche', dateEv)
        .order('date_marche', { ascending: true })
        .limit(6),
    ]);

    const veille = before.data?.[0]?.cours_cloture as number | undefined;
    const afterRows = after.data ?? [];
    if (!veille || afterRows.length < 2) continue;

    const j1 = afterRows[1]?.cours_cloture as number | undefined;
    const j5 = afterRows[Math.min(5, afterRows.length - 1)]?.cours_cloture as number | undefined;
    const info = Array.isArray(ev.brvm_instruments) ? ev.brvm_instruments[0] : ev.brvm_instruments;

    reactionsEtats.push({
      code,
      designation: (info as { designation: string } | null)?.designation ?? code,
      date_publication: dateEv,
      perf_j1: j1 ? ((j1 - veille) / veille) * 100 : 0,
      perf_j5: j5 ? ((j5 - veille) / veille) * 100 : 0,
      type_event: ev.event_type as string,
    });
  }

  return { actionsProchesBas: actionsProchesBas.slice(0, 20), saisonnalite, reactionsEtats };
}
