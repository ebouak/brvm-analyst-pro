'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, ChevronDown, Minus } from 'lucide-react';

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
    tagline: 'Suivre la séance et l’actualité des sociétés cotées.',
    cta: 'Commencer gratuitement',
    items: [
      'Vue marché globale',
      'Actualités des sociétés cotées',
      'Watchlist limitée',
      'Alertes limitées',
      'Rapports restreints',
    ],
  },
  premium: {
    tagline: 'Analyser une valeur en profondeur avant de passer un ordre.',
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
    tagline: 'Être accompagné dans ses décisions, avec un support prioritaire.',
    cta: 'Choisir Platinium',
    items: [
      'Tout le plan Premium',
      'Gestion assistée',
      'Analyse fondamentale complète',
      'Rapports approfondis',
      'Exports enrichis',
      'Support prioritaire',
      'Accompagnement renforcé',
    ],
  },
};

/** Ordre d'affichage des formules ; les cellules du comparatif suivent cet ordre. */
const ORDRE = ['free', 'premium', 'platinium'];

/** Tableau comparatif : true = inclus, false = absent, texte = niveau. */
const COMPARATIF: { label: string; cells: (boolean | string)[] }[] = [
  { label: 'Vue marché et actualités', cells: [true, true, true] },
  { label: 'Signaux avancés', cells: [false, true, true] },
  { label: 'Historique étendu', cells: [false, true, true] },
  { label: 'Rapports', cells: ['Restreints', 'Enrichis', 'Approfondis'] },
  { label: 'Exports', cells: [false, 'PDF / Word', 'Enrichis'] },
  { label: 'Comparatifs sectoriels', cells: [false, true, true] },
  { label: 'Analyse fondamentale complète', cells: [false, false, true] },
  { label: 'Accompagnement et support', cells: [false, 'Standard', 'Prioritaire'] },
];

function fmtPrice(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
}

function Cellule({ v }: { v: boolean | string }) {
  if (v === true) {
    return (
      <>
        <Check size={16} strokeWidth={1.5} className="text-ivory" aria-hidden />
        <span className="sr-only">Inclus</span>
      </>
    );
  }
  if (v === false) {
    return (
      <>
        <Minus size={16} strokeWidth={1.5} className="text-faint" aria-hidden />
        <span className="sr-only">Non inclus</span>
      </>
    );
  }
  return <span className="text-ivory">{v}</span>;
}

