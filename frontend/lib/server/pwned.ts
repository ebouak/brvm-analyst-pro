// Pas de `import 'server-only'` : il casse le test lancé sous Node (tsx ne
// résout pas ce module virtuel de Next). La garantie vient de `node:crypto` —
// son import fait échouer tout bundle navigateur, comme dans lib/api/keys.ts.
import { createHash } from 'node:crypto';

/**
 * Refus des mots de passe présents dans des fuites publiques (HaveIBeenPwned).
 *
 * Supabase propose ce contrôle nativement mais le réserve au plan Pro. L'API de
 * HaveIBeenPwned, elle, est publique, gratuite et sans clé : Supabase facture la
 * commodité, pas la capacité. On l'implémente donc ici.
 *
 * ── k-anonymity : le mot de passe ne quitte JAMAIS ce serveur ──
 * On calcule le SHA-1 localement, on n'envoie que ses 5 PREMIERS caractères, et
 * HIBP renvoie tous les suffixes connus commençant par ce préfixe (~800 lignes).
 * La comparaison se fait ici. HIBP ne peut donc pas savoir quel mot de passe est
 * testé — il ne voit qu'un préfixe partagé par des dizaines de milliers d'autres.
 * Ne jamais « simplifier » en envoyant le hash complet : ce serait divulguer le
 * mot de passe de l'utilisateur à un tiers.
 *
 * (SHA-1 est imposé par le protocole HIBP. Ce n'est pas un choix de stockage —
 * on ne stocke rien : c'est une clé de recherche jetable.)
 */

const HIBP_RANGE = 'https://api.pwnedpasswords.com/range/';

export interface PwnedResult {
  /** Le mot de passe apparaît dans une fuite connue. */
  pwned: boolean;
  /** Nombre d'occurrences recensées (0 si inconnu ou non compromis). */
  count: number;
  /** true si la vérification n'a pas pu aboutir (réseau, HIBP indisponible). */
  unavailable: boolean;
}

export async function isPasswordPwned(password: string): Promise<PwnedResult> {
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(`${HIBP_RANGE}${prefix}`, {
      headers: { 'Add-Padding': 'true' }, // brouille la taille de la réponse
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { pwned: false, count: 0, unavailable: true };

    const body = await res.text();
    for (const line of body.split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix === suffix) {
        const count = Number.parseInt(countStr ?? '0', 10);
        // Le padding de HIBP insère de faux suffixes avec un compte de 0 : un
        // count nul signifie « ligne de remplissage », pas « compromis ».
        if (count > 0) return { pwned: true, count, unavailable: false };
      }
    }
    return { pwned: false, count: 0, unavailable: false };
  } catch {
    // ÉCHEC OUVERT — et c'est délibéré, contrairement au captcha.
    // Si HIBP est injoignable, on laisse l'inscription se faire. Bloquer toutes
    // les inscriptions du site parce qu'un service tiers est en panne serait un
    // déni de service que nous nous infligerions nous-mêmes, pour un risque
    // (un mot de passe faible) bien moindre que celui d'une plateforme fermée.
    // Le captcha, lui, échoue fermé : sa panne n'empêche personne d'utiliser le
    // site, elle ne bloque qu'un formulaire.
    return { pwned: false, count: 0, unavailable: true };
  }
}

/** Message utilisateur : explique le refus sans jargon ni culpabilisation. */
export function pwnedMessage(count: number): string {
  const fois = new Intl.NumberFormat('fr-FR').format(count);
  return `Ce mot de passe figure dans des fuites de données publiques (${fois} fois recensé). Il est connu des attaquants : choisissez-en un autre.`;
}
