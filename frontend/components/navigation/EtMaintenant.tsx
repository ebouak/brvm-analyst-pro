import Link from 'next/link';

export interface SuiteLogique {
  href: string;
  titre: string;
  /** Une phrase fixe décrivant la destination, jamais un chiffre. */
  detail: string;
}

/**
 * Suites logiques d'une page qui, sans elle, serait un cul-de-sac : une à
 * trois destinations qui existent déjà. Texte fixe, aucun chiffre ni verdict.
 * Masqué à l'impression.
 */
export default function EtMaintenant({ suites }: { suites: SuiteLogique[] }) {
  if (suites.length === 0) return null;
  return (
    <section aria-labelledby="et-maintenant" className="mt-10 print:hidden">
      <h2 id="et-maintenant" className="font-display text-lg text-ivory">
        Et maintenant&nbsp;?
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-3">
        {suites.slice(0, 3).map((s) => (
          <li key={s.href} className="bg-surface">
            <Link
              href={s.href}
              className="flex h-full flex-col gap-1 p-4 transition-colors hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 max-md:min-h-[44px]"
            >
              <span className="text-sm font-semibold text-ivory">{s.titre}</span>
              <span className="text-[12px] leading-snug text-muted">{s.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
