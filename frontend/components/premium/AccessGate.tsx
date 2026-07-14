import { EmptyStatePremium } from '@/components/ui/premium';

/**
 * Écran de blocage plein page pour une fonctionnalité payante.
 *
 * Rendu À LA PLACE du contenu réel quand l'utilisateur n'a pas le droit : la page
 * ne charge alors PAS les données protégées (le verrou est côté serveur, pas un
 * simple masque visuel). L'utilisateur voit ce qu'il gagnerait, pas les données.
 */
export function AccessGate({
  required,
  feature,
  hint,
}: {
  /** Niveau exigé, TEL QUE LU EN BASE (feature_flags) — jamais décidé par le code. */
  required: 'premium' | 'pro' | 'disabled';
  /** Nom de la fonctionnalité, ex. « Le Conseiller ». */
  feature: string;
  hint?: string;
}) {
  // Kill switch : la fonctionnalité est coupée pour tout le monde, abonnés compris.
  // Proposer un abonnement ici serait mensonger — payer ne débloquerait rien.
  if (required === 'disabled') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyStatePremium
          icon="⏸"
          title={`${feature} — temporairement indisponible`}
          hint="Cette fonctionnalité est momentanément suspendue. Elle sera rétablie sous peu."
        />
      </div>
    );
  }

  const label = required === 'pro' ? 'Platinium' : 'Premium';
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <EmptyStatePremium
        icon="🔒"
        title={`${feature} — réservé au plan ${label}`}
        hint={
          hint ??
          `Cette fonctionnalité est incluse dans l'abonnement ${label}. Débloquez-la en quelques minutes.`
        }
        action={{ href: '/account/plan', label: `Passer à ${label}` }}
      />
    </div>
  );
}
