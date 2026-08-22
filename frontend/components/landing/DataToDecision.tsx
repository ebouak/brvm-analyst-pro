import Link from 'next/link';

/**
 * Section 13 — « De la donnée à la décision ».
 *
 * Colonne vertébrale narrative de la V2 : elle relie les fonctionnalités
 * réelles dans l'ordre où un investisseur les traverse. Chaque étape pointe
 * vers une route existante ; ne pas y ajouter d'étape sans fonctionnalité
 * derrière, ce serait promettre un chaînon qui n'existe pas.
 */

const ETAPES = [
  { n: '01', titre: 'Données', desc: 'Cours, volumes et publications collectés à la source.', href: '/societes' },
  { n: '02', titre: 'Analyse', desc: 'Fondamentaux, RSI, MACD, dividendes.', href: '/screener' },
  { n: '03', titre: 'Note A–F', desc: 'Un score quantitatif explicable par action.', href: '/notations' },
  { n: '04', titre: 'Signal', desc: 'BUY, HOLD ou SELL, avec son niveau de confiance.', href: '/signaux' },
  { n: '05', titre: 'Diagnostic IA', desc: 'Forces, risques et valorisation mis en mots.', href: '/premium/diagnostic' },
  { n: '06', titre: 'Simulation', desc: 'Ce que la décision aurait donné, dividendes inclus.', href: '/simulateur' },
  { n: '07', titre: 'Décision', desc: 'À vous de trancher, avec les chiffres sous les yeux.', href: '/signup' },
];

export function DataToDecision() {
  return (
    <section aria-labelledby="chaine-titre" className="mt-14">
      <div className="mb-8 max-w-[52ch]">
        <p className="overline mb-3 text-gold-2">Le fil conducteur</p>
        <h2 id="chaine-titre" className="font-display text-2xl text-ivory md:text-4xl [letter-spacing:-0.035em]">
          De la donnée à la décision.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Chaque étape s&apos;appuie sur la précédente. Rien n&apos;est affirmé sans la donnée qui le
          justifie, et vous pouvez remonter la chaîne jusqu&apos;à la source.
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {ETAPES.map((e, i) => (
          <li key={e.n} className="relative bg-surface">
            <Link
              href={e.href}
              className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
            >
              <span className="flex items-center gap-2">
                <span className="tabular font-mono text-[10px] font-bold text-accent">{e.n}</span>
                {/* La flèche marque l'enchaînement, sauf sur la dernière étape. */}
                {i < ETAPES.length - 1 && (
                  <span className="hidden h-px flex-1 bg-gradient-to-r from-accent/40 to-transparent xl:block" aria-hidden />
                )}
              </span>
              <span className="block font-display text-base leading-tight text-ivory">{e.titre}</span>
              <span className="block text-[11px] leading-snug text-faint">{e.desc}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
