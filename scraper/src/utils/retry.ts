/**
 * Retry à backoff exponentiel avec jitter.
 * Utilisé pour absorber les coupures réseau et 5xx transitoires de BDFIN.
 */
import { logger } from '../logger.js';

export interface RetryOptions {
  maxRetries: number;
  baseMs: number;
  /** Décide si une erreur est réessayable. Par défaut: tout sauf abort logique. */
  shouldRetry?: (err: unknown) => boolean;
  label?: string;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const { maxRetries, baseMs, shouldRetry = defaultShouldRetry, label } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const retryable = shouldRetry(err);
      if (!retryable || attempt === maxRetries) {
        break;
      }
      const delay = Math.round(
        baseMs * 2 ** attempt + Math.random() * baseMs,
      );
      logger.warn(
        { attempt: attempt + 1, maxRetries, delay, label, err: errMessage(err) },
        'Tentative échouée, nouvel essai planifié',
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

function defaultShouldRetry(err: unknown): boolean {
  // Erreurs réseau axios: ECONNRESET, ETIMEDOUT, ENOTFOUND, ou status >= 500.
  const anyErr = err as {
    code?: string;
    response?: { status?: number };
  };
  if (anyErr?.code) {
    return [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNABORTED',
      'ENOTFOUND',
      'EAI_AGAIN',
    ].includes(anyErr.code);
  }
  const status = anyErr?.response?.status;
  if (typeof status === 'number') {
    return status >= 500 || status === 429;
  }
  return true;
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
