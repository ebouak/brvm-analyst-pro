// frontend/app/offre/dossier/actions.ts
'use server';
import { headers } from 'next/headers';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { etatJeton, pdfFrais, estCodeValeur } from '@/lib/crm/jetonBonus';

type Retour = { ok: true; url: string } | { ok: false; message: string };
const DUREE_URL_S = 600;
const INDISPONIBLE = 'Service momentanément indisponible. Réessayez dans un instant.';

export async function choisirDossier(jeton: string, codeBrut: string): Promise<Retour> {
  const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnue';
  const { allowed } = await checkRateLimit({ route: 'offre-dossier', ip, maxHits: 20, windowSeconds: 600 });
  if (!allowed) return { ok: false, message: 'Trop de tentatives. Réessayez dans quelques minutes.' };
  const code = String(codeBrut ?? '').toUpperCase();
  if (!/^[a-f0-9]{48}$/.test(String(jeton ?? '')) || !estCodeValeur(code)) return { ok: false, message: 'Lien invalide.' };

  const sb = getServiceClient();
  const { data: ligne, error: errLecture } = await sb
    .from('crm_actions')
    .select('id, created_at, bonus_at')
    .eq('jeton_bonus', jeton)
    .maybeSingle();
  // Échec fermé : une erreur de lecture n'est jamais traitée comme « jeton inconnu ».
  if (errLecture) return { ok: false, message: INDISPONIBLE };
  const etat = etatJeton(ligne ?? null, new Date());
  if (etat !== 'valide' || !ligne) return { ok: false, message: etat === 'utilise' ? 'Votre dossier offert a déjà été choisi.' : 'Ce lien a expiré.' };

  // Fraîcheur AVANT consommation : un dossier périmé ne coûte pas le jeton.
  const { data: objets, error: errListe } = await sb.storage.from('dossiers').list(code, { search: 'dernier.pdf' });
  if (errListe) return { ok: false, message: INDISPONIBLE };
  const maj = objets?.find((o) => o.name === 'dernier.pdf')?.updated_at ?? null;
  if (!pdfFrais(maj, new Date())) return { ok: false, message: 'Ce dossier est en cours de mise à jour. Choisissez-en un autre.' };

  // Consommation ATOMIQUE : deux clics simultanés ne donnent pas deux dossiers.
  const { data: pris, error: errPris } = await sb
    .from('crm_actions')
    .update({ bonus_code: code, bonus_at: new Date().toISOString() })
    .eq('id', ligne.id)
    .is('bonus_at', null)
    .select('id');
  if (errPris) return { ok: false, message: INDISPONIBLE };
  if (!pris || pris.length === 0) return { ok: false, message: 'Votre dossier offert a déjà été choisi.' };

  const { data: signe, error } = await sb.storage
    .from('dossiers')
    .createSignedUrl(`${code}/dernier.pdf`, DUREE_URL_S, { download: `westbourse-dossier-${code}.pdf` });
  if (error || !signe?.signedUrl) {
    // Rendre la place : l'échec est le nôtre, pas celui de la personne.
    await sb.from('crm_actions').update({ bonus_code: null, bonus_at: null }).eq('id', ligne.id);
    return { ok: false, message: 'Téléchargement momentanément impossible. Réessayez dans un instant.' };
  }
  return { ok: true, url: signe.signedUrl };
}
