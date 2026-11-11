import { NextRequest } from 'next/server';
import { redacteursDisponibles, rediger } from '@/lib/server/redacteur';
import { runTool } from '@/lib/briefTools';
import { SYSTEM_PROMPT_ANALYSTE } from '@/lib/ai/prompts';
import { repondreSansRecommandation } from '@/lib/ai/reponseConforme';
import { createClient } from '@/lib/supabase/server';
import { checkFeature } from '@/lib/server/featureGate';

// Plafonds de saisie : sans eux, un appelant pouvait envoyer un contexte énorme
// et le faire payer au budget LLM.
const MAX_MESSAGES = 20;
const MAX_CHARS_MESSAGE = 4000;
const MAX_CHARS_TOTAL = 20000;

const LIQUIDITES_CODE = 'LIQUIDITES';

/**
 * Contexte portefeuille de l'utilisateur connecté (positions valorisées + P&L)
 * — injecté quand la question le concerne. Soumis à la RLS (auth.uid()).
 *
 * Il sert à DÉCRIRE le portefeuille (poids, concentration, plus-values), jamais
 * à prescrire une opération : le prompt l'interdit et le filtre de sortie
 * (lib/ai/filtreRecommandation) le vérifie (audit lot B, 2026-11-11). Le poids
 * de chaque ligne est calculé ici pour que le modèle n'ait pas à le faire.
 */
async function buildPortfolioContext(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '\n[PORTEFEUILLE] Utilisateur non connecté — impossible d\'accéder au portefeuille.';

    const { data: pos } = await supabase
      .from('portfolios_positions').select('code, quantite, prix_entree').eq('user_id', user.id);
    const rows = ((pos ?? []) as { code: string; quantite: number; prix_entree: number }[]).filter((p) => p.code !== LIQUIDITES_CODE);
    if (rows.length === 0) return '\n[PORTEFEUILLE] Aucune position enregistrée.';

    const codes = [...new Set(rows.map((r) => r.code))];
    const { data: lastDateRow } = await supabase.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const lastDate = (lastDateRow as { date_marche: string }[] | null)?.[0]?.date_marche ?? null;
    const priceByCode: Record<string, number> = {};
    if (lastDate) {
      const { data: q } = await supabase.from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate).in('code', codes);
      for (const x of (q ?? []) as { code: string; cours_jour: number | null }[]) if (x.cours_jour != null) priceByCode[x.code] = x.cours_jour;
    }

    let totalVal = 0, totalCost = 0;
    const lines = rows.map((p) => {
      const cours = priceByCode[p.code] ?? p.prix_entree;
      const valeur = p.quantite * cours, cost = p.quantite * p.prix_entree;
      totalVal += valeur; totalCost += cost;
      return { code: p.code, qte: p.quantite, pru: p.prix_entree, cours, valeur: Math.round(valeur), pnl: Math.round(valeur - cost), pnlPct: cost > 0 ? +(((valeur - cost) / cost) * 100).toFixed(1) : 0 };
    });
    const pnl = totalVal - totalCost;
    const lignes = lines.map((l) => ({ ...l, poidsPct: totalVal > 0 ? +((l.valeur / totalVal) * 100).toFixed(1) : null }));
    return `\n[PORTEFEUILLE UTILISATEUR — à décrire, aucune opération à proposer] valorisation=${Math.round(totalVal)} FCFA · capital investi=${Math.round(totalCost)} FCFA · P&L latent=${Math.round(pnl)} FCFA (${totalCost > 0 ? ((pnl / totalCost) * 100).toFixed(1) : '0'}%)\nPositions (pru = prix de revient unitaire, poidsPct = part de la valorisation): ${JSON.stringify(lignes)}`;
  } catch {
    return '';
  }
}

