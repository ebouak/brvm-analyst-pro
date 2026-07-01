import Link from 'next/link';

/**
 * Mini-FAQ de la landing — lève les objections systématiques d'une plateforme
 * financière (gratuité, fiabilité, note A–F, passage Premium). Réponses factuelles
 * sur le produit réel — aucune promesse inventée.
 */
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Est-ce vraiment gratuit ?',
    a: (
      <>
        Oui. Les cours, la note A–F et les fondamentaux sont accessibles gratuitement après création
        d&apos;un compte — sans carte bancaire. L&apos;abonnement Premium (Diagnostic IA) est optionnel.
      </>
    ),
  },
  {
    q: 'Les données sont-elles fiables ?',
    a: (
      <>
        Les cours proviennent du portail public de la BRVM (actualisés ~15 min en séance) et les
        fondamentaux sont extraits des états financiers publiés par les sociétés. Aucune donnée n&apos;est inventée.
      </>
    ),
  },
  {
    q: 'Qu’est-ce que la note A–F ?',
    a: (
      <>
        Une note quantitative calculée à partir de critères objectifs (tendance, momentum, volume,
        fondamentaux). Elle synthétise l&apos;analyse, mais ne constitue pas un conseil d&apos;investissement.
      </>
    ),
  },
  {
    q: 'Comment passer à Premium ?',
    a: (
      <>
        Depuis votre compte, via la page <Link href="/pricing" className="text-accent hover:underline">Tarifs</Link>.
        Le Premium débloque le Diagnostic IA (analyse détaillée par société), sans engagement.
      </>
    ),
  },
];

export function LandingFaq() {
  return (
    <section aria-label="Questions fréquentes" className="mt-14">
      <h2 className="mb-4 font-display text-2xl text-ivory">Questions fréquentes</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {FAQ.map((item) => (
          <details
            key={item.q}
            className="group rounded-panel border border-white/10 bg-white/[0.02] px-4 py-3"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[14px] font-semibold text-ivory [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <span className="text-accent transition-transform duration-200 group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
