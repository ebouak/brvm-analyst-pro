import { codeSujetValide } from '@/lib/billing/chariow/regles';

export interface DroitDossier {
  product_code: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export type AccesDossier =
  | { complet: true; motif: 'premium' | 'achete' }
  | { complet: false; motif: 'verrouille' | 'indisponible' };

function droitActif(droit: DroitDossier, maintenant: Date): boolean {
  if (droit.revoked_at) return false;
  if (!droit.expires_at) return true;
  const expiration = Date.parse(droit.expires_at);
  return Number.isFinite(expiration) && expiration > maintenant.getTime();
}

export function evaluerAccesDossier(
  code: string,
  premium: boolean,
  droits: readonly DroitDossier[],
  maintenant: Date = new Date(),
): AccesDossier {
  const normalise = codeSujetValide(code);
  if (!normalise) return { complet: false, motif: 'verrouille' };
  if (premium) return { complet: true, motif: 'premium' };
  const attendu = `dossier:${normalise}`;
  return droits.some((droit) => droit.product_code === attendu && droitActif(droit, maintenant))
    ? { complet: true, motif: 'achete' }
    : { complet: false, motif: 'verrouille' };
}
