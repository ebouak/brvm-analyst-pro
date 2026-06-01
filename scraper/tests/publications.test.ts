import { describe, it, expect } from 'vitest';
import { classifyPublication } from '../src/publications/classify.js';
import { parsePublicationsTable } from '../src/publications/parser.js';
import { dedupeHash } from '../src/publications/repository.js';

describe('classifyPublication', () => {
  it('détecte états financiers IFRS', () => {
    expect(classifyPublication('Etats financiers IFRS - Exercice 2025')).toBe('etats_financiers');
  });
  it('détecte états financiers SYSCOHADA', () => {
    expect(classifyPublication('Etats financiers SYSCOHADA - Exercice 2024')).toBe('etats_financiers');
  });
  it('détecte assemblée générale', () => {
    expect(classifyPublication("Avis de convocation - Assemblée Générale Ordinaire")).toBe('ag');
  });
  it('détecte rapport trimestriel', () => {
    expect(classifyPublication("Rapport d'activités - 1er trimestre 2026")).toBe('rapport');
  });
  it('détecte rapport semestriel', () => {
    expect(classifyPublication("Rapport d'activités - 1er semestre 2025")).toBe('rapport');
  });
  it('détecte bilan', () => {
    expect(classifyPublication('Bilan semestriel du contrat de liquidité')).toBe('bilan');
  });
  it('détecte notation', () => {
    expect(classifyPublication('Notation financière - SONATEL SN')).toBe('notation');
  });
  it('défaut autre', () => {
    expect(classifyPublication('Communiqué divers')).toBe('autre');
  });
});

describe('parsePublicationsTable', () => {
  it('parse une table HTML basique', () => {
    const html = `<html><body><table>
      <tr><th>Date</th><th>Libellé</th><th></th></tr>
      <tr><td>30/04/2026</td><td>Etats financiers IFRS</td><td><a href="/pub/123.pdf">Visualiser</a></td></tr>
      <tr><td>27/04/2026</td><td>Rapport trimestriel</td><td><a href="/pub/456.pdf">Visualiser</a></td></tr>
    </table></body></html>`;
    const rows = parsePublicationsTable(html, 'https://bfin.brvm.org');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date_publication: '2026-04-30',
      libelle: 'Etats financiers IFRS',
      source_url: 'https://bfin.brvm.org/pub/123.pdf',
    });
  });

  it('ignore lignes sans date valide', () => {
    const html = `<table><tr><td>Header</td><td>Libellé</td></tr></table>`;
    expect(parsePublicationsTable(html, 'https://x')).toHaveLength(0);
  });

  it('résout URLs absolues', () => {
    const html = `<table><tr><td>01/01/2026</td><td>Test</td><td><a href="abc.pdf">V</a></td></tr></table>`;
    const rows = parsePublicationsTable(html, 'https://bfin.brvm.org/Publications.aspx');
    expect(rows[0]?.source_url).toBe('https://bfin.brvm.org/abc.pdf');
  });

  it('dédoublonne lignes identiques', () => {
    const html = `<table>
      <tr><td>01/01/2026</td><td>Doublon</td><td><a href="x">V</a></td></tr>
      <tr><td>01/01/2026</td><td>Doublon</td><td><a href="x">V</a></td></tr>
    </table>`;
    expect(parsePublicationsTable(html, 'https://x')).toHaveLength(1);
  });
});

describe('dedupeHash', () => {
  it('déterministe pour mêmes args', () => {
    const h1 = dedupeHash('SNTS', '2026-04-30', 'Etats financiers IFRS');
    const h2 = dedupeHash('SNTS', '2026-04-30', 'Etats financiers IFRS');
    expect(h1).toBe(h2);
  });
  it('différent si libellé diffère', () => {
    const h1 = dedupeHash('SNTS', '2026-04-30', 'A');
    const h2 = dedupeHash('SNTS', '2026-04-30', 'B');
    expect(h1).not.toBe(h2);
  });
});
