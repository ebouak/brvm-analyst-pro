/**
 * Extraction et reconstruction des champs cachés ASP.NET WebForms.
 *
 * Toute page WebForms expose des <input type="hidden"> dynamiques :
 *   __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION,
 *   __EVENTTARGET, __EVENTARGUMENT, __LASTFOCUS, __VIEWSTATEENCRYPTED ...
 *
 * Pour effectuer un postback valide (clic sur un bouton, changement de date,
 * pagination), il faut RENVOYER ces valeurs exactement telles que reçues,
 * en y ajoutant les champs propres au contrôle déclencheur (cf. §11).
 */
import * as cheerio from 'cheerio';

/** Champs cachés standard d'une page WebForms. */
export interface AspNetState {
  /** Tous les hidden inputs (__VIEWSTATE, etc.) sous forme clé->valeur. */
  hidden: Record<string, string>;
}

/**
 * Lit tous les <input type="hidden"> d'une page.
 * On ratisse large (pas seulement __VIEWSTATE) car certains contrôles
 * ajoutent leurs propres hidden requis par le postback.
 */
export function extractAspNetState(html: string): AspNetState {
  const $ = cheerio.load(html);
  const hidden: Record<string, string> = {};

  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    if (!name) return;
    hidden[name] = $(el).attr('value') ?? '';
  });

  return { hidden };
}

/**
 * Construit le corps d'un postback.
 * @param state état lu sur la page précédente (contient __VIEWSTATE & co)
 * @param eventTarget nom du contrôle déclencheur (UniqueID ASP.NET), ex:
 *        "ctl00$ContentPlaceHolder1$btnRechercher"
 * @param eventArgument argument optionnel (souvent "")
 * @param extra champs additionnels (valeurs de formulaire, dates, dropdowns…)
 */
export function buildPostback(
  state: AspNetState,
  eventTarget: string,
  eventArgument = '',
  extra: Record<string, string> = {},
): Record<string, string> {
  // On repart de TOUS les hidden reçus pour ne rien perdre.
  const form: Record<string, string> = { ...state.hidden };

  // Champs de pilotage du postback.
  form['__EVENTTARGET'] = eventTarget;
  form['__EVENTARGUMENT'] = eventArgument;
  if (!('__LASTFOCUS' in form)) form['__LASTFOCUS'] = '';

  // Champs métier (dates, listes déroulantes, boutons submit…).
  Object.assign(form, extra);

  return form;
}

/**
 * Heuristique de détection "suis-je encore connecté ?".
 * Si la page ramène vers un formulaire de login (champ password présent,
 * ou texte caractéristique), la session est probablement expirée.
 */
export function looksLikeLoginPage(html: string): boolean {
  const $ = cheerio.load(html);
  const hasPassword = $('input[type="password"]').length > 0;
  const text = $('body').text().toLowerCase();
  const loginHints =
    /(connexion|s'identifier|identifiant|mot de passe|se connecter|login)/.test(
      text,
    );
  return hasPassword && loginHints;
}
