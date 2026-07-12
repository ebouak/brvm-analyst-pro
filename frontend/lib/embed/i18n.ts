import type { EmbedLang } from './params';

/**
 * Libellés des widgets embarquables. Map simple — pas de bibliothèque i18n
 * (YAGNI : 6 clés, et ce n'est pas l'i18n du site, seulement des widgets).
 */
export const T: Record<EmbedLang, Record<string, string>> = {
  fr: {
    variation: 'Variation',
    volume: 'Volume',
    cours: 'Cours',
    indisponible: 'Données indisponibles',
    seance: 'Séance',
    donnees: 'Données',
  },
  en: {
    variation: 'Change',
    volume: 'Volume',
    cours: 'Price',
    indisponible: 'Data unavailable',
    seance: 'Session',
    donnees: 'Data',
  },
};
