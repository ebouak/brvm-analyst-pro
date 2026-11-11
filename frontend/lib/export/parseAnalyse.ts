import { FINANCIAL_DISCLAIMER } from '@/lib/legal/disclaimer';

/*
 * Découpe une réponse de l'assistant IA en sections pour l'export PDF / Word.
 *
 * Conformité (audit lot B, 2026-11-11) : l'export ne porte plus de signal
 * ACHAT/VENTE, de score de conviction, de prix d'entrée, d'objectif, de
 * stop-loss ni d'horizon. Ces champs mettaient en forme une recommandation
 * d'investissement ; l'assistant n'en produit plus (lib/ai/filtreRecommandation)
 * et les routes d'export refusent un texte qui en contiendrait encore.
 * Le classement « screener » par score de conviction a disparu avec eux : une
 * sélection se présente désormais en tableau, que `sections` reprend.
 */
export interface AnalyseStructuree {
  symbole: string;
  nomComplet: string;
  date: string;
  titreRapport: string;
  typeAnalyse: 'fiche' | 'screener' | 'rapport' | 'libre';
  sections: {
    titre: string;
    contenu: string;
    tableaux?: { headers: string[]; rows: string[][] }[];
  }[];
  risques: string[];
  disclaimer: string;
}

export function nettoyerMarkdown(texte: string): string {
  return texte
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-─]{3,}$/gm, '')
    .replace(/^\*\s+/gm, '• ')
    .replace(/^    \*/gm, '  •')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

export function parseReponseIA(texte: string, symbole = ''): AnalyseStructuree {
  // ── Type de réponse ──
  const isScreener = /filtre technique|crit[èe]res techniques|classement/i.test(texte);
  const isRapportHebdo = /rapport\s+hebdomadaire|bilan\s+(?:hebdomadaire|de\s+la\s+semaine)/i.test(texte);
  const isFicheAction = !!symbole && !isScreener;
  const typeAnalyse: AnalyseStructuree['typeAnalyse'] = isScreener ? 'screener' : isRapportHebdo ? 'rapport' : isFicheAction ? 'fiche' : 'libre';

  // ── Titre ──
  let titreRapport = '';
  if (isScreener) {
    titreRapport = symbole ? `Filtre BRVM — ${symbole}` : 'Filtre BRVM — valeurs retenues';
  } else if (isRapportHebdo) {
    titreRapport = 'Bilan hebdomadaire BRVM';
  } else {
    const headerMatch = texte.match(/^##\s+\[?([^\]—\n]+?)(?:\s*[—-]\s*([A-Z]{2,6}))?\]?\s*$/m);
    titreRapport = headerMatch?.[1]?.trim() || symbole || 'Analyse BRVM';
    if (headerMatch?.[2]) symbole = headerMatch[2].trim();
  }

  // ── Sections (## et ###) ──
  const sections: AnalyseStructuree['sections'] = [];
  const sectionRegex = /^#{2,3}\s+(.+)$/gm;
  const sectionPositions: { titre: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(texte)) !== null) {
    sectionPositions.push({ titre: nettoyerMarkdown(m[1]!), start: m.index + m[0].length });
  }

  for (let i = 0; i < sectionPositions.length; i++) {
    const start = sectionPositions[i]!.start;
    const end = i + 1 < sectionPositions.length
      ? sectionPositions[i + 1]!.start - sectionPositions[i + 1]!.titre.length - 5
      : texte.length;
    const contenuBrut = texte.slice(start, end).trim();
    const tableaux = extraireTableaux(contenuBrut);
    sections.push({
      titre: sectionPositions[i]!.titre,
      contenu: nettoyerMarkdown(contenuBrut.replace(/\|[^\n]+\|(\n\|[-: |]+\|)?(\n\|[^\n]+\|)*/gm, '')),
      tableaux,
    });
  }

  if (sections.length === 0) {
    sections.push({ titre: 'Analyse', contenu: nettoyerMarkdown(texte.replace(/⚠️.*$/s, '').trim()), tableaux: extraireTableaux(texte) });
  }

  // Les points de vigilance restent une section comme les autres : les
  // extraire aussi dans `risques` les imprimait deux fois.
  const risques: string[] = [];

  return {
    symbole,
    nomComplet: titreRapport,
    titreRapport,
    typeAnalyse,
    date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    sections,
    risques,
    // Avertissement FIXE (source unique) : on ne reprend plus celui du texte.
    disclaimer: FINANCIAL_DISCLAIMER,
  };
}

function extraireTableaux(texte: string): { headers: string[]; rows: string[][] }[] {
  const tableaux: { headers: string[]; rows: string[][] }[] = [];
  const lignes = texte.split('\n');
  let i = 0;

  while (i < lignes.length) {
    const ligne = lignes[i]?.trim() ?? '';
    if (ligne.startsWith('|') && ligne.endsWith('|')) {
      const headers = ligne.split('|').map((h) => h.replace(/\*\*/g, '').trim()).filter(Boolean);
      const rows: string[][] = [];
      i++;
      if (i < lignes.length && /^\|[\s:|-]+\|/.test(lignes[i] ?? '')) i++;
      while (i < lignes.length && (lignes[i]?.trim() ?? '').startsWith('|')) {
        const cells = (lignes[i] ?? '').split('|').map((c) => c.replace(/\*\*/g, '').trim()).filter(Boolean);
        if (cells.length > 0) rows.push(cells);
        i++;
      }
      if (headers.length > 0 && rows.length > 0) tableaux.push({ headers, rows });
    } else {
      i++;
    }
  }
  return tableaux;
}
