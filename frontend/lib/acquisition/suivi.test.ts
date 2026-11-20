import { describe, expect, it } from 'vitest';
import { CANAUX } from '@/lib/canaux';
import {
  SRC_INCONNU, agregerParSource, cheminSuivi, destination, doitCompter, estInscriptionRecente,
  estRobot, evenementVisite, normaliserSrc, urlInscription, urlSuivi,
} from './suivi';

const CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('normaliserSrc', () => {
  it('garde une source valide', () => {
    expect(normaliserSrc('affiche')).toBe('affiche');
    expect(normaliserSrc('delegue-inphb-l3-finance')).toBe('delegue-inphb-l3-finance');
  });
  it('met en minuscules et retire les espaces de bord', () => {
    expect(normaliserSrc('  Delegue-ESATIC-M1 ')).toBe('delegue-esatic-m1');
  });
  it('refuse tout le reste, sans tronquer ni nettoyer', () => {
    for (const v of ['', 'a b', 'é', 'x_y', 'a/b', '<script>', 'a'.repeat(41), 'delegue.inphb', '%20']) {
      expect(normaliserSrc(v)).toBe(SRC_INCONNU);
    }
    expect(normaliserSrc(undefined)).toBe(SRC_INCONNU);
    expect(normaliserSrc(null)).toBe(SRC_INCONNU);
    expect(normaliserSrc(['affiche'])).toBe(SRC_INCONNU);
  });
  it('accepte 40 caractères pile', () => {
    expect(normaliserSrc('a'.repeat(40))).toBe('a'.repeat(40));
  });
});

describe('URL de suivi', () => {
  it('construit les chemins et URL absolues', () => {
    expect(cheminSuivi('chaine', 'accueil')).toBe('/chaine?src=accueil');
    expect(urlSuivi('chaine', 'affiche')).toBe('https://www.westbourse.com/chaine?src=affiche');
    expect(urlSuivi('telegram', 'affiche')).toBe('https://www.westbourse.com/telegram?src=affiche');
    expect(urlInscription('delegue-inphb-l3')).toBe('https://www.westbourse.com/signup?src=delegue-inphb-l3');
  });
  it('une source invalide devient inconnu dans le lien', () => {
    expect(cheminSuivi('telegram', 'pas valide')).toBe('/telegram?src=inconnu');
  });
});

describe('redirection', () => {
  it('ne mène qu’à nos deux canaux', () => {
    expect(destination('chaine')).toBe(CANAUX.whatsappChaine);
    expect(destination('telegram')).toBe(CANAUX.telegram);
    expect(destination('chaine')).toMatch(/^https:\/\/whatsapp\.com\/channel\//);
    expect(destination('telegram')).toMatch(/^https:\/\/t\.me\//);
  });
  it('associe le bon événement', () => {
    expect(evenementVisite('chaine')).toBe('visite_chaine');
    expect(evenementVisite('telegram')).toBe('visite_telegram');
  });
});

describe('estRobot / doitCompter', () => {
  it('compte un navigateur, y compris intégré à une application', () => {
    expect(estRobot(CHROME)).toBe(false);
    expect(estRobot(`${CHROME} Telegram-Android/11.2`)).toBe(false);
    expect(estRobot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]')).toBe(false);
  });
  it('écarte les robots et les aperçus de lien', () => {
    for (const ua of [
      'WhatsApp/2.24.10.85 A', 'TelegramBot (like TwitterBot)', 'facebookexternalhit/1.1',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Twitterbot/1.0',
      'LinkedInBot/1.0', 'curl/8.4.0', 'python-requests/2.31', '', '   ',
    ]) expect(estRobot(ua)).toBe(true);
    expect(estRobot(null)).toBe(true);
  });
  it('GET seulement, sans préchargement', () => {
    expect(doitCompter({ methode: 'GET', userAgent: CHROME })).toBe(true);
    expect(doitCompter({ methode: 'HEAD', userAgent: CHROME })).toBe(false);
    expect(doitCompter({ methode: 'GET', userAgent: CHROME, purpose: 'prefetch' })).toBe(false);
    expect(doitCompter({ methode: 'GET', userAgent: CHROME, purpose: 'prefetch;prerender' })).toBe(false);
    expect(doitCompter({ methode: 'GET', userAgent: 'WhatsApp/2.24 A' })).toBe(false);
  });
});

describe('estInscriptionRecente', () => {
  const maintenant = new Date('2026-11-20T12:00:00Z');
  it('vrai sous 30 minutes', () => {
    expect(estInscriptionRecente('2026-11-20T11:45:00Z', maintenant)).toBe(true);
  });
  it('faux au-delà, ou sans date', () => {
    expect(estInscriptionRecente('2026-11-20T11:29:00Z', maintenant)).toBe(false);
    expect(estInscriptionRecente(null, maintenant)).toBe(false);
    expect(estInscriptionRecente('n’importe quoi', maintenant)).toBe(false);
    expect(estInscriptionRecente('2026-11-20T12:30:00Z', maintenant)).toBe(false);
  });
});

describe('agregerParSource', () => {
  it('somme par source et trie par total', () => {
    const r = agregerParSource([
      { src: 'affiche', jour: '2026-11-19', evenement: 'visite_chaine', n: 3 },
      { src: 'affiche', jour: '2026-11-20', evenement: 'visite_chaine', n: 2 },
      { src: 'affiche', jour: '2026-11-20', evenement: 'inscription', n: 1 },
      { src: 'delegue-a', jour: '2026-11-20', evenement: 'visite_telegram', n: 9 },
      { src: 'delegue-a', jour: '2026-11-20', evenement: 'autre', n: 50 },
      { src: 'zero', jour: '2026-11-20', evenement: 'visite_chaine', n: 0 },
    ]);
    expect(r).toEqual([
      { src: 'delegue-a', visitesChaine: 0, visitesTelegram: 9, inscriptions: 0, total: 9 },
      { src: 'affiche', visitesChaine: 5, visitesTelegram: 0, inscriptions: 1, total: 6 },
    ]);
  });
  it('vide reste vide', () => {
    expect(agregerParSource([])).toEqual([]);
  });
});
