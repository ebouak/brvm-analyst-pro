import { describe, expect, it } from 'vitest';
import {
  DUREE_URL_AFFICHE_SECONDES,
  DUREE_URL_VIDEO_SECONDES,
  dureeUrlSignee,
  filigraneUtilisateur,
  verifierRequeteVideo,
} from './videoProtection';

describe('videoProtection', () => {
  describe('dureeUrlSignee', () => {
    it('donne 15 min aux vidéos .mp4 et 5 min aux affiches .jpg', () => {
      expect(DUREE_URL_VIDEO_SECONDES).toBe(900);
      expect(DUREE_URL_AFFICHE_SECONDES).toBe(300);
      expect(dureeUrlSignee('lecon-1.mp4')).toBe(900);
      expect(dureeUrlSignee('lecon-1.jpg')).toBe(300);
    });
  });

  describe('verifierRequeteVideo', () => {
    it('accepte un lecteur vidéo same-origin pour .mp4', () => {
      const h = new Headers({
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Site': 'same-origin',
        Host: 'www.westbourse.com',
        Referer: 'https://www.westbourse.com/formations/academy/academy-niveau-1-initiation',
      });
      expect(verifierRequeteVideo(h, 'lecon-1.mp4')).toEqual({ ok: true });
    });

    it('accepte une balise img same-origin pour .jpg', () => {
      const h = new Headers({
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Site': 'same-origin',
      });
      expect(verifierRequeteVideo(h, 'lecon-1.jpg')).toEqual({ ok: true });
    });

    it('accepte les requêtes natives Safari/iOS sans Sec-Fetch ni Referer', () => {
      const h = new Headers({ Host: 'www.westbourse.com' });
      expect(verifierRequeteVideo(h, 'lecon-2.mp4')).toEqual({ ok: true });
    });

    it('accepte un Referer same-origin avec x-forwarded-host', () => {
      const h = new Headers({
        'x-forwarded-host': 'www.westbourse.com, edge.internal',
        referer: 'https://www.westbourse.com/formations/academy/academy-niveau-1-initiation?lecon=1',
      });
      expect(verifierRequeteVideo(h, 'lecon-1.mp4')).toEqual({ ok: true });
    });

    it('refuse accès direct document, scraping empty et intégration iframe/object/embed', () => {
      for (const dest of ['document', 'empty', 'iframe', 'object', 'embed', 'script']) {
        const h = new Headers({ 'Sec-Fetch-Dest': dest, 'Sec-Fetch-Site': 'none' });
        expect(verifierRequeteVideo(h, 'lecon-1.mp4')).toEqual({ ok: false, raison: 'dest' });
      }
    });

    it('refuse une incohérence type de fichier vs Sec-Fetch-Dest', () => {
      expect(verifierRequeteVideo(new Headers({ 'Sec-Fetch-Dest': 'image' }), 'lecon-1.mp4')).toEqual({
        ok: false,
        raison: 'dest',
      });
      expect(verifierRequeteVideo(new Headers({ 'Sec-Fetch-Dest': 'video' }), 'lecon-1.jpg')).toEqual({
        ok: false,
        raison: 'dest',
      });
    });

    it('refuse Sec-Fetch-Site: cross-site', () => {
      const h = new Headers({ 'Sec-Fetch-Dest': 'video', 'Sec-Fetch-Site': 'cross-site' });
      expect(verifierRequeteVideo(h, 'lecon-1.mp4')).toEqual({ ok: false, raison: 'cross-site' });
    });

    it('refuse un Referer externe ou malformé', () => {
      const hExterne = new Headers({
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Site': 'same-site',
        Host: 'www.westbourse.com',
        Referer: 'https://evil.example/page',
      });
      expect(verifierRequeteVideo(hExterne, 'lecon-1.mp4')).toEqual({ ok: false, raison: 'referer' });

      const hInvalide = new Headers({
        Host: 'www.westbourse.com',
        Referer: 'not-a-valid-url',
      });
      expect(verifierRequeteVideo(hInvalide, 'lecon-1.mp4')).toEqual({ ok: false, raison: 'referer' });
    });
  });

  describe('filigraneUtilisateur', () => {
    it('tronque userId à 8 caractères et retombe sur le nom de marque si absent', () => {
      expect(filigraneUtilisateur('12345678-abcd-ef00-9999')).toBe('WESTBOURSE · 12345678');
      expect(filigraneUtilisateur(null)).toBe('WESTBOURSE Academy');
      expect(filigraneUtilisateur('   ')).toBe('WESTBOURSE Academy');
    });
  });
});
