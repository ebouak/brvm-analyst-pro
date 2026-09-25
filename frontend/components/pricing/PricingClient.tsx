'use client';

import Link from 'next/link';
import { useState } from 'react';

type Cycle = 'monthly' | 'quarterly' | 'yearly';

const CYCLES: { cle: Cycle; label: string }[] = [
  { cle: 'monthly', label: 'Mensuel' },
  { cle: 'quarterly', label: 'Trimestriel' },
  { cle: 'yearly', label: 'Annuel' },
];
const MOIS: Record<Cycle, number> = { monthly: 1, quarterly: 3, yearly: 12 };
const UNITE: Record<Cycle, string> = { monthly: 'mois', quarterly: '3 mois', yearly: 'an' };

function prixCycle(p: PricingPlan, c: Cycle): number | null {
  const v = c === 'yearly' ? p.price_yearly : c === 'quarterly' ? p.price_quarterly : p.price_monthly;
  return v == null ? null : Number(v);
}

/** Économie en % face au mensuel, arrondie. 0 si non calculable — une mention
 *  « 2 mois offerts » écrite en dur deviendrait fausse au premier changement. */
function economie(p: PricingPlan | undefined, c: Cycle): number {
  if (!p || c === 'monthly') return 0;
  const prix = prixCycle(p, c);
  const plein = p.price_monthly * MOIS[c];
  if (prix == null || plein <= 0 || prix >= plein) return 0;
  return Math.round((1 - prix / plein) * 100);
}

export interface PricingPlan {
  code: string;
  name: string;
  price_monthly: number;
  price_quarterly: number | null;
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
      'Rapports enrichis',
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
  const [cycle, setCycle] = useState<Cycle>('yearly');
  const ordered = ['free', 'premium', 'platinium']
    .map((code) => plans.find((p) => p.code === code))
    .filter((p): p is PricingPlan => Boolean(p));
  // Plan de référence pour l'économie affichée : celui mis en avant, sinon Premium.
  const reference = ordered.find((p) => p.is_recommended) ?? ordered.find((p) => p.code === 'premium');

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

      {/* Choix du cycle. L'économie est calculée sur le plan mis en avant. */}
      <div role="radiogroup" aria-label="Cycle de facturation" className="mt-8 flex items-center justify-center">
        <div className="inline-flex rounded-full border border-border bg-elevated p-1">
          {CYCLES.map((c) => {
            const actif = c.cle === cycle;
            const eco = economie(reference, c.cle);
            return (
              <button
                key={c.cle}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => setCycle(c.cle)}
                className={`min-h-[40px] rounded-full px-4 text-sm font-semibold transition-colors ${actif ? 'bg-accent text-[#03222b]' : 'text-muted hover:text-ivory'}`}
              >
                {c.label}
                {eco > 0 && <span className={actif ? 'ml-1.5 opacity-80' : 'ml-1.5 text-up'}>−{eco}&nbsp;%</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cartes */}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {ordered.map((plan) => {
          const f = FEATURES[plan.code];
          const monthly = plan.price_monthly;
          // Un plan sans prix pour ce cycle retombe sur son mensuel, ET l'unité
          // affichée suit : jamais un montant sous une mauvaise unité.
          const prix = prixCycle(plan, cycle);
          const shown = prix ?? monthly;
          const unite = prix == null ? 'mois' : UNITE[cycle];
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
                  {isFree ? '' : `XOF / ${unite}`}
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
                ['Rapports', ['Restreint', 'Enrichi', 'Approfondi']],
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
