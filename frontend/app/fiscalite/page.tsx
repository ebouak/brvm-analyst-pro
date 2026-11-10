import type { Metadata } from 'next';
import Link from 'next/link';
import { BAREME, PAYS_LABELS, type PaysUemoa, type TypeRevenu } from '@/lib/tax/rates';
import TaxCalculator from '@/components/tax/TaxCalculator';
import SignupCta from '@/components/public/SignupCta';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { fmtDateCourte } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Fiscalité des dividendes et obligations BRVM (IRVM/IRC)',
  description:
    "Calculez votre dividende net d'IRVM et vos coupons obligataires nets par pays UEMOA (Côte d'Ivoire, Sénégal, Bénin…). Barème sourcé, comparatif des pays de l'Union.",
};

const COLS: { key: TypeRevenu; label: string }[] = [
  { key: 'dividende_cote', label: 'Dividendes cotés' },
  { key: 'obligation_etat', label: 'Obligations d’État' },
  { key: 'obligation_privee', label: 'Obligations privées' },
];

function fmtTaux(t: number | null): string {
  if (t == null) return 'non confirmé';
  const pct = t * 100;
  return `${pct % 1 ? pct.toFixed(1).replace('.', ',') : pct.toFixed(0)} %`;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "Qui prélève l'impôt sur mes dividendes BRVM ?",
    a: "L'IRVM est retenu à la source par l'émetteur (via sa banque centralisatrice) avant versement à votre SGI : vous recevez directement le montant net. Aucune démarche déclarative n'est en général nécessaire pour un résident UEMOA.",
  },
  {
    q: 'Le taux dépend-il de mon pays de résidence ou de celui de la société ?',
    a: "Du pays de l'émetteur, où la retenue est opérée. Votre résidence fiscale peut ensuite jouer (conventions de non double imposition) : consultez un fiscaliste pour votre situation.",
  },
  {
    q: "Pourquoi les obligations d'État affichent-elles 0 % ?",
    a: "Les emprunts émis par les États de l'UEMOA et les institutions régionales (BOAD, BIDC) sont exonérés de retenue sur les coupons : c'est l'un des attraits du marché obligataire régional.",
  },
  {
    q: 'Les plus-values de cession sont-elles imposées ?',
    a: 'Le régime des plus-values varie selon les pays et le statut (particulier ou entreprise) et ne fait pas partie de ce comparatif. Renseignez-vous auprès de votre SGI.',
  },
  {
    q: 'Ces taux sont-ils garantis ?',
    a: 'Chaque taux cite sa source et sa date de vérification. Les lois de finances évoluent : cette page est une information générale, pas un conseil fiscal.',
  },
];

export default function FiscalitePage() {
  const pays = Object.keys(PAYS_LABELS) as PaysUemoa[];

  // Sources et notes écrites en clair : un attribut title n'est lisible ni au
  // clavier ni sur mobile, la source d'un taux doit l'être partout.
  const sources = new Map<string, { source: string; url: string | null; verifieLe: string }>();
  const notes = new Map<string, { type: string; pays: string[] }>();
  for (const p of pays) {
    for (const c of COLS) {
      const t = BAREME[p][c.key];
      const cle = `${t.source}|${t.sourceUrl ?? ''}`;
      if (!sources.has(cle)) sources.set(cle, { source: t.source, url: t.sourceUrl, verifieLe: t.verifieLe });
      if (t.note) {
        const n = notes.get(t.note) ?? { type: c.label, pays: [] };
        n.pays.push(PAYS_LABELS[p]);
        notes.set(t.note, n);
      }
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="rounded font-display tracking-tight text-ivory hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">WESTBOURSE</Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="rounded text-muted hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Connexion</Link>
            <Link href="/signup" className="rounded-lg bg-accent px-3.5 py-1.5 font-semibold text-bg transition-colors hover:bg-gold-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <EnTeteCote
          titre="Fiscalité des dividendes et obligations"
          description="Ce que vous touchez vraiment, net de retenue à la source, selon le pays de l’émetteur."
          compte={{ n: pays.length, libelle: 'pays de l’UEMOA' }}
          source={null}
        />

        <section aria-labelledby="calcul-titre" className="mt-8 border-t border-border-strong pt-6">
          <h2 id="calcul-titre" className="mb-4 text-lg font-medium text-ivory">Calculer un montant net</h2>
          <TaxCalculator />
        </section>

        <section aria-labelledby="comparatif-titre" className="mt-12">
          <h2 id="comparatif-titre" className="mb-4 text-lg font-medium text-ivory">Retenue à la source, pays par pays</h2>
          <div tabIndex={0} role="region" aria-label="Comparatif fiscal des pays UEMOA" className="overflow-x-auto rounded-card border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-normal">Pays</th>
                  {COLS.map((c) => (
                    <th key={c.key} scope="col" className="px-4 py-3 text-right font-normal">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pays.map((p) => (
                  <tr key={p}>
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-ivory">{PAYS_LABELS[p]}</th>
                    {COLS.map((c) => {
                      const t = BAREME[p][c.key];
                      return (
                        <td key={c.key} className="tabular px-4 py-2.5 text-right">
                          <span className={t.taux == null ? 'text-faint' : 'text-ivory'}>{fmtTaux(t.taux)}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-faint">« Non confirmé » signale l’absence de source vérifiée, jamais un taux estimé.</p>

          {notes.size > 0 && (
            <ul className="mt-4 max-w-[72ch] space-y-1 text-xs text-muted">
              {[...notes.entries()].map(([texte, n]) => (
                <li key={texte}>
                  {n.type}
                  {n.pays.length === pays.length ? ', tous les pays' : `, ${n.pays.join(', ')}`} : {texte}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 text-xs text-faint">
            <p>Sources :</p>
            <ul className="mt-1 space-y-1">
              {[...sources.values()].map((s) => (
                <li key={s.source + (s.url ?? '')}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="rounded underline underline-offset-2 hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{s.source}</a>
                  ) : (
                    s.source
                  )}
                  , vérifié le {fmtDateCourte(s.verifieLe)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="faq-titre" className="mt-12">
          <h2 id="faq-titre" className="mb-4 text-lg font-medium text-ivory">Questions fréquentes</h2>
          <div className="divide-y divide-border/60 rounded-card border border-border bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="px-4 py-3">
                <summary className="flex min-h-[44px] cursor-pointer items-center rounded text-sm font-medium text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{f.q}</summary>
                <p className="mt-1 max-w-[72ch] pb-1 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-8 max-w-[72ch] text-xs leading-relaxed text-faint">
          Information générale fondée sur les sources citées, à leur date de vérification. Ne constitue pas un conseil
          fiscal : consultez votre SGI ou un fiscaliste. Vos revenus réels se suivent dans{' '}
          <Link href="/dividendes" className="text-accent-ink underline underline-offset-2">l’espace Dividendes</Link>.
        </p>

        <div className="mt-12">
          <SignupCta
            titre="Calculez le net de vos dividendes, automatiquement"
            sousTitre="Cette page est publique. Le compte gratuit applique la fiscalité à vos vraies positions et vous alerte aux détachements."
          />
        </div>
      </main>
    </div>
  );
}
