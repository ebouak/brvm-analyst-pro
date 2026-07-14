import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import { canAccess } from '@/lib/server/featureAccess';
import ScreenerClient from '@/components/screener/ScreenerClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Screener multi-critères — WESTBOURSE' };

/**
 * Coquille SERVEUR du screener.
 *
 * Le screener était un composant client qui lisait `is_premium` lui-même : il ne
 * pouvait donc pas consulter `feature_flags`, et son niveau d'accès restait figé
 * dans le code. On résout la décision côté serveur (base) et on ne monte le client
 * que si l'accès est accordé — le verrou n'est plus contournable en désactivant
 * JavaScript, et il s'ajuste depuis /admin/features.
 */
export default async function ScreenerPage() {
  const gate = await canAccess('screener');

  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <SectionHeader
          kicker="Outils"
          title="Screener multi-critères"
          subtitle="Filtrez les actions par RSI, volume, score, secteur, dividende"
        />
        <div className="mt-10">
          {gate.required === 'disabled' ? (
            <EmptyStatePremium
              icon="⏸"
              title="Screener temporairement indisponible"
              hint="Cette fonctionnalité est momentanément suspendue. Elle sera rétablie sous peu."
            />
          ) : (
            <EmptyStatePremium
              icon="🔒"
              title={`Screener réservé au plan ${gate.required === 'pro' ? 'Platinium' : 'Premium'}`}
              hint="Filtrez les 47 valeurs par RSI, volume, score, secteur et rendement du dividende."
              action={{
                href: '/account/plan',
                label: `Passer à ${gate.required === 'pro' ? 'Platinium' : 'Premium'}`,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // `isPremium` alimente encore les FILTRES avancés à l'intérieur du screener.
  return <ScreenerClient isPremium={gate.ent.isPremium} />;
}
