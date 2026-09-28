import { describe, it, expect } from 'vitest';
import { domaine, libelleSource } from './origine';

describe('libelleSource', () => {
  it('article RSS : le libellé de l’éditeur', () => {
    expect(libelleSource({ source: 'brvm', source_label: 'Sika Finance', source_type: 'rss' })).toBe('Sika Finance');
  });

  it('article Perplexity : le domaine cité, pas « Perplexity »', () => {
    expect(libelleSource({
      source: 'brvm', source_label: 'Perplexity (recherche web)', source_type: 'perplexity',
      source_url: 'https://www.financialafrik.com/2026/09/25/brvm-article',
    })).toBe('financialafrik.com · via recherche IA');
  });

  it('article Perplexity sans URL exploitable : « Recherche IA », jamais un faux éditeur', () => {
    expect(libelleSource({ source_type: 'perplexity', source_url: 'pas-une-url' })).toBe('Recherche IA');
  });

  it('libellé « brvm » ou « Inconnu » : repli sur la source, en clair', () => {
    expect(libelleSource({ source: 'brvm', source_label: 'brvm' })).toBe('BRVM');
    expect(libelleSource({ source: 'cosumaf', source_label: 'Inconnu' })).toBe('COSUMAF');
  });

  it('rien du tout : « Source »', () => {
    expect(libelleSource({})).toBe('Source');
  });
});

describe('domaine', () => {
  it('retire www. et ignore le chemin', () => {
    expect(domaine('https://www.seneplus.com/article/x')).toBe('seneplus.com');
  });
  it('URL invalide ou absente : null', () => {
    expect(domaine('nimportequoi')).toBeNull();
    expect(domaine(null)).toBeNull();
  });
});
