import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import BudgetSimulator from '@/components/public/BudgetSimulator';
import { fmtDateFR, fmtNumber } from '@/lib/format';
import { STRATEGIES } from '@/lib/budgetSimulator';
import { chargerUniversActions } from '@/lib/universActions';
import { BarChart3, CalendarDays, Coins, Layers, Wallet } from 'lucide-react';
import { EnteteComparateur } from '@/components/comparateur-sgi/cadre/Cadre';

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

export default async function SimulateurBudgetPage() {
  const { univers, dateSeance } = await chargerUniversActions(createPublicClient());
  const asOf = dateSeance ? fmtDateFR(dateSeance) : null;
  const avecDividende = univers.filter((a) => a.rendement != null).length;

  // Repères tirés de l'univers chargé : rien n'est affiché sans donnée.
  const reperes =
    univers.length > 0
      ? [
          { icone: BarChart3, valeur: `${univers.length} actions`, libelle: 'simulables aux cours du jour' },
          { icone: Coins, valeur: `${avecDividende} actions`, libelle: 'au dividende connu' },
          { icone: Layers, valeur: `${STRATEGIES.length} portefeuilles`, libelle: 'revenu, croissance, équilibre' },
          ...(asOf ? [{ icone: CalendarDays, valeur: asOf, libelle: 'dernière séance' }] : []),
        ]
      : undefined;

  return (
    <PublicShell pleineLargeur>
      <EnteteComparateur
        titre="Que faire de votre budget ?"
        sousTitre="Indiquez votre montant et vos frais de courtage : le moteur compose trois portefeuilles, action par action, frais déduits et dividendes projetés à partir des cours réels de la BRVM."
        icone={Wallet}
        surtitre="Simulateur · BRVM / UEMOA"
        reperes={reperes}
        variante="epargne"
        bande={{
          titre: `Cours de la séance du ${asOf ?? 'dernier jour connu'} et variation sur 12 mois`,
          elements: univers.map((a) => ({
            libelle: a.code,
            valeur: `${fmtNumber(a.prix)} FCFA`,
            // Sans cours d'il y a un an, aucune variation n'est affichée.
            ...(a.perf12 != null
              ? {
                  detail: `${a.perf12 >= 0 ? '+' : '−'}${fmtNumber(Math.abs(a.perf12), 1)} % sur 12 mois`,
                  ton: a.perf12 >= 0 ? ('up' as const) : ('down' as const),
                }
              : {}),
          })),
        }}
      />
      <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-10">
        <BudgetSimulator univers={univers} asOf={asOf} className="scroll-mt-24" />
      </div>
    </PublicShell>
  );
}
