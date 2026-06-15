'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface PricingPlan {
  code: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  is_recommended: boolean;
}

/** Listes de fonctionnalités par plan (copy produit ; les prix viennent de la base). */
const FEATURES: Record<string, { tagline: string; cta: string; items: string[] }> = {
  free: {
    tagline: 'Pour découvrir la plateforme et suivre l’essentiel du marché.',
    cta: 'Commencer gratuitement',
    items: [
      'Vue marché globale',
      'Actualités et informations clés',
      'Watchlist limitée',
      'Alertes limitées',
      'Rapports restreints',
    ],
  },
  premium: {
    tagline: 'Pour les investisseurs actifs qui veulent décider plus vite et avec plus de profondeur.',
    cta: 'Passer à Premium',
    items: [
      'Tout le plan Gratuit',
      'Signaux avancés',
      'Historique étendu',
      'Rapports IA enrichis',
      'Export PDF / Word',
      'Comparatifs sectoriels',
      'Plus d’alertes et de watchlists',
    ],
  },
  platinium: {
    tagline: 'Pour les investisseurs exigeants qui veulent une gestion assistée et un accompagnement renforcé.',
    cta: 'Choisir Platinium',
    items: [
      'Tout le plan Premium',
      'Gestion assistée',
      'Analyse fondamentale complète',
      'Rapports approfondis',
      'Exports enrichis',
      'Support prioritaire',
      'Accompagnement premium',
    ],
  },
};

const FAQ: { q: string; a: string }[] = [
  { q: 'Puis-je commencer gratuitement ?', a: 'Oui, le plan Gratuit est accessible sans carte bancaire.' },
  { q: 'Puis-je changer de formule à tout moment ?', a: 'Oui, l’upgrade et le downgrade sont simples et prennent effet immédiatement.' },
  {
    q: 'Que signifie « gestion assistée » ?',
    a: 'Un accompagnement premium : analyse renforcée et aide à la décision. Ce n’est pas une gestion automatique de portefeuille ni un mandat de gestion.',
  },
  { q: 'Les paiements sont-ils mensuels ou annuels ?', a: 'Les deux, avec une réduction sur l’abonnement annuel.' },
  { q: 'Mes rapports peuvent-ils être exportés ?', a: 'Oui, selon le plan (PDF/Word, exports enrichis pour Platinium).' },
];

function fmtPrice(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export function PricingClient({ plans }: { plans: PricingPlan[] }) {
  const [yearly, setYearly] = useState(false);
  const ordered = ['free', 'premium', 'platinium']
    .map((code) => plans.find((p) => p.code === code))
    .filter((p): p is PricingPlan => Boolean(p));

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {/* Hero */}
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-bold text-ivory">
          Choisissez le niveau d’accompagnement adapté à votre profil
        </h1>
        <p className="mt-4 text-muted">
          Données de marché, rapports d’analyse et outils de suivi BRVM/UEMOA dans une
          expérience premium pensée pour l’Afrique de l’Ouest.
        </p>
      </div>

      {/* Toggle mensuel / annuel */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <span className={!yearly ? 'text-ivory' : 'text-faint'}>Mensuel</span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly((v) => !v)}
          className="relative h-6 w-11 rounded-full bg-elevated transition-colors"
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-accent transition-transform ${
              yearly ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className={yearly ? 'text-ivory' : 'text-faint'}>
          Annuel <span className="text-up">(2 mois offerts)</span>
        </span>
      </div>

      {/* Cartes */}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {ordered.map((plan) => {
          const f = FEATURES[plan.code];
          const monthly = plan.price_monthly;
          const yearlyPrice = plan.price_yearly ?? monthly * 12;
          const shown = yearly ? yearlyPrice : monthly;
          const isFree = monthly === 0;
          const highlighted = plan.is_recommended;
          const href = isFree ? '/signup' : `/signup?plan=${plan.code}`;
          return (
            <div
              key={plan.code}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                highlighted
                  ? 'border-accent/50 bg-accent/[0.04] shadow-gold'
                  : 'border-border bg-surface'
              }`}
            >
              {highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#03222b]">
                  Le plus choisi
                </span>
              )}
              <h2 className="font-display text-xl font-semibold text-ivory">{plan.name}</h2>
              <p className="mt-1 min-h-[3rem] text-sm text-muted">{f?.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="tabular text-3xl font-bold text-ivory">{fmtPrice(shown)}</span>
                <span className="text-sm text-muted">
                  {isFree ? '' : `XOF / ${yearly ? 'an' : 'mois'}`}
                </span>
              </div>
              <Link
                href={href}
                className={`mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-sm font-semibold transition-all active:scale-95 ${
                  highlighted
                    ? 'bg-accent text-[#03222b] hover:bg-accent/90'
                    : 'border border-border text-ivory hover:border-accent/40'
                }`}
              >
                {f?.cta ?? 'Choisir'}
              </Link>
              <ul className="mt-6 space-y-2 text-sm">
                {f?.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-muted">
                    <span className="mt-0.5 text-up" aria-hidden>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Tableau comparatif */}
      <div className="mt-16">
        <h2 className="font-display text-2xl font-bold text-ivory">Comparatif des formules</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left">
                <th className="px-4 py-3 font-medium text-muted">Fonctionnalité</th>
                {ordered.map((p) => (
                  <th key={p.code} className="px-4 py-3 font-semibold text-ivory">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Vue marché & actualités', ['✓', '✓', '✓']],
                ['Signaux avancés', ['—', '✓', '✓']],
                ['Historique étendu', ['—', '✓', '✓']],
                ['Rapports IA', ['Restreint', 'Enrichi', 'Approfondi']],
                ['Exports', ['—', 'PDF / Word', 'Enrichis']],
                ['Comparatifs sectoriels', ['—', '✓', '✓']],
                ['Analyse fondamentale complète', ['—', '—', '✓']],
                ['Accompagnement / support', ['—', 'Standard', 'Prioritaire']],
              ].map(([label, cells]) => (
                <tr key={label as string} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 text-muted">{label as string}</td>
                  {(cells as string[]).map((c, i) => (
                    <td key={i} className={`px-4 py-3 ${c === '✓' ? 'text-up' : c === '—' ? 'text-faint' : 'text-ivory'}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-16">
        <h2 className="font-display text-2xl font-bold text-ivory">Questions fréquentes</h2>
        <div className="mt-4 space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-medium text-ivory">{item.q}</summary>
              <p className="mt-2 text-sm text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Bloc confiance */}
      <div className="mt-12 rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">
          Données réelles BRVM/UEMOA · Analyses dérivées des métriques (jamais inventées) ·
          Résiliation possible à tout moment.
        </p>
      </div>
    </div>
  );
}
