import 'server-only';

/**
 * Vérification serveur d'un jeton Cloudflare Turnstile.
 *
 * Le widget côté navigateur ne prouve RIEN à lui seul : un robot poste
 * directement sur la route en ignorant le widget. Seule cette vérification
 * serveur, contre l'API de Cloudflare avec le SECRET, a une valeur.
 *
 * Le login utilise déjà Turnstile, mais c'est Supabase Auth qui valide le jeton
 * (secret configuré dans le tableau de bord Supabase). Nos routes maison doivent
 * donc faire la vérification elles-mêmes — d'où ce module.
 *
 * ÉCHEC FERMÉ : si `TURNSTILE_SECRET_KEY` est absente, on REFUSE. Un captcha qui
 * laisse passer quand il est mal configuré n'est pas une protection, c'est un
 * décor : il donne l'illusion d'être protégé alors que la porte est grande
 * ouverte. Mieux vaut un formulaire visiblement cassé qu'un formulaire
 * silencieusement sans défense.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult {
  ok: boolean;
  /** Message destiné à l'utilisateur (jamais de détail technique exploitable). */
  error?: string;
}

export async function verifyTurnstile(
  token: string | undefined | null,
  ip?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error(
      'turnstile: TURNSTILE_SECRET_KEY absente — la demande est refusée (échec fermé).',
    );
    return { ok: false, error: 'Protection anti-robot indisponible. Réessayez plus tard.' };
  }

  if (!token) return { ok: false, error: 'Veuillez valider le contrôle anti-robot.' };

  const form = new URLSearchParams({ secret, response: token });
  // L'IP est facultative côté Cloudflare, mais elle renforce l'analyse de risque.
  if (ip) form.set('remoteip', ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      cache: 'no-store',
    });
    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (json.success) return { ok: true };

    console.warn('turnstile: jeton rejeté', json['error-codes'] ?? []);
    return { ok: false, error: 'Contrôle anti-robot échoué. Rechargez la page et réessayez.' };
  } catch (e) {
    // Réseau indisponible : on refuse aussi. Voir « échec fermé » plus haut.
    console.error('turnstile: vérification impossible —', (e as Error).message);
    return { ok: false, error: 'Protection anti-robot indisponible. Réessayez plus tard.' };
  }
}
