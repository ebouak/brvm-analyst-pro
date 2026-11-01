// frontend/app/admin/crm/preparerFiche.ts — gabarit et relance récente dérivés du dossier (pur).
import type { Dossier, Score } from '@/lib/crm/types';
import { choisirGabarit, composerRelance } from '@/lib/crm/gabarits';
import { fmtJour, compareIso } from '@/lib/crm/score';

export function preparerFiche(d: Dossier, s: Score, maintenant: Date) {
  const templateId = choisirGabarit(d, s);
  const { sujet, corps } = composerRelance(templateId, d);
  const derniere = [...d.actions].filter((a) => a.type === 'relance' && (a.statut === 'envoye' || a.statut === 'prepare')).sort((a, b) => compareIso(b.date, a.date))[0];
  const relanceRecente = derniere && maintenant.getTime() - Date.parse(derniere.date) < 14 * 86_400_000 ? fmtJour(derniere.date) : null;
  return { templateId, sujet, corps, relanceRecente };
}
