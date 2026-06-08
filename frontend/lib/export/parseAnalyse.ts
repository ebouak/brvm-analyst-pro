export interface AnalyseStructuree {
  symbole: string;
  nomComplet: string;
  date: string;
  signal: 'ACHAT' | 'NEUTRE' | 'VENTE';
  scoreConviction: number;
  sections: {
    titre: string;
    contenu: string;
    tableaux?: { headers: string[]; rows: string[][] }[];
  }[];
  recommendation: {
    signal: string;
    score: number;
    prixEntree: string;
    objectif1: string;
    objectif1Pct: string;
    objectif2: string;
    objectif2Pct: string;
    stopLoss: string;
    stopLossPct: string;
    horizon: string;
  };
  risques: string[];
  disclaimer: string;
}

export function parseReponseIA(texte: string, symbole = ''): AnalyseStructuree {
  // Extraction symbole/nom
  const headerMatch = texte.match(/📊\s*\[?([^\]—\n]+?)(?:\s*[—-]\s*([A-Z]{2,6}))?\]?/);
  const nomComplet = headerMatch?.[1]?.trim() || symbole || 'Analyse BRVM';
  const sym = headerMatch?.[2]?.trim() || symbole || 'BRVM';

  // Signal
  const signalMatch = texte.match(/Signal\s*:\s*(ACHAT|NEUTRE|VENTE|BUY|SELL|HOLD)/i);
  const rawSignal = signalMatch?.[1]?.toUpperCase() || 'NEUTRE';
  const signal = (rawSignal === 'BUY' ? 'ACHAT' : rawSignal === 'SELL' ? 'VENTE' : rawSignal === 'HOLD' ? 'NEUTRE' : rawSignal) as 'ACHAT' | 'NEUTRE' | 'VENTE';

  // Score
  const scoreMatch = texte.match(/Score[^:]*:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
  const scoreConviction = parseFloat(scoreMatch?.[1] || '5');

  // Prix
  const extract = (pattern: RegExp) => texte.match(pattern)?.[1]?.trim() || 'N/A';
  const prixEntree   = extract(/Prix d.entr[ée][^:]*:\s*([^\n(]+)/i);
  const objectif1    = extract(/Objectif\s*(?:cours\s*)?1\s*:\s*([^\n(]+)/i);
  const objectif1Pct = extract(/Objectif\s*(?:cours\s*)?1[^\n]*\(([^)]+)\)/i);
  const objectif2    = extract(/Objectif\s*(?:cours\s*)?2\s*:\s*([^\n(]+)/i);
  const objectif2Pct = extract(/Objectif\s*(?:cours\s*)?2[^\n]*\(([^)]+)\)/i);
  const stopLoss     = extract(/Stop-?loss\s*:\s*([^\n(]+)/i);
  const stopLossPct  = extract(/Stop-?loss[^\n]*\(([^)]+)\)/i);
  const horizon      = extract(/Horizon\s*:\s*([^\n]+)/i);

  // Risques
  const risquesMatch = texte.match(/(?:RISQUES?[^\n]*)\n((?:[-•*⚠]\s*[^\n]+\n?)+)/i);
  const risques = risquesMatch
    ? risquesMatch[1].split('\n').map((r) => r.replace(/^[-•*⚠]\s*/, '').trim()).filter(Boolean)
    : [];

  // Sections par emojis
  const sections: AnalyseStructuree['sections'] = [];
  const sectionRegex = /(🌍|📈|📉|🎯|⚠️)\s*([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ\s&/]+)\n([\s\S]*?)(?=(?:🌍|📈|📉|🎯|⚠️)|$)/g;
  let match;
  while ((match = sectionRegex.exec(texte)) !== null) {
    const titre = match[2].trim();
    const contenu = match[3].trim();
    sections.push({ titre, contenu, tableaux: extraireTableaux(contenu) });
  }

  // Fallback si pas de sections détectées
  if (sections.length === 0) {
    sections.push({
      titre: 'Analyse',
      contenu: texte.replace(/⚠️.*$/s, '').trim(),
      tableaux: [],
    });
  }

  const disclaimerMatch = texte.match(/⚠️[^.]*conseil[^.]*\./i);

  return {
    symbole: sym,
    nomComplet,
    date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    signal,
    scoreConviction,
    sections,
    recommendation: {
      signal, score: scoreConviction,
      prixEntree, objectif1, objectif1Pct,
      objectif2, objectif2Pct,
      stopLoss, stopLossPct, horizon,
    },
    risques,
    disclaimer: disclaimerMatch?.[0] ||
      "Ce document n'est pas un conseil en investissement. Tout investissement comporte des risques de perte en capital.",
  };
}

function extraireTableaux(texte: string): { headers: string[]; rows: string[][] }[] {
  const tableaux: { headers: string[]; rows: string[][] }[] = [];
  const lignes = texte.split('\n');
  let i = 0;

  while (i < lignes.length) {
    if (lignes[i]?.includes('|') && lignes[i].trim().startsWith('|')) {
      const headers = lignes[i].split('|').map((h) => h.trim()).filter(Boolean);
      const rows: string[][] = [];
      i++;
      if (i < lignes.length && lignes[i]?.includes('---')) i++;
      while (i < lignes.length && lignes[i]?.includes('|')) {
        rows.push(lignes[i].split('|').map((c) => c.trim()).filter(Boolean));
        i++;
      }
      if (headers.length > 0 && rows.length > 0) tableaux.push({ headers, rows });
    } else {
      i++;
    }
  }
  return tableaux;
}
