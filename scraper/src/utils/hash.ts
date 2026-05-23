/**
 * Hash SHA-256 du HTML source.
 * Sert à : (1) détecter un markup inchangé (même page que la veille => doublon),
 * (2) tracer la version exacte de la source dans scrape_runs.hash_source.
 */
import { createHash } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
