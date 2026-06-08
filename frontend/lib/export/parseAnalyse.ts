export interface AnalyseStructuree {
  symbole: string;
  nomComplet: string;
  date: string;
  signal: 'ACHAT' | 'NEUTRE' | 'VENTE';
  scoreConviction: number;
  titreRapport: string;
  typeAnalyse: 'fiche' | 'screener' | 'rapport' | 'libre';
  sections: {
    titre: string;
    contenu: string;
    tableaux?: { headers: string[]; rows: string[][] }[];
  }[];
  actionsAnalysees?: ActionAnalysee[];
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

export interface ActionAnalysee {
  symbole: string;
  nom: string;
  signal: string;
  score: number;
  rsi?: number;
  prixEntree?: string;
  objectif1?: string;
  stopLoss?: string;
  horizon?: string;
  risques: string[];
  details: string;
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
  const isScreener = /screener|classement|opportunit|filtres?\s+stricts|meilleures\s+(?:actions|opportunit)/i.test(texte);
  const isRapportHebdo = /rapport\s+hebdomadaire|bilan\s+de\s+la\s+semaine/i.test(texte);
  const isFicheAction = /📌\s*\[/.test(texte) || /📊\s*\[/.test(texte) || (!!symbole && !isScreener);
  const typeAnalyse: AnalyseStructuree['typeAnalyse'] = isScreener ? 'screener' : isRapportHebdo ? 'rapport' : isFicheAction ? 'fiche' : 'libre';

  // ── Titre ──
  let titreRapport = '';
  if (isScreener) {
    titreRapport = symbole ? `Screener BRVM — ${symbole}` : 'Screener BRVM — Meilleures Opportunités';
  } else if (isRapportHebdo) {
    titreRapport = 'Rapport Hebdomadaire BRVM';
  } else {
    const headerMatch = texte.match(/[📌📊]\s*\[?([^\]—\n]+?)(?:\s*[—-]\s*([A-Z]+))?\]?/);
    titreRapport = headerMatch?.[1]?.trim() || symbole || 'Analyse BRVM';
    if (headerMatch?.[2]) symbole = headerMatch[2].trim();
  }

  // ── Signal global ──
  const signalMatch = texte.match(/Signal\s*(?:global|final)?\s*:\s*\*{0,2}(ACHAT|NEUTRE|VENTE|SURVEILLER|PRUDENCE|HOLD|BUY|SELL)/i);
  const signalBrut = signalMatch?.[1]?.toUpperCase() || 'NEUTRE';
  const signal: AnalyseStructuree['signal'] =
    signalBrut.includes('ACHAT') || signalBrut === 'BUY' ? 'ACHAT'
    : signalBrut.includes('VENTE') || signalBrut === 'SELL' ? 'VENTE'
    : 'NEUTRE';

  // ── Score global ──
  const scoreMatches = [...texte.matchAll(/Score[^:]*:\s*\*{0,2}(\d+(?:\.\d+)?)\s*\/\s*10/gi)];
  const scores = scoreMatches.map((m) => parseFloat(m[1]!));
  const scoreConviction = scores.length > 0 ? Math.max(...scores) : 5;

  // ── Prix ──
  const extract = (pattern: RegExp) => {
    const m = texte.match(pattern);
    return m?.[1]?.replace(/\*\*/g, '').trim() || 'N/A';
  };
  const prixEntree    = extract(/Prix d.entr[ée][^:]*:\s*([^\n]+)/i);
  const objectif1     = extract(/Objectif\s*(?:cours\s*)?1\s*:\s*([^\n(]+)/i);
  const objectif1Pct  = extract(/Objectif\s*(?:cours\s*)?1[^\n]*\(\+?([^)]+)\)/i);
  const objectif2     = extract(/Objectif\s*(?:cours\s*)?2\s*:\s*([^\n(]+)/i);
  const objectif2Pct  = extract(/Objectif\s*(?:cours\s*)?2[^\n]*\(\+?([^)]+)\)/i);
  const stopLoss      = extract(/Stop-?loss\s*:\s*([^\n(]+)/i);
  const stopLossPct   = extract(/Stop-?loss[^\n]*\(-?([^)]+)\)/i);
  const horizon       = extract(/Horizon\s*:\s*([^\n]+)/i);

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
    sections.push({ titre: 'Analyse', contenu: nettoyerMarkdown(texte.replace(/⚠️.*$/s, '').trim()) });
  }

  // ── Actions analysées (screener) ──
  const actionsAnalysees: ActionAnalysee[] = [];
  if (isScreener) {
    const actionRegex = /####\s*(?:\S+\s+)?(?:\d+\.\s*)?([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ][A-Za-zÀ-ÿ\s]+?)\s*\(([A-Z]{2,6})\)[^\n]*\n[\s\S]*?Score[^\n]*:\s*(\d+(?:\.\d+)?)\/10([\s\S]*?)(?=####|\n---|\n##|$)/g;
    let am: RegExpExecArray | null;
    while ((am = actionRegex.exec(texte)) !== null) {
      const nom = am[1]!.trim();
      const sym = am[2]!.trim();
      const score = parseFloat(am[3]!);
      const bloc = am[4]!;

      const rsiM  = bloc.match(/RSI\(?14\)?\s*:?\s*\**(\d+)/i);
      const prixM = bloc.match(/Prix d.entr[ée][^:]*:\s*([^\n]+)/i);
      const obj1M = bloc.match(/Objectif\s*1\s*:\s*([^\n(]+)/i);
      const slM   = bloc.match(/Stop-?loss\s*:\s*([^\n(]+)/i);
      const hM    = bloc.match(/Horizon\s*:\s*([^\n]+)/i);
      const sigM  = bloc.match(/Signal\s*:\s*\*{0,2}([^\n*]+)/i);

      const risquesBloc = bloc.match(/RISQUES[^\n]*\n([\s\S]*?)(?=\n---|\n####|$)/i);
      const risques = risquesBloc
        ? risquesBloc[1]!.split('\n').map((r) => nettoyerMarkdown(r.replace(/^[-•*]\s*/, '').trim())).filter(Boolean)
        : [];

      actionsAnalysees.push({
        symbole: sym, nom, signal: nettoyerMarkdown(sigM?.[1]?.trim() || 'NEUTRE'),
        score,
        rsi: rsiM ? parseInt(rsiM[1]!) : undefined,
        prixEntree: prixM ? nettoyerMarkdown(prixM[1]!) : undefined,
        objectif1: obj1M ? nettoyerMarkdown(obj1M[1]!) : undefined,
        stopLoss: slM ? nettoyerMarkdown(slM[1]!) : undefined,
        horizon: hM ? nettoyerMarkdown(hM[1]!) : undefined,
        risques,
        details: nettoyerMarkdown(bloc),
      });
    }
  }

  // ── Risques globaux ──
  const risquesSection = texte.match(/RISQUES?\s+SPÉCIFIQUES[^\n]*\n((?:[^\n]*\n?)+?)(?=\n---|\n##|\n📌|$)/i);
  const risques = risquesSection
    ? risquesSection[1]!.split('\n').map((r) => nettoyerMarkdown(r.replace(/^[-•*]\s*/, '').trim())).filter((r) => r.length > 3)
    : [];

  const disclaimerMatch = texte.match(/(?:⚠️\s*)?Ce n.est pas un conseil[^.]+\./i);

  return {
    symbole,
    nomComplet: titreRapport,
    titreRapport,
    typeAnalyse,
    date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
    signal,
    scoreConviction,
    sections,
    actionsAnalysees: actionsAnalysees.length > 0 ? actionsAnalysees : undefined,
    recommendation: { signal, score: scoreConviction, prixEntree, objectif1, objectif1Pct, objectif2, objectif2Pct, stopLoss, stopLossPct, horizon },
    risques,
    disclaimer: disclaimerMatch?.[0] || "Ce document n'est pas un conseil en investissement. Tout investissement comporte des risques de perte en capital.",
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
