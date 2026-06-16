export type BillingCycle = 'monthly' | 'yearly';

export interface CheckoutRequest {
  userId: string;
  email: string;
  planCode: string;
  cycle: BillingCycle;
}

export interface CheckoutResult {
  ok: boolean;
  status: 'created' | 'existing' | 'error';
  subscriptionId?: string;
  transactionId?: string;
  reference?: string;
  instructions?: string;
  message?: string;
}

export interface PaymentProvider {
  code: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
}
