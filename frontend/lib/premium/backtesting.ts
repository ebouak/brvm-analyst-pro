import { createClient } from '@/lib/supabase/server';

export interface TopDividende {
  code: string;
  designation: string;
  secteur: string | null;
  total_divs: number;           // somme dividendes en FCFA
  nb_annees: number;
  div_moyen: number;            // dividende moyen par an
  dernier_div: number | null;
  signal: string | null;
}

export interface TopPlusValue {
  code: string;
  designation: string;
  secteur: string | null;
  cours_debut: number;
  cours_fin: number;
  performance_pct: number;
  performance_abs: number;
  nb_jours: number;
  signal: string | null;
}

export interface BacktestingData {
  topDividendesTotal: TopDividende[];       // classement par total dividendes versés
  topDividendesMoyen: TopDividende[];       // classement par dividende moyen annuel
  topPlusValues: TopPlusValue[];            // classement par performance absolue
  topPlusValuesPct: TopPlusValue[];         // classement par performance %
}

export async function getBacktestingData(): Promise<BacktestingData> {
  const supabase = createClient();

  // Dividendes historiques
  const { data: divs } = await supabase
    .from('dividends')
    .select('code, montant, exercice, brvm_instruments(designation, secteur)')
    .order('exercice', { ascending: true });

  // Cours historiques — premier et dernier cours par action
  const { data: cotations } = await supabase
    .from('brvm_actions_daily')
    .select('code, cours_jour, date_marche, designation, secteur')
    .order('date_marche', { ascending: true })
    .limit(50000);

  // Signaux
  const { data: signals } = await supabase
    .from('signals_daily')
    .select('code, signal')
    .order('date_marche', { ascending: false })
    .limit(200);

  const signalMap = new Map<string, string>();
  for (const s of signals ?? []) {
    if (!signalMap.has(s.code)) signalMap.set(s.code, s.signal);
  }

  // --- Dividendes ---
  const divByCode = new Map<string, { total: number; annees: Set<number>; montants: number[]; designation: string; secteur: string | null }>();
  for (const d of divs ?? []) {
    const instr = Array.isArray(d.brvm_instruments) ? d.brvm_instruments[0] : d.brvm_instruments;
    if (!divByCode.has(d.code)) {
      divByCode.set(d.code, { total: 0, annees: new Set(), montants: [], designation: instr?.designation ?? d.code, secteur: instr?.secteur ?? null });
    }
    const entry = divByCode.get(d.code)!;
    entry.total += Number(d.montant);
    entry.annees.add(d.exercice ?? 0);
    entry.montants.push(Number(d.montant));
  }

  const topDivs: TopDividende[] = [];
  for (const [code, entry] of divByCode) {
    const nb_annees = entry.annees.size;
    const div_moyen = nb_annees > 0 ? entry.total / nb_annees : 0;
    const dernier_div = entry.montants.length > 0 ? entry.montants[entry.montants.length - 1]! : null;
    topDivs.push({
      code, designation: entry.designation, secteur: entry.secteur,
      total_divs: +entry.total.toFixed(0), nb_annees, div_moyen: +div_moyen.toFixed(0),
      dernier_div, signal: signalMap.get(code) ?? null,
    });
  }

  const topDividendesTotal = [...topDivs].sort((a, b) => b.total_divs - a.total_divs);
  const topDividendesMoyen = [...topDivs].sort((a, b) => b.div_moyen - a.div_moyen);

  // --- Plus-values ---
  const courseByCode = new Map<string, { first: { cours: number; date: string }; last: { cours: number; date: string }; designation: string; secteur: string | null }>();
  for (const c of cotations ?? []) {
    if (!c.cours_jour) continue;
    if (!courseByCode.has(c.code)) {
      courseByCode.set(c.code, {
        first: { cours: c.cours_jour, date: c.date_marche },
        last: { cours: c.cours_jour, date: c.date_marche },
        designation: c.designation ?? c.code,
        secteur: c.secteur ?? null,
      });
    } else {
      courseByCode.get(c.code)!.last = { cours: c.cours_jour, date: c.date_marche };
    }
  }

  const topPV: TopPlusValue[] = [];
  for (const [code, entry] of courseByCode) {
    if (entry.first.cours <= 0) continue;
    const performance_pct = ((entry.last.cours - entry.first.cours) / entry.first.cours) * 100;
    const performance_abs = entry.last.cours - entry.first.cours;
    const nb_jours = Math.round((new Date(entry.last.date).getTime() - new Date(entry.first.date).getTime()) / 86400000);
    if (nb_jours < 30) continue; // ignorer les actions avec peu d'historique
    topPV.push({
      code, designation: entry.designation, secteur: entry.secteur,
      cours_debut: entry.first.cours, cours_fin: entry.last.cours,
      performance_pct: +performance_pct.toFixed(2),
      performance_abs: +performance_abs.toFixed(0),
      nb_jours, signal: signalMap.get(code) ?? null,
    });
  }

  const topPlusValues = [...topPV].sort((a, b) => b.performance_abs - a.performance_abs);
  const topPlusValuesPct = [...topPV].sort((a, b) => b.performance_pct - a.performance_pct);

  return { topDividendesTotal, topDividendesMoyen, topPlusValues, topPlusValuesPct };
}
