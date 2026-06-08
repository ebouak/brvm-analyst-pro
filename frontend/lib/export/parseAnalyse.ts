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
    let contenuBrut = texte.slice(start, end).trim();
    // Pour les screeners : tronquer avant le premier bloc action numéroté
    if (isScreener) {
      const blocIdx = contenuBrut.search(/\n\d+\.\s+[A-Z]{2,6}\s+[—–-]/);
      if (blocIdx > 0) contenuBrut = contenuBrut.slice(0, blocIdx).trim();
    }
    const tableaux = extraireTableaux(contenuBrut);
    sections.push({
      titre: sectionPositions[i]!.titre,
      contenu: nettoyerMarkdown(contenuBrut.replace(/\|[^\n]+\|(\n\|[-: |]+\|)?(\n\|[^\n]+\|)*/gm, '')),
      tableaux,
    });
  }

  if (sections.length === 0) {
    // Pour les screeners sans ## headers, extraire uniquement l'intro (avant le premier bloc numéroté)
    const introEnd = isScreener ? (texte.search(/\n\d+\.\s+[A-Z]{2,6}\s+[—–-]/) || texte.length) : texte.length;
    const introTexte = introEnd > 0 ? texte.slice(0, introEnd) : texte;
    sections.push({ titre: 'Analyse', contenu: nettoyerMarkdown(introTexte.replace(/⚠️.*$/s, '').trim()) });
  }

  // ── Actions analysées (screener) ──
  const actionsAnalysees: ActionAnalysee[] = [];
  if (isScreener) {
    const extraireAction = (sym: string, nom: string, score: number, bloc: string) => {
      const rsiM  = bloc.match(/RSI\(?14\)?\s*[à:]\s*\**(\d+)/i) ?? bloc.match(/RSI[^\d]*(\d+)/i);
      const prixM = bloc.match(/Prix d.entr[ée][^:]*:\s*([^\n(]+)/i);
      const obj1M = bloc.match(/Objectif\s*(?:cours\s*)?1\s*:\s*([^\n(]+)/i);
      const slM   = bloc.match(/Stop-?loss\s*:\s*([^\n(]+)/i);
      const hM    = bloc.match(/Horizon\s*:\s*([^\n]+)/i);
      const sigM  = bloc.match(/Signal\s*:\s*\*{0,2}([^\n*(]+)/i);
      const risquesBloc = bloc.match(/RISQUES[^\n]*\n([\s\S]*?)(?=\n\d+\.\s+[A-Z]{2,}|\n---|\n####|\nConclusion|$)/i);
      const risques = risquesBloc
        ? risquesBloc[1]!.split('\n').map((r) => nettoyerMarkdown(r.replace(/^[-•*]\s*/, '').trim())).filter((r) => r.length > 3)
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
    };

    // Format A: #### [Rank.] Full Name (CODE)
    const regexA = /####\s*(?:\d+\.\s*)?([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ][A-Za-zÀ-ÿ\s]+?)\s*\(([A-Z]{2,6})\)[^\n]*\n[\s\S]*?Score[^\n]*:\s*(\d+(?:\.\d+)?)\/10([\s\S]*?)(?=####|\n---|\n##|$)/g;
    let am: RegExpExecArray | null;
    while ((am = regexA.exec(texte)) !== null) {
      extraireAction(am[2]!.trim(), am[1]!.trim(), parseFloat(am[3]!), am[4]!);
    }

    // Format B: "N. CODE — FULL NAME\nScore de Conviction : X/10..."
    if (actionsAnalysees.length === 0) {
      const regexB = /\n\d+\.\s+([A-Z]{2,6})\s+[—–-]+\s+([^\n]+)\n([\s\S]*?)Score[^\n]*:\s*(\d+(?:\.\d+)?)\/10([\s\S]*?)(?=\n\d+\.\s+[A-Z]{2,6}\s+[—–-]|\nConclusion\s+G|\n##|$)/g;
      while ((am = regexB.exec(texte)) !== null) {
        const bloc = am[3]! + '\nScore : ' + am[4] + '/10' + am[5]!;
        extraireAction(am[1]!.trim(), am[2]!.trim(), parseFloat(am[4]!), bloc);
      }
    }

    // Format C: "### N. CODE — NAME" or "### NAME (CODE)"
    if (actionsAnalysees.length === 0) {
      const regexC = /###\s+\d+\.\s+([A-Z]{2,6})\s+[—–-]+\s+([^\n]+)\n([\s\S]*?)(?=###|\n---|\n##|$)/g;
      while ((am = regexC.exec(texte)) !== null) {
        const bloc = am[3]!;
        const scoreM = bloc.match(/Score[^\n]*:\s*(\d+(?:\.\d+)?)\/10/i);
        if (scoreM) extraireAction(am[1]!.trim(), am[2]!.trim(), parseFloat(scoreM[1]!), bloc);
      }
    }
  }

  // ── Risques globaux (uniquement si hors blocs actions) ──
  // On cherche seulement après "Conclusion" pour ne pas capturer les risques des actions individuelles
  const conclusionIdx = texte.search(/\nConclusion\s+G/i);
  const texteRisques = conclusionIdx > 0 ? texte.slice(conclusionIdx) : texte;
  const risquesSection = texteRisques.match(/RISQUES?\s+SPÉCIFIQUES[^\n]*\n((?:[^\n]+\n?){1,5})/i);
  const risques = (risquesSection && actionsAnalysees.length === 0)
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
