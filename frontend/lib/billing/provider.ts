import { manualProvider } from './manualProvider';
import { cinetPayProvider } from './cinetPayProvider';
import type { PaymentProvider } from './types';

const REGISTRY: Record<string, PaymentProvider> = {
  manual: manualProvider,
  cinetpay: cinetPayProvider,
};

/**
 * Provider configuré (env `PAYMENT_PROVIDER`, défaut `manual`). Inconnu → manual.
 *
 * Le repli sur `manual` est délibéré : une faute de frappe dans la variable
 * d'environnement ne doit pas casser l'encaissement, elle doit le faire retomber
 * sur le flux manuel (intention + confirmation admin), qui fonctionne toujours.
 */
export function getProvider(code: string = process.env.PAYMENT_PROVIDER ?? 'manual'): PaymentProvider {
  return REGISTRY[code] ?? manualProvider;
}
