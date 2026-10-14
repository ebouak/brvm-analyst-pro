import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/billing/serviceClient', () => ({ getServiceClient: () => { throw new Error('pas de base en test'); } }));
const { numerosVideo, videosDisponibles, FICHIER_VALIDE, SLUG_VALIDE } = await import('@/lib/academy/videos');

describe('vidéos des leçons', () => {
  it('ne retient que les .mp4 lecon-<n>, triés et sans doublon', () => {
    expect(numerosVideo(['lecon-2.mp4', 'lecon-1.jpg', 'lecon-1.mp4', 'lecon-10.mp4', 'lecon-2.mp4', '.emptyFolderPlaceholder'])).toEqual([1, 2, 10]);
  });

  it('refuse les noms de fichier hors gabarit (aucun chemin arbitraire signé)', () => {
    for (const mauvais of ['../secret.mp4', 'lecon-0.mp4', 'lecon-1.mp4.exe', 'lecon-1.MP4', 'lecon-100.mp4', 'autre/lecon-1.mp4', 'lecon-1.webm']) {
      expect(FICHIER_VALIDE.test(mauvais)).toBe(false);
    }
    expect(FICHIER_VALIDE.test('lecon-1.jpg')).toBe(true);
  });

  it('refuse les slugs qui sortiraient du dossier du cours', () => {
    for (const mauvais of ['../dossiers', 'a/b', '', 'Academy', '-x']) expect(SLUG_VALIDE.test(mauvais)).toBe(false);
    expect(SLUG_VALIDE.test('academy-niveau-1-initiation')).toBe(true);
  });

  it('stockage indisponible : aucune vidéo annoncée, pas de lecteur cassé', async () => {
    await expect(videosDisponibles('academy-niveau-1-initiation')).resolves.toEqual([]);
  });
});
