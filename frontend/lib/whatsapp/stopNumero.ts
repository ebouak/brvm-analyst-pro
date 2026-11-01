/**
 * Formes sous lesquelles un même numéro peut être stocké : « +225… » (E.164,
 * format écrit par l'appairage et par les paramètres) ou chiffres seuls
 * (ancien chemin Meta). Ne retourne que des chiffres et un « + » initial :
 * sûr à passer à un filtre PostgREST. Numéro invalide → [].
 */
export function formesNumero(tel: string | null | undefined): string[] {
  const chiffres = (tel ?? '').replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(chiffres)) return [];
  return [`+${chiffres}`, chiffres];
}
