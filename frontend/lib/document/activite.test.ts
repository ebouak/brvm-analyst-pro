import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import secteurs from '@/lib/brvmSectors.json';
import { activiteDe, photoActivite } from './activite';

const SECTEURS = secteurs as Record<string, string | { secteur: string }>;
const secteurDe = (v: string | { secteur: string }) => (typeof v === 'string' ? v : v.secteur);

describe('photo d’activité', () => {
  it('chaque société cotée a une activité et une photo existante', () => {
    for (const [code, v] of Object.entries(SECTEURS)) {
      const p = photoActivite(code, secteurDe(v));
      expect(p, code).not.toBeNull();
      expect(existsSync(path.join(process.cwd(), 'public', p!.fichier)), p!.fichier).toBe(true);
      expect(p!.credit).toMatch(/Pexels.*sans lien avec la société/);
    }
  });
  it('le métier prime sur le secteur', () => {
    expect(activiteDe('PALC', 'Consommation de base')).toBe('plantations');
    expect(activiteDe('NTLC', 'Consommation de base')).toBe('agroalimentaire');
    expect(activiteDe('SDSC', 'Industriels')).toBe('logistique');
  });
  it('secteur inconnu : pas de photo plutôt qu’une photo au hasard', () => {
    expect(photoActivite('XXXX', 'Secteur inconnu')).toBeNull();
    expect(photoActivite('XXXX', null)).toBeNull();
  });
});
