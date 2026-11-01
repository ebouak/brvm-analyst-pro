/**
 * Quatre indicateurs du CRM — PUR (spec CRM v2 §2.5). Chaque chiffre se
 * recompte à la main depuis les dossiers : aucune estimation. Les devises ne
 * s'additionnent jamais : seuls les montants en FCFA entrent dans le total, les
 * autres sont comptés à part (`sansMontant`, dont `autresDevises`).
 */
import type { Dossier } from './types';
import type { ReglagesVue } from './vues';
import type { Reglages } from './reglages';
import { vueDe } from './vues';
import { etatPaiement } from './paiement';
import { compareIso } from './score';

export const PERIODE_CONVERSION_JOURS = 90;
const JOUR_MS = 86_400_000;
const estFcfa = (devise: string) => ['XOF', 'FCFA', 'CFA'].includes(devise.trim().toUpperCase());

export interface Indicateurs {
  aTraiter: number;
  ouvertes: number;
  montantPotentiel: {
    total: number;
    devise: 'XOF';
    /** Opportunités ouvertes dont le montant n'entre pas dans le total (aucun montant, ou autre devise). */
    sansMontant: number;
    /** Part de `sansMontant` due à une devise autre que le FCFA (jamais convertie). */
    autresDevises: number;
  };
  conversions: { relances: number; converties: number; fenetreJours: number; periodeJours: typeof PERIODE_CONVERSION_JOURS };
}

export function calculerIndicateurs(dossiers: readonly Dossier[], reglages: Pick<Reglages, 'fenetre_conversion_jours'> & ReglagesVue, maintenant: Date): Indicateurs {
  // Une personne = une clé ; les administrateurs ne sont jamais des prospects.
  const uniques = new Map<string, Dossier>();
  for (const d of dossiers) if (!d.admin && !uniques.has(d.cle)) uniques.set(d.cle, d);

  let aTraiter = 0, ouvertes = 0, total = 0, sansMontant = 0, autresDevises = 0, relances = 0, converties = 0;
  const debut = maintenant.getTime() - PERIODE_CONVERSION_JOURS * JOUR_MS;
  const fenetreMs = reglages.fenetre_conversion_jours * JOUR_MS;

  for (const d of uniques.values()) {
    const { vue } = vueDe(d, maintenant, reglages);
    if (vue === 'a_traiter') aTraiter++;
    if (vue !== 'convertis' && vue !== 'clotures') {
      ouvertes++;
      const m = etatPaiement(d, maintenant).enCours;
      if (!m) sansMontant++;
      else if (estFcfa(m.devise)) total += m.montant;
      else { sansMontant++; autresDevises++; }
    }

    // Conversion : la PREMIÈRE relance (envoyée ou préparée) fixe l'origine, quel que soit le nombre de tentatives.
    const premiere = d.actions
      .filter((a) => a.type === 'relance' && (a.statut === 'envoye' || a.statut === 'prepare'))
      .map((a) => a.date)
      .sort(compareIso)[0];
    if (premiere && Date.parse(premiere) >= debut) {
      relances++;
      const t0 = Date.parse(premiere);
      const paye = d.paiements.some((p) => {
        if (p.statut !== 'paid') return false;
        const t = Date.parse(p.payeLe ?? p.date);
        return t >= t0 && t <= t0 + fenetreMs;
      });
      if (paye) converties++;
    }
  }

  return {
    aTraiter, ouvertes,
    montantPotentiel: { total, devise: 'XOF', sansMontant, autresDevises },
    conversions: { relances, converties, fenetreJours: reglages.fenetre_conversion_jours, periodeJours: PERIODE_CONVERSION_JOURS },
  };
}
