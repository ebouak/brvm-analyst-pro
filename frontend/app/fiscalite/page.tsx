import type { Metadata } from 'next';
import Link from 'next/link';
import { BAREME, PAYS_LABELS, type PaysUemoa, type TypeRevenu } from '@/lib/tax/rates';
import TaxCalculator from '@/components/tax/TaxCalculator';
import { SectionHeader } from '@/components/ui/premium';

export const metadata: Metadata = {
  title: 'Fiscalité des dividendes et obligations BRVM (IRVM/IRC) — WESTBOURSE',
  description:
    "Calculez votre dividende net d'IRVM et vos coupons obligataires nets par pays UEMOA (Côte d'Ivoire, Sénégal, Bénin…). Barème sourcé, comparatif des 8 pays.",
};

const COLS: { key: TypeRevenu; label: string }[] = [
  { key: 'dividende_cote', label: 'Dividendes (cotés)' },
  { key: 'obligation_etat', label: "Oblig. d'État" },
  { key: 'obligation_privee', label: 'Oblig. privées' },
];

function fmtTaux(t: number | null): string {
  if (t == null) return 'non confirmé';
  const pct = t * 100;
  return `${pct % 1 ? pct.toFixed(1) : pct.toFixed(0)} %`;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "Qui prélève l'impôt sur mes dividendes BRVM ?",
    a: "L'IRVM est retenu à la source par l'émetteur (via sa banque centralisatrice) avant versement à votre SGI : vous recevez directement le montant net. Aucune démarche déclarative n'est en général nécessaire pour un résident UEMOA.",
  },
  {
    q: 'Le taux dépend-il de mon pays de résidence ou de celui de la société ?',
    a: "Du pays de l'émetteur, où la retenue est opérée. Votre résidence fiscale peut ensuite jouer (conventions de non double imposition) — consultez un fiscaliste pour votre situation.",
  },
  {
    q: "Pourquoi les obligations d'État affichent-elles 0 % ?",
    a: "Les emprunts émis par les États de l'UEMOA et les institutions régionales (BOAD, BIDC) sont exonérés de retenue sur les coupons — c'est l'un des attraits du marché obligataire régional.",
  },
  {
    q: 'Les plus-values de cession sont-elles imposées ?',
    a: 'Le régime des plus-values varie selon les pays et le statut (particulier/entreprise) et ne fait pas partie de ce comparatif. Renseignez-vous auprès de votre SGI.',
  },
  {
    q: 'Ces taux sont-ils garantis ?',
    a: 'Chaque taux affiché cite sa source et sa date de vérification. Les lois de finances évoluent : cette page est une information générale, pas un conseil fiscal.',
  },
];

export default function FiscalitePage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <SectionHeader
          kicker="UEMOA · IRVM & IRC"
          title="Fiscalité des dividendes et obligations BRVM"
          subtitle="Ce que vous touchez vraiment, net de retenue à la source, selon le pays de l'émetteur."
        />

        <TaxCalculator />

        <section className="space-y-3">
          <h2 className="font-display text-lg text-ivory">Comparatif des 8 pays UEMOA</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3">Pays</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="px-4 py-3 text-right">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(Object.keys(PAYS_LABELS) as PaysUemoa[]).map((p) => (
                  <tr key={p}>
                    <td className="px-4 py-2.5 font-medium text-ivory">{PAYS_LABELS[p]}</td>
                    {COLS.map((c) => {
                      const t = BAREME[p][c.key];
                      return (
                        <td
                          key={c.key}
                          className="tabular px-4 py-2.5 text-right"
                          title={`${t.source}${t.note ? ` — ${t.note}` : ''}`}
                        >
                          <span className={t.taux == null ? 'text-faint' : 'text-white'}>
                            {fmtTaux(t.taux)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-faint">
            Survolez un taux pour voir sa source. « Non confirmé » signale l&apos;absence de source
            vérifiée — jamais un taux estimé.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg text-ivory">Questions fréquentes</h2>
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-xl border border-border bg-surface px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-ivory">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </section>

        <p className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-xs text-muted">
          Information générale fondée sur les sources citées, à leur date de vérification.
          Ne constitue pas un conseil fiscal. Consultez votre SGI ou un fiscaliste.
          Suivez vos revenus réels dans{' '}
          <Link href="/dividendes" className="text-accent underline underline-offset-2">
            l&apos;espace Dividendes
          </Link>.
        </p>
      </div>
    </div>
  );
}