function mentionsPortfolio(text: string): boolean {
  return /portefeuille|portfolio|plus-?value|mes? position|mon portefeuille|ma position|r[ée]['é]?quilibr|renforcer|mes titres|mon capital/i.test(text);
}

// Réponse entière, puis au plus une réécriture : deux rédactions possibles.
export const maxDuration = 120;

// ── Détecte les codes BRVM mentionnés dans le texte ──────────────────────────

function extractCodes(text: string): string[] {
  const matches = text.toUpperCase().match(/\b[A-Z]{2,5}C?\b/g) ?? [];
  // Filtre les mots courants qui ne sont pas des codes
  const SKIP = new Set(['RSI','MACD','EMA','SMA','BUY','HOLD','SELL','BRVM','FCFA','ROE','PER']);
  /* PAS de `.slice(0, 3)` ICI. Le motif ci-dessus capture n'importe quel mot
     français de 2 à 5 lettres : sur « Faut-il acheter, vendre ou conserver ?
     (NEIC) » il rend FAUT, IL, OU, NEIC — et tronquer aux trois premiers
     jetait le seul vrai ticker, arrivé en quatrième position. L'agent
     répondait alors, à juste titre, qu'il n'avait aucune donnée sur la valeur.
     La sélection se fait plus bas, sur la correspondance EXACTE avec un code
     d'instrument ; les mots parasites n'y survivent pas. Le plafond est donc
     appliqué APRÈS validation, jamais avant. (2026-09-10)
     Borne haute large pour ne pas retomber dans le même piège, mais finie :
     une question ne déclenchera pas plus de 12 recherches. */
  return [...new Set(matches.filter((m) => !SKIP.has(m)))].slice(0, 12);
}

// ── Construit un contexte temps réel riche ────────────────────────────────────

/* Libellés d'affichage, pas les codes stockés : « BUY » lu par le modèle
   devenait « signal d'ACHAT » dans la réponse. Le champ confiance mesure la
   complétude des données, pas une probabilité de gain (audit lot B). */
const LIBELLE_SIGNAL: Record<string, string> = { BUY: 'haussier', HOLD: 'neutre', SELL: 'baissier' };

async function buildRichContext(question: string): Promise<string> {
  const parts: string[] = [];

  try {
    // Données marché obligatoires (toujours chargées)
    const [snapshot, topMovers, signals] = await Promise.all([
      runTool('get_market_snapshot', {}),
      runTool('get_top_movers', { limit: 5 }),
      runTool('get_signals', {}),
    ]);

    const snap = snapshot as { date?: string; actions?: Array<{ code: string; variation_pct: number; valeur_echangee: number; cours_jour: number; secteur: string; signal?: string }> };
    const movers = topMovers as { date?: string; top_hausse?: unknown[]; top_baisse?: unknown[]; top_volume?: unknown[] };
    const sigs = signals as { date?: string; signals?: Array<{ code: string; signal: string; score_total: number; confiance: number; explication: string }> };

    parts.push(`=== DONNÉES TEMPS RÉEL BRVM — ${snap.date ?? 'dernière séance'} ===`);
    const marche = snap.actions?.slice(0, 47).map((a) => (a.signal ? { ...a, signal: LIBELLE_SIGNAL[a.signal] ?? a.signal } : a));
    parts.push(`\n[MARCHÉ]\n${JSON.stringify(marche, null, 0)}`);
    parts.push(`\n[TOP MOVERS]\n${JSON.stringify(movers, null, 0)}`);
    const signauxLus = (sigs.signals ?? []).slice(0, 20).map(({ signal, confiance, ...reste }) => ({
      ...reste,
      signal: LIBELLE_SIGNAL[signal] ?? signal,
      completude_donnees: confiance,
    }));
    parts.push(`\n[SIGNAUX DU MOTEUR (haussier / neutre / baissier) — mesure d'indicateurs, pas une recommandation]\n${JSON.stringify(signauxLus, null, 0)}`);

    // Données spécifiques à la question (indices si demandés, obligations, etc.)
    const q = question.toLowerCase();
    const fetches: Promise<void>[] = [];

    if (q.includes('indice') || q.includes('brvm10') || q.includes('composite')) {
      fetches.push(runTool('get_indices', { days: 10 }).then((d) => {
        parts.push(`\n[INDICES]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('obligat') || q.includes('bond') || q.includes('taux')) {
      fetches.push(runTool('get_obligations', {}).then((d) => {
        parts.push(`\n[OBLIGATIONS]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('dividende') || q.includes('rendement')) {
      fetches.push(runTool('get_dividends', {}).then((d) => {
        parts.push(`\n[DIVIDENDES]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('secteur') || q.includes('sector')) {
      fetches.push(runTool('get_sector_performance', {}).then((d) => {
        parts.push(`\n[SECTEURS]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('notation') || q.includes('rating') || q.includes('bloomfield') || q.includes('gcr')) {
      fetches.push(runTool('get_notations', {}).then((d) => {
        parts.push(`\n[NOTATIONS]\n${JSON.stringify(d, null, 0)}`);
      }));
    }
    if (q.includes('événement') || q.includes('evenement') || q.includes('ag ') || q.includes('résultat')) {
      fetches.push(runTool('get_events', { limit: 20 }).then((d) => {
        parts.push(`\n[ÉVÉNEMENTS]\n${JSON.stringify(d, null, 0)}`);
      }));
    }

    /* Détail par société si un code est détecté.
       `retenus` plafonne le nombre de blocs JOINTS (donc de codes réellement
       reconnus), et non le nombre de mots examinés : c'est l'inversion qui
       manquait. Un mot parasite ne consomme plus le quota. */
    const codes = extractCodes(question);
    let retenus = 0;
    for (const code of codes) {
      fetches.push(runTool('search_company', { query: code }).then(async (found) => {
        const res = found as { results?: Array<{ code: string }> };
        /* `search_company` filtre par SOUS-CHAÎNE sur le code, la désignation
           ET le secteur, puis trie par code alphabétique — jamais par
           pertinence. Prendre results[0] à l'aveugle chargeait donc le détail
           d'un INDICE là où l'utilisateur demandait une action : le PDF du
           2026-09-10 en porte la trace, « [DÉTAIL BRVMCBASE] » sur une
           question portant sur NEIC.
           On exige désormais la correspondance EXACTE du code. À défaut, on
           préfère ne rien joindre plutôt que joindre le détail d'autre chose :
           un contexte muet se voit, un contexte faux ne se voit pas. */
        const match = res.results?.find((r) => r.code?.toUpperCase() === code.toUpperCase());
        /* Le plafond se teste ICI, dans la continuation : les recherches
           partent toutes en parallèle, un `break` dans la boucle ne gaterait
           rien. On compte les blocs RETENUS, pas les mots examinés. */
        if (match && retenus < 3) {
          retenus += 1;
          const detail = await runTool('get_action_detail', { code: match.code, days: 30 });
          parts.push(`\n[DÉTAIL ${match.code}]\n${JSON.stringify(detail, null, 0)}`);
        }
      }).catch(() => {}));
    }

    await Promise.all(fetches);
  } catch (e) {
    parts.push(`[Erreur chargement données: ${String(e)}]`);
  }

  parts.push(`\nINSTRUCTION ABSOLUE: Utilise UNIQUEMENT les données ci-dessus pour répondre. Ne jamais inventer de chiffres. Si la donnée n'est pas dans le contexte, dis-le clairement.`);
  return parts.join('\n');
}

// ── Route principale ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 0. Session obligatoire : cette route déclenche des complétions LLM payantes.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Connexion requise pour utiliser l’assistant.' }, { status: 401 });
  }

  // 1. Parser et BORNER le body AVANT toute consommation de quota.
  const body = await req.json().catch(() => null) as { messages?: Array<{ role?: unknown; content?: unknown }> } | null;
  const brut = body?.messages;
  if (!Array.isArray(brut) || brut.length === 0) {
    return Response.json({ error: 'messages requis' }, { status: 400 });
  }
  if (brut.length > MAX_MESSAGES) {
    return Response.json({ error: `Trop de messages (maximum ${MAX_MESSAGES}).` }, { status: 400 });
  }
  const clientMessages: { role: 'user' | 'assistant'; content: string }[] = [];
  let total = 0;
  for (const m of brut) {
    // Le rôle « system » n'est jamais accepté du client (injection de consignes).
    if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m.content !== 'string') {
      return Response.json({ error: 'Message invalide.' }, { status: 400 });
    }
    if (m.content.length > MAX_CHARS_MESSAGE) {
      return Response.json({ error: `Message trop long (maximum ${MAX_CHARS_MESSAGE} caractères).` }, { status: 400 });
    }
    total += m.content.length;
    clientMessages.push({ role: m.role, content: m.content });
  }
  if (total > MAX_CHARS_TOTAL) {
    return Response.json({ error: 'Conversation trop longue.' }, { status: 400 });
  }
  if (clientMessages[clientMessages.length - 1].role !== 'user') {
    return Response.json({ error: 'Le dernier message doit être une question.' }, { status: 400 });
  }

  // 2. Au moins un fournisseur configuré (cascade commune : lib/server/redacteur)
  if ((await redacteursDisponibles()).length === 0) {
    return Response.json(
      { error: 'Aucune clé IA configurée. Ajoutez DeepSeek, Gemini ou Grok dans /admin/cles-api.' },
      { status: 503 },
    );
  }

  // 2b. Garde de fonctionnalité `assistant_ia` (accès + quota journalier),
  // décomptée AVANT l'appel au LLM, comme pour le diagnostic.
  const { data: profile } = await supabase.from('profiles').select('is_premium').eq('id', user.id).single();
  const gate = await checkFeature('assistant_ia', {
    id: user.id,
    email: user.email,
    isPremium: Boolean(profile?.is_premium),
  });
  if (!gate.allowed) {
    return Response.json({ error: gate.reason }, { status: gate.status });
  }

  // 3. Charger les données temps réel BRVM + (si pertinent) le portefeuille user
  const lastQuestion = clientMessages[clientMessages.length - 1].content;
  const [marketCtx, portfolioCtx] = await Promise.all([
    buildRichContext(lastQuestion),
    mentionsPortfolio(lastQuestion) ? buildPortfolioContext() : Promise.resolve(''),
  ]);
  const ctx = marketCtx + portfolioCtx;

  // 4. Construire la conversation avec contexte données injecté
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT_ANALYSTE + '\n\n' + ctx },
    ...clientMessages.slice(-8),
  ];

  // 5. Rédaction ENTIÈRE, filtre de sortie, puis envoi.
  /* Le texte était diffusé au fil de l'eau. Un filtre de recommandation
     appliqué à la fin d'un flux arrive trop tard : la phrase « achetez,
     objectif … » a déjà été affichée. La réponse est donc rédigée en entier,
     contrôlée (lib/ai/reponseConforme : une réécriture, puis repli prudent),
     et seul un texte conforme part vers le navigateur. Le format SSE est
     conservé pour ne pas toucher au client ; des commentaires SSE (« : … »,
     ignorés par ChatInterface) gardent la connexion ouverte pendant l'attente. */
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const veille = setInterval(() => {
        try { controller.enqueue(encoder.encode(': redaction\n\n')); } catch { /* flux fermé */ }
      }, 10_000);
      try {
        const reponse = await repondreSansRecommandation(
          messages as { role: 'system' | 'user' | 'assistant'; content: string }[],
          async (m) =>
            (await rediger(m, { temperature: 0.15, maxTokens: 2500, timeoutMs: 50_000 }))?.texte ?? null,
        );
        if (!reponse) throw new Error('Aucun fournisseur IA n’a répondu.');
        if (reponse.issue !== 'conforme') {
          // Motifs seulement (codes), jamais le texte de la question.
          console.warn(`[ai/chat] recommandation détectée (${reponse.motifs.map((m) => m.code).join(', ')}) → ${reponse.issue}`);
        }
        // Découpé en morceaux pour garder l'affichage progressif du client.
        for (let i = 0; i < reponse.texte.length; i += 400) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: reponse.texte.slice(i, i + 400) })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
      } finally {
        clearInterval(veille);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
