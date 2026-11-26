/**
 * Appareil lisible à partir du user-agent déclaré — PUR.
 *
 * Volontairement grossier : système + navigateur, jamais une empreinte. Deux
 * téléphones Android sous Chrome portent le même libellé, et c'est voulu : on
 * ne cherche pas à reconnaître un appareil précis (ce serait du pistage), on
 * cherche à compter des usages manifestement distincts.
 */

export type Systeme = 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'chromeos' | 'autre';

export interface Appareil {
  systeme: Systeme;
  navigateur: string;
  /** « Chrome · Android », affiché à l'utilisateur et à l'admin. */
  libelle: string;
}

const NOMS_SYSTEME: Record<Systeme, string> = {
  android: 'Android',
  ios: 'iPhone/iPad',
  windows: 'Windows',
  mac: 'Mac',
  linux: 'Linux',
  chromeos: 'ChromeOS',
  autre: 'Système inconnu',
};

export function systemeDe(ua: string): Systeme {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/cros/i.test(ua)) return 'chromeos';
  if (/windows/i.test(ua)) return 'windows';
  if (/mac os x|macintosh/i.test(ua)) return 'mac';
  if (/linux/i.test(ua)) return 'linux';
  return 'autre';
}

/** L'ordre compte : Edge, Opera et Samsung déclarent aussi « Chrome ». */
export function navigateurDe(ua: string): string {
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/Telegram/i.test(ua)) return 'Telegram';
  if (/GSA\//.test(ua)) return 'Google';
  if (/Edg(A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Navigateur inconnu';
}

export function appareilDe(ua: string | null | undefined): Appareil {
  const s = (ua ?? '').slice(0, 400);
  if (!s.trim()) return { systeme: 'autre', navigateur: 'Navigateur inconnu', libelle: 'Appareil inconnu' };
  const systeme = systemeDe(s);
  const navigateur = navigateurDe(s);
  return { systeme, navigateur, libelle: `${navigateur} · ${NOMS_SYSTEME[systeme]}` };
}