export function PricingClient({ plans }: { plans: PricingPlan[] }) {
  const [cycle, setCycle] = useState<Cycle>('yearly');
  const ordered = ORDRE
    .map((code) => plans.find((p) => p.code === code))
    .filter((p): p is PricingPlan => Boolean(p));
  // Plan de référence pour l'économie affichée : celui mis en avant, sinon Premium.
  const reference = ordered.find((p) => p.is_recommended) ?? ordered.find((p) => p.code === 'premium');
  const ecoAnnuel = economie(reference, 'yearly');
  const ecoTrimestre = economie(reference, 'quarterly');

  // Réponse sur les cycles tirée des prix en base, jamais écrite en dur.
  const reponseCycles =
    ecoAnnuel > 0
      ? `Mensuel, trimestriel ou annuel. Sur ${reference?.name ?? 'la formule recommandée'}, l’annuel revient ${ecoAnnuel} % moins cher que douze mois réglés au mois${ecoTrimestre > 0 ? `, le trimestriel ${ecoTrimestre} % moins cher que trois` : ''}.`
      : 'Mensuel, trimestriel ou annuel, selon la formule. Le prix de chaque cycle s’affiche sur le sélecteur en haut de page.';

  const faq: { q: string; a: string }[] = [
    { q: 'Puis-je commencer gratuitement ?', a: 'Oui. Le plan Gratuit s’ouvre sans carte bancaire.' },
    {
      q: 'Puis-je changer de formule à tout moment ?',
      a: 'Oui. Le changement de formule prend effet immédiatement.',
    },
    {
      q: 'Que signifie « gestion assistée » ?',
      a: 'Un accompagnement plus suivi, avec une analyse plus poussée et une aide à la décision. Ce n’est ni une gestion automatique de votre portefeuille, ni un mandat de gestion.',
    },
    { q: 'Les paiements sont-ils mensuels ou annuels ?', a: reponseCycles },
    {
      q: 'Mes rapports peuvent-ils être exportés ?',
      a: 'Oui, selon la formule : PDF et Word avec Premium, exports enrichis avec Platinium.',
    },
  ];

  return (
    <div>
      {/* En-tête : titre et cycle sur une même ligne, alignés à gauche */}
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-3xl font-medium tracking-tight text-ivory md:text-4xl">Formules et tarifs</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Le plan Gratuit suffit pour suivre la séance à la BRVM, avec des alertes et des rapports en nombre
            limité. Premium et Platinium ouvrent les signaux avancés et l’analyse par société.
          </p>
        </div>

        {/* Choix du cycle. L'économie est calculée sur le plan mis en avant. */}
        <div
          role="radiogroup"
          aria-label="Cycle de facturation"
          className="inline-flex self-start rounded-xl border border-border bg-surface p-1 md:self-auto"
        >
          {CYCLES.map((c, i) => {
            const actif = c.cle === cycle;
            const eco = economie(reference, c.cle);
            return (
              <button
                key={c.cle}
                type="button"
                role="radio"
                aria-checked={actif}
                tabIndex={actif ? 0 : -1}
                onClick={() => setCycle(c.cle)}
                onKeyDown={(e) => {
                  // Groupe radio : les flèches déplacent la sélection et le focus.
                  const pas = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                  if (!pas) return;
                  e.preventDefault();
                  const j = (i + pas + CYCLES.length) % CYCLES.length;
                  setCycle(CYCLES[j].cle);
                  (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
                }}
                // Actif : filet renforcé sur le fond de page (surface et elevated se confondent en clair).
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  actif ? 'bg-bg text-ivory ring-1 ring-inset ring-border-strong' : 'text-muted hover:text-ivory'
                }`}
              >
                {c.label}
                {eco > 0 && <span className="tabular text-xs text-accent-ink">−{eco}&nbsp;%</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fiche des formules : un seul panneau, colonnes séparées par des filets */}
      <div className="mt-12 grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-surface md:grid-cols-3">
        {ordered.map((plan, i) => {
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
          // Équivalent mensuel, dérivé du prix en base (trimestriel et annuel seulement).
          const parMois = !isFree && prix != null && cycle !== 'monthly' ? Math.round(prix / MOIS[cycle]) : null;
          return (
            <section
              key={plan.code}
              aria-labelledby={`plan-${plan.code}`}
              // Sous-grille : nom, phrase, prix, CTA et liste tombent sur la même ligne dans les trois colonnes.
              // La formule recommandée se distingue par un filet d'accent de 2 px en haut (surface et elevated
              // sont identiques en mode clair : un palier de fond y serait invisible).
              className={`flex flex-col p-6 md:row-span-5 md:grid md:grid-rows-subgrid md:p-8 ${
                i > 0 ? 'border-t border-border md:border-l md:border-t-0' : ''
              } ${highlighted ? 'shadow-[inset_0_2px_0_rgb(var(--color-accent))]' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`plan-${plan.code}`} className="font-display text-2xl font-medium text-ivory">
                  {plan.name}
                </h2>
                {highlighted && <span className="text-xs font-medium text-accent-ink">Recommandé</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f?.tagline}</p>

              <div className="mt-8 border-t border-border pt-6">
                <p className="flex items-baseline gap-2">
                  <span className="tabular text-4xl font-medium text-ivory">{fmtPrice(shown)}</span>
                  <span className="text-sm text-muted">{isFree ? 'FCFA' : `FCFA / ${unite}`}</span>
                </p>
                <p className="mt-2 min-h-5 text-xs text-faint">
                  {parMois != null ? <>soit <span className="tabular">{fmtPrice(parMois)}</span> FCFA / mois</> : isFree ? 'sans engagement' : ''}
                </p>
              </div>

              <Link
                href={href}
                className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-chip px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  highlighted
                    ? 'bg-ivory text-bg hover:bg-ivory/90'
                    : 'border border-border text-ivory hover:border-accent/40'
                }`}
              >
                {f?.cta ?? 'Choisir'}
              </Link>

              <ul className="mt-8 space-y-3 text-sm">
                {f?.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-muted">
                    <Check size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-faint" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Tableau comparatif */}
      <section aria-labelledby="h-comparatif" className="mt-20">
        <h2 id="h-comparatif" className="font-display text-2xl font-medium text-ivory">
          Comparatif des formules
        </h2>
        <div tabIndex={0} role="region" aria-label="Comparatif des formules" className="relative mt-6 overflow-x-auto rounded-xl border border-border bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-ink">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Fonctionnalités incluses dans chaque formule</caption>
            <thead>
              <tr className="border-b border-border bg-surface text-left">
                <th scope="col" className="sticky left-0 bg-surface px-4 py-3 font-medium text-muted">
                  Fonctionnalité
                </th>
                {ordered.map((p) => (
                  <th key={p.code} scope="col" className="px-4 py-3 font-medium text-ivory">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARATIF.map((ligne) => (
                <tr key={ligne.label} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="sticky left-0 bg-surface px-4 py-3 text-left font-normal text-muted">
                    {ligne.label}
                  </th>
                  {ordered.map((p) => (
                    <td key={p.code} className="px-4 py-3">
                      <Cellule v={ligne.cells[ORDRE.indexOf(p.code)] ?? false} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="h-faq" className="mt-20 grid gap-6 md:grid-cols-[1fr_2fr] md:gap-12">
        <h2 id="h-faq" className="font-display text-2xl font-medium text-ivory">
          Questions fréquentes
        </h2>
        <div className="divide-y divide-border border-y border-border">
          {faq.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-medium text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-muted transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-12 text-sm text-muted">
        Prix en francs CFA (FCFA). Résiliation possible à tout moment depuis votre espace compte.
      </p>
    </div>
  );
}
