import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import BudgetSimulator from '@/components/public/BudgetSimulator';
import { computeYield } from '@/lib/dividends';
import { fmtDateFR } from '@/lib/format';
import type { SimAction } from '@/lib/budgetSimulator';

export const revalidate = 900;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: "Simulateur de budget BRVM — que faire de votre argent ?",
  description:
    "Entrez votre budget et vos frais SGI : obtenez trois portefeuilles BRVM optimisés (dividende, croissance, équilibré) avec le détail action par action, dividendes nets d'IRVM et retour total estimé. Cours réels, gratuit.",
  keywords: [
    'simulateur BRVM',
    'investir BRVM budget',
    'portefeuille BRVM',
    'dividende BRVM',
    'frais SGI',
    'que faire de mon argent UEMOA',
  ],
  alternates: { canonical: `${SITE_URL}/simulateur-budget` },
  openGraph: {
    type: 'website',
    title: 'Simulateur de budget BRVM — trois portefeuilles optimisés',
    description:
      "Votre budget, vos frais SGI : trois portefeuilles BRVM (dividende, croissance, équilibré) avec le détail par action et les dividendes projetés.",
    url: `${SITE_URL}/simulateur-budget`,
  },
};

/**
 * Construit l'univers d'actions réel : cours du jour, rendement dividende
 * (dernier exercice / cours) et performance 12 mois (close récent vs close
 * d'il y a ~1 an). Toute métrique manquante reste `null` — jamais inventée.
 */
async function getUnivers(): Promise<{ univers: SimAction[]; asOf: string | null }> {
  const supabase = createPublicClient();

  // Dernière séance disponible.
  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = (lastRow?.[0]?.date_marche as string | undefined) ?? null;
  if (!lastDate) return { univers: [], asOf: null };

  // Date cible ~1 an avant, et fenêtre ±12 jours autour pour trouver une séance.
  const target = new Date(lastDate);
  target.setFullYear(target.getFullYear() - 1);
  const winFrom = new Date(target);
  winFrom.setDate(winFrom.getDate() - 12);
  const winTo = new Date(target);
  winTo.setDate(winTo.getDate() + 12);
  const iso = (d: Date) => d.toISOString().split('T')[0]!;

  const [{ data: instruments }, { data: lastQuotes }, { data: yearAgoQuotes }, { data: divData }] =
    await Promise.all([
      supabase
        .from('brvm_instruments')
        .select('code, designation, secteur')
        .eq('type', 'action')
        .eq('actif', true)
        .order('code'),
      supabase
        .from('brvm_actions_daily')
        .select('code, cours_jour')
        .eq('date_marche', lastDate),
      supabase
        .from('brvm_actions_daily')
        .select('code, cours_jour, date_marche')
        .gte('date_marche', iso(winFrom))
        .lte('date_marche', iso(winTo))
        .order('date_marche', { ascending: true }),
      supabase
        .from('dividends')
        .select('code, exercice, montant')
        .order('exercice', { ascending: false })
        .limit(500),
    ]);

  // Cours du jour par code.
  const coursByCode = new Map<string, number>();
  for (const q of lastQuotes ?? []) {
    if (q.cours_jour != null && q.cours_jour > 0) coursByCode.set(q.code as string, q.cours_jour as number);
  }

  // Cours d'il y a ~1 an : on garde, par code, la séance la plus proche de la cible.
  const targetTime = target.getTime();
  const yearAgoByCode = new Map<string, { close: number; dist: number }>();
  for (const q of yearAgoQuotes ?? []) {
    if (q.cours_jour == null || q.cours_jour <= 0) continue;
    const dist = Math.abs(new Date(q.date_marche as string).getTime() - targetTime);
    const prev = yearAgoByCode.get(q.code as string);
    if (!prev || dist < prev.dist) yearAgoByCode.set(q.code as string, { close: q.cours_jour as number, dist });
  }

  // Dividende du dernier exercice par code (somme des montants de l'exercice le plus récent).
  const divByCode = new Map<string, { exercice: number; total: number }>();
  for (const d of divData ?? []) {
    if (d.exercice == null || d.montant == null) continue;
    const code = d.code as string;
    const ex = d.exercice as number;
    const cur = divByCode.get(code);
    if (!cur || ex > cur.exercice) divByCode.set(code, { exercice: ex, total: d.montant as number });
    else if (ex === cur.exercice) cur.total += d.montant as number;
  }

  const univers: SimAction[] = [];
  for (const i of instruments ?? []) {
    const code = i.code as string;
    const prix = coursByCode.get(code);
    if (prix == null) continue; // pas de cours → action non simulable, écartée

    const div = divByCode.get(code);
    const rendement = div ? computeYield(div.total, prix) : null;

    const yearAgo = yearAgoByCode.get(code);
    const perf12 = yearAgo ? ((prix - yearAgo.close) / yearAgo.close) * 100 : null;

    univers.push({
      code,
      designation: (i.designation as string) ?? code,
      secteur: (i.secteur as string | null) ?? null,
      prix,
      rendement,
      perf12,
    });
  }

  return { univers, asOf: fmtDateFR(lastDate) };
}

export default async function SimulateurBudgetPage() {
  const { univers, asOf } = await getUnivers();

  return (
    <PublicShell>
      <BudgetSimulator univers={univers} asOf={asOf} className="scroll-mt-24" />
    </PublicShell>
  );
}
