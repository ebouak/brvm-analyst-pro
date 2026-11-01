/** Validation et libellés des décisions CRM — PUR (les server actions les appellent). */
import type { MotifCloture } from './types';
import { fmtJour } from './score';
import { LIB_MOTIF } from './vues';

export const MOTIFS: readonly MotifCloture[] = ['pas_interesse', 'doublon', 'deja_abonne'];
export const estMotif = (m: unknown): m is MotifCloture => typeof m === 'string' && (MOTIFS as readonly string[]).includes(m);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const estUuid = (x: unknown): x is string => typeof x === 'string' && UUID.test(x);

/** `AAAA-MM-JJ` réel, aujourd'hui ou plus tard, au plus un an. Renvoie la date ou le motif du refus. */
export function validerEcheance(brut: unknown, maintenant: Date): { ok: true; date: string } | { ok: false; message: string } {
  const s = typeof brut === 'string' ? brut.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, message: 'Date invalide (format AAAA-MM-JJ).' };
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return { ok: false, message: 'Date invalide.' };
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  if (s < aujourdhui) return { ok: false, message: "L'échéance ne peut pas être dans le passé." };
  const limite = new Date(Date.parse(`${aujourdhui}T00:00:00Z`));
  limite.setUTCFullYear(limite.getUTCFullYear() + 1);
  if (t > limite.getTime()) return { ok: false, message: "L'échéance ne peut pas dépasser un an." };
  return { ok: true, date: s };
}

export const contenuCloture = (m: MotifCloture): string => `Clôturé : ${LIB_MOTIF[m]}`;
export const contenuEcheance = (date: string): string => `Suivi prévu le ${fmtJour(date)}`;
