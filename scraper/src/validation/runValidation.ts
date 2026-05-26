import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';

const TOP_CODES = ['SNTS', 'ETIT', 'BOAB', 'SGBC', 'PALC', 'BICC', 'SIVC', 'ONTBF', 'TTLC', 'NSBC'];

interface CodeReport {
  code: string;
  totalRows: number;
  rows24M: number;
  nullCours: number;
  suspiciousVariations: number;
  oldestDate: string | null;
  gaps: string[]; // description of gaps found
  ok: boolean;
}

export async function runValidation(): Promise<void> {
  const sb = getSupabase();
  const from24M = new Date();
  from24M.setMonth(from24M.getMonth() - 24);
  const from24MStr = from24M.toISOString().slice(0, 10);

  logger.info({ from24M: from24MStr }, 'Démarrage validation qualité données historiques');

  const reports: CodeReport[] = [];

  for (const code of TOP_CODES) {
    const { data, error } = await sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour, variation_pct')
      .eq('code', code)
      .order('date_marche', { ascending: true });

    if (error) {
      logger.error({ code, error }, 'Erreur lecture Supabase');
      continue;
    }

    const rows = (data ?? []) as { date_marche: string; cours_jour: number | null; variation_pct: number | null }[];

    const rows24M = rows.filter(r => r.date_marche >= from24MStr);
    const nullCours = rows.filter(r => r.cours_jour === null).length;
    const suspicious = rows.filter(r => r.variation_pct != null && Math.abs(r.variation_pct) > 50).length;
    const oldestDate = rows[0]?.date_marche ?? null;

    // Find gaps: >10 calendar days between consecutive dates (accounts for weekends + holidays)
    const gaps: string[] = [];
    for (let i = 1; i < rows24M.length; i++) {
      const prev = new Date(rows24M[i - 1]!.date_marche);
      const curr = new Date(rows24M[i]!.date_marche);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 10) {
        gaps.push(`${rows24M[i - 1]!.date_marche} → ${rows24M[i]!.date_marche} (${Math.round(diffDays)}j)`);
      }
    }

    const ok = rows24M.length >= 300 && nullCours === 0 && gaps.length === 0;

    reports.push({
      code,
      totalRows: rows.length,
      rows24M: rows24M.length,
      nullCours,
      suspiciousVariations: suspicious,
      oldestDate,
      gaps,
      ok,
    });
  }

  // Print report
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RAPPORT DE VALIDATION — Historique BRVM');
  console.log('═══════════════════════════════════════════════════════\n');

  for (const r of reports) {
    const status = r.ok ? '✅' : '⚠️ ';
    console.log(`${status} ${r.code}`);
    console.log(`   Total séances : ${r.totalRows} | 24 mois : ${r.rows24M} | Plus ancien : ${r.oldestDate ?? '—'}`);
    if (r.nullCours > 0) console.log(`   ⚠️  Cours null : ${r.nullCours}`);
    if (r.suspiciousVariations > 0) console.log(`   ⚠️  Variations >±50% : ${r.suspiciousVariations}`);
    if (r.gaps.length > 0) console.log(`   ⚠️  Trous : ${r.gaps.join(' | ')}`);
    console.log();
  }

  const passed = reports.filter(r => r.ok).length;
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  Résultat : ${passed}/${reports.length} codes valides`);
  console.log(`═══════════════════════════════════════════════════════\n`);
}
