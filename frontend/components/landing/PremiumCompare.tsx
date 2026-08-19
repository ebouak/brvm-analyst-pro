// frontend/components/landing/PremiumCompare.tsx
import Link from 'next/link';

interface PlanFeature {
  id: string;
  feature_label: string;
  feature_value: string | null;
}

interface Plan {
  code: string;
  name: string;
  price_monthly: number;
  is_recommended: boolean;
  features: PlanFeature[];
}

export function PremiumCompare({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) return null;
  return (
    <section className="mt-10">
      <p className="overline mb-3 text-gold-2">Formules</p>
      <h2 className="mb-6 font-display text-2xl text-ivory md:text-3xl [letter-spacing:-0.03em]">
        Gratuit pour commencer, Premium pour aller plus loin.
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.code}
            className={`rounded-panel border p-6 ${p.is_recommended ? 'border-accent/40 bg-accent/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}
          >
            {p.is_recommended && <p className="overline mb-2 text-gold-2">Recommandé</p>}
            <h3 className="font-display text-xl text-ivory">{p.name}</h3>
            <p className="tabular mt-1 text-2xl font-bold text-ivory">
              {p.price_monthly > 0 ? `${p.price_monthly.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}
              {p.price_monthly > 0 && <span className="text-xs font-normal text-faint"> /mois</span>}
            </p>
            <ul className="mt-4 space-y-2">
              {p.features.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-xs text-muted">
                  <span className="mt-0.5 text-up" aria-hidden>✓</span>
                  <span>{f.feature_label}{f.feature_value ? ` — ${f.feature_value}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5 text-center">
        <Link href="/pricing" className="text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2">
          Comparer toutes les formules en détail →
        </Link>
      </div>
    </section>
  );
}
