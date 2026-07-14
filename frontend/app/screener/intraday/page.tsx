import { Suspense } from 'react';
import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import IntraDayPatternsTable from '@/components/screener/IntraDayPatternsTable';
import { canAccess } from '@/lib/server/featureAccess';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Screener Intraday — WESTBOURSE',
  description:
    "Titres qui bougent et titres dont le volume s'emballe, sur la séance BRVM du jour.",
};


function PatternsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 bg-surface border border-border rounded animate-pulse" />
      <div className="h-96 bg-surface border border-border rounded animate-pulse" />
    </div>
  );
}

export default async function IntraDayScreenerPage() {
  const todayDate = new Date().toISOString().slice(0, 10);
  // Niveau requis LU EN BASE (feature_flags).
  const gate = await canAccess('screener_intraday');

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader
          kicker="Outils"
          title="Screener Intraday"
          subtitle="Les titres qui bougent, et ceux dont le volume s'emballe — sur la séance du jour."
        />
      </div>

      {/* Verrou serveur : le tableau (et donc les données) n'est rendu que pour un
          abonné. Un compte gratuit reçoit l'invitation, jamais les signaux. */}
      {gate.allowed ? (
        <Suspense fallback={<PatternsSkeleton />}>
          <IntraDayPatternsTable dateMarche={todayDate} />
        </Suspense>
      ) : (
        <EmptyStatePremium
          icon="⚡"
          title="Screener intraday réservé au premium"
          hint="Les titres qui bougent et les volumes qui s'emballent en séance sont inclus dans l'abonnement Premium."
          action={{ href: '/account/plan', label: 'Passer à Premium' }}
        />
      )}

      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-medium text-ivory mb-3">Ce que ce screener mesure</h3>
          <div className="space-y-3 text-sm text-muted">
            <div>
              <p className="font-medium text-ivory mb-1">📈 Momentum de séance</p>
              <p>
                Variation du cours depuis l&apos;ouverture, au-delà de <strong>3 %</strong>. Sur la
                BRVM, la plupart des titres ne bougent pas de la journée : un mouvement de cette
                ampleur est en soi une information.
              </p>
            </div>

            <div>
              <p className="font-medium text-ivory mb-1">🔊 Volume anormal</p>
              <p>
                Volume échangé sur la séance supérieur à <strong>2×</strong> sa moyenne des
                20 dernières séances. Signale un intérêt inhabituel pour le titre.
              </p>
            </div>

            <div>
              <p className="font-medium text-ivory mb-1">✦ La confluence, c&apos;est le vrai signal</p>
              <p>
                Un titre qui monte <em>avec</em> du volume traduit une conviction. Un titre qui
                monte <em>sans</em> volume traduit surtout son illiquidité. Ce sont les titres
                cumulant les <strong>deux</strong> signaux qui méritent votre attention.
              </p>
            </div>

            <div>
              <p className="font-medium text-ivory mb-1">Niveaux de confiance</p>
              <p>
                Dérivés du dépassement du seuil : <strong>HIGH</strong> quand la mesure excède
                nettement le seuil, <strong>MEDIUM</strong> quand elle le dépasse modérément,
                <strong className="ml-1">LOW</strong> à la marge.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 mt-4 space-y-2">
          <p className="text-xs text-faint">
            Calculé à partir des relevés de cours publics BRVM capturés toutes les 15 minutes en
            séance. Un titre sans signal n&apos;est pas affiché : ici, l&apos;absence de nouvelle
            est une nouvelle.
          </p>
          <p className="text-xs text-faint">
            <strong className="text-muted">Pourquoi pas d&apos;ATR ni de figures chartistes ?</strong>{' '}
            La BRVM fonctionne par fixing, pas en continu : sur une séance, le titre le plus actif ne
            connaît que quelques prix distincts. Les bougies intraday n&apos;ont donc pas
            d&apos;amplitude réelle, et les indicateurs qui en dépendent (ATR, consolidation,
            chandeliers) n&apos;y mesurent rien. Nous préférons afficher deux signaux qui existent
            vraiment plutôt qu&apos;une batterie d&apos;indicateurs vides de sens.
          </p>
        </div>
      </div>
    </div>
  );
}
