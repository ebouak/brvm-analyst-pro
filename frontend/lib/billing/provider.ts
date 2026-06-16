import { manualProvider } from './manualProvider';
import type { PaymentProvider } from './types';

const REGISTRY: Record<string, PaymentProvider> = {
  manual: manualProvider,
};

/** Provider configuré (env `PAYMENT_PROVIDER`, défaut `manual`). Inconnu → manual. */
export function getProvider(code: string = process.env.PAYMENT_PROVIDER ?? 'manual'): PaymentProvider {
  return REGISTRY[code] ?? manualProvider;
}
