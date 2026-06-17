/**
 * Logique pure des leads BRVM (tunnel /debutant). Isolée des I/O pour être
 * testable : validation du formulaire, normalisation, KPIs, lien WhatsApp.
 */

export type LeadLevel = 'debutant' | 'intermediaire' | 'confirme';
export type LeadStatut = 'nouveau' | 'contacte' | 'converti' | 'perdu';

export const LEAD_STATUTS: LeadStatut[] = ['nouveau', 'contacte', 'converti', 'perdu'];

export const STATUT_LABEL: Record<LeadStatut, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  converti: 'Converti',
  perdu: 'Perdu',
};

export interface LeadInput {
  nom?: unknown;
  email?: unknown;
  telephone?: unknown;
  pays?: unknown;
  message?: unknown;
  niveau?: unknown;
  consent?: unknown;
}

export interface LeadNormalized {
  nom: string;
  email: string;
  telephone: string | null;
  pays: string | null;
  message: string | null;
  niveau: LeadLevel | null;
  consent: true;
}

export interface LeadValidationOk {
  ok: true;
  value: LeadNormalized;
}
export interface LeadValidationErr {
  ok: false;
  error: string;
}
export type LeadValidation = LeadValidationOk | LeadValidationErr;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEVELS: LeadLevel[] = ['debutant', 'intermediaire', 'confirme'];

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Valide et normalise une soumission de lead. Le consentement est OBLIGATOIRE
 * (base légale RGPD) — sans lui, aucune insertion. `consent_at` est posé côté
 * serveur, pas ici.
 */
export function validateLead(input: LeadInput): LeadValidation {
  const nom = str(input.nom);
  if (nom.length < 2) return { ok: false, error: 'Le nom est requis.' };
  if (nom.length > 120) return { ok: false, error: 'Nom trop long.' };

  const email = str(input.email).toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Email invalide.' };

  if (input.consent !== true && input.consent !== 'true' && input.consent !== 'on') {
    return { ok: false, error: 'Le consentement est requis.' };
  }

  const telephoneRaw = str(input.telephone);
  const telephone = telephoneRaw ? telephoneRaw.slice(0, 40) : null;

  const paysRaw = str(input.pays);
  const pays = paysRaw ? paysRaw.slice(0, 80) : null;

  const messageRaw = str(input.message);
  const message = messageRaw ? messageRaw.slice(0, 2000) : null;

  const niveauRaw = str(input.niveau) as LeadLevel;
  const niveau = LEVELS.includes(niveauRaw) ? niveauRaw : null;

  return { ok: true, value: { nom: nom.slice(0, 120), email, telephone, pays, message, niveau, consent: true } };
}

export interface LeadKpiSource {
  statut: LeadStatut | string | null;
}

export interface LeadKpis {
  total: number;
  nouveau: number;
  contacte: number;
  converti: number;
  perdu: number;
}

/** Agrège les compteurs par statut pour les MetricCard de l'inbox admin. */
export function computeLeadKpis(rows: LeadKpiSource[]): LeadKpis {
  const k: LeadKpis = { total: 0, nouveau: 0, contacte: 0, converti: 0, perdu: 0 };
  for (const r of rows) {
    k.total++;
    if (r.statut === 'nouveau') k.nouveau++;
    else if (r.statut === 'contacte') k.contacte++;
    else if (r.statut === 'converti') k.converti++;
    else if (r.statut === 'perdu') k.perdu++;
  }
  return k;
}

/**
 * Construit un lien wa.me pré-rempli pour contacter un lead. `phone` est
 * nettoyé (chiffres uniquement, sans +) ; sans numéro valide, retourne null.
 */
export function whatsappLink(phone: string | null | undefined, nom: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 8) return null;
  const texte = encodeURIComponent(
    `Bonjour ${nom}, merci de votre intérêt pour l'ouverture d'un compte BRVM. Je suis votre partenaire habilité et je vous accompagne pour démarrer.`,
  );
  return `https://wa.me/${digits}?text=${texte}`;
}

export function isLeadStatut(v: unknown): v is LeadStatut {
  return typeof v === 'string' && (LEAD_STATUTS as string[]).includes(v);
}
