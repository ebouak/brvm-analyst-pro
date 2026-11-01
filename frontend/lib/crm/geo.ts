/**
 * Pays du compte — PUR. Seul le code pays ISO (en-tête `x-vercel-ip-country`) est
 * conservé : jamais l'adresse IP ni la ville. Sert à segmenter les relances.
 */
export type Continent = 'Afrique' | 'Europe' | 'Amérique du Nord' | 'Amérique du Sud' | 'Asie' | 'Océanie';

export const UEMOA = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'] as const;

const AFRIQUE: Record<string, string> = {
  DZ: 'Algérie', AO: 'Angola', BJ: 'Bénin', BW: 'Botswana', BF: 'Burkina Faso', BI: 'Burundi', CV: 'Cap-Vert', CM: 'Cameroun',
  CF: 'Centrafrique', TD: 'Tchad', KM: 'Comores', CG: 'Congo', CD: 'RD Congo', CI: "Côte d'Ivoire", DJ: 'Djibouti', EG: 'Égypte',
  GQ: 'Guinée équatoriale', ER: 'Érythrée', SZ: 'Eswatini', ET: 'Éthiopie', GA: 'Gabon', GM: 'Gambie', GH: 'Ghana', GN: 'Guinée',
  GW: 'Guinée-Bissau', KE: 'Kenya', LS: 'Lesotho', LR: 'Libéria', LY: 'Libye', MG: 'Madagascar', MW: 'Malawi', ML: 'Mali',
  MR: 'Mauritanie', MU: 'Maurice', MA: 'Maroc', MZ: 'Mozambique', NA: 'Namibie', NE: 'Niger', NG: 'Nigéria', RW: 'Rwanda',
  ST: 'Sao Tomé-et-Principe', SN: 'Sénégal', SC: 'Seychelles', SL: 'Sierra Leone', SO: 'Somalie', ZA: 'Afrique du Sud',
  SS: 'Soudan du Sud', SD: 'Soudan', TZ: 'Tanzanie', TG: 'Togo', TN: 'Tunisie', UG: 'Ouganda', ZM: 'Zambie', ZW: 'Zimbabwe',
};
export const CONTINENTS_AFRIQUE = Object.keys(AFRIQUE);

const AUTRES: Record<string, [string, Continent]> = {
  FR: ['France', 'Europe'], BE: ['Belgique', 'Europe'], CH: ['Suisse', 'Europe'], DE: ['Allemagne', 'Europe'], GB: ['Royaume-Uni', 'Europe'],
  ES: ['Espagne', 'Europe'], IT: ['Italie', 'Europe'], PT: ['Portugal', 'Europe'], NL: ['Pays-Bas', 'Europe'], LU: ['Luxembourg', 'Europe'],
  IE: ['Irlande', 'Europe'], SE: ['Suède', 'Europe'], NO: ['Norvège', 'Europe'], DK: ['Danemark', 'Europe'], FI: ['Finlande', 'Europe'],
  AT: ['Autriche', 'Europe'], PL: ['Pologne', 'Europe'], RO: ['Roumanie', 'Europe'], GR: ['Grèce', 'Europe'], RU: ['Russie', 'Europe'], TR: ['Turquie', 'Asie'],
  US: ['États-Unis', 'Amérique du Nord'], CA: ['Canada', 'Amérique du Nord'], MX: ['Mexique', 'Amérique du Nord'],
  HT: ['Haïti', 'Amérique du Nord'], GP: ['Guadeloupe', 'Amérique du Nord'], MQ: ['Martinique', 'Amérique du Nord'],
  BR: ['Brésil', 'Amérique du Sud'], AR: ['Argentine', 'Amérique du Sud'], CO: ['Colombie', 'Amérique du Sud'], CL: ['Chili', 'Amérique du Sud'], PE: ['Pérou', 'Amérique du Sud'],
  CN: ['Chine', 'Asie'], JP: ['Japon', 'Asie'], IN: ['Inde', 'Asie'], SG: ['Singapour', 'Asie'], AE: ['Émirats arabes unis', 'Asie'], SA: ['Arabie saoudite', 'Asie'],
  QA: ['Qatar', 'Asie'], LB: ['Liban', 'Asie'], IL: ['Israël', 'Asie'], KR: ['Corée du Sud', 'Asie'], HK: ['Hong Kong', 'Asie'], VN: ['Viêt Nam', 'Asie'], TH: ['Thaïlande', 'Asie'], PK: ['Pakistan', 'Asie'],
  AU: ['Australie', 'Océanie'], NZ: ['Nouvelle-Zélande', 'Océanie'], NC: ['Nouvelle-Calédonie', 'Océanie'], PF: ['Polynésie française', 'Océanie'],
};

const norm = (c: string | null | undefined) => (typeof c === 'string' ? c.trim().toUpperCase() : '');

export function continentDe(code: string | null | undefined): Continent | null {
  const c = norm(code);
  if (c in AFRIQUE) return 'Afrique';
  return AUTRES[c]?.[1] ?? null;
}

export const estUemoa = (code: string | null | undefined): boolean => (UEMOA as readonly string[]).includes(norm(code));

export function nomPays(code: string | null | undefined): string {
  const c = norm(code);
  if (!c) return '—';
  return AFRIQUE[c] ?? AUTRES[c]?.[0] ?? c;
}

/** Code pays exploitable : deux majuscules, hors valeurs sentinelles de Vercel (XX inconnu, T1 Tor). */
export function paysValide(v: string | null | undefined): string | null {
  if (typeof v !== 'string' || !/^[A-Z]{2}$/.test(v) || v === 'XX' || v === 'T1') return null;
  return v;
}

const JOUR_MS = 86_400_000;
/** Écriture au plus une fois par 24 h, sauf si le pays a changé ou n'était pas connu. */
export function doitMajPays(profil: { pays_code: string | null; pays_maj_le: string | null }, pays: string, maintenant: Date): boolean {
  if (profil.pays_code !== pays || !profil.pays_maj_le) return true;
  const t = Date.parse(profil.pays_maj_le);
  return Number.isNaN(t) || maintenant.getTime() - t >= JOUR_MS;
}
