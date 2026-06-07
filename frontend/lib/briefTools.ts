import 'server-only';
import { createClient } from '@/lib/supabase/server';

// ── Tool definitions (OpenAI function-calling format) ────────────────────────

export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'get_market_snapshot',
      description: "Snapshot complet du marché actions BRVM : toutes les actions de la dernière séance avec cours, variation, volume, signal, secteur.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_action_detail',
      description: "Détail complet d'une action BRVM : historique de cours, signal BUY/HOLD/SELL, notation financière, dividendes, fondamentaux, publications récentes, événements.",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM (ex: SNTS, SGBC, ETIT)' },
          days: { type: 'integer', description: 'Nombre de séances historiques (défaut 30, max 260)' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_signals',
      description: "Signaux BUY/HOLD/SELL du jour pour toutes les actions ou filtrés. Inclut score, confiance, explication.",
      parameters: {
        type: 'object',
        properties: {
          signal: { type: 'string', enum: ['BUY', 'HOLD', 'SELL'], description: 'Filtrer par type (optionnel)' },
          min_confiance: { type: 'number', description: 'Confiance minimale 0-100 (optionnel)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sector_performance',
      description: "Performance par secteur BRVM : variation moyenne, volume, hausse/baisse.",
      parameters: {
        type: 'object',
        properties: {
          secteur: { type: 'string', description: 'Filtrer sur un secteur (optionnel)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_indices',
      description: "Cours et variation des indices BRVM (BRVMC, BRVM10, etc.).",
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Nombre de séances (défaut 10, max 90)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_obligations',
      description: "Marché obligataire BRVM : cours, taux, maturité des obligations cotées.",
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Nombre de séances (défaut 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dividends',
      description: "Dividendes versés : montant, ex-date, date de paiement.",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Filtrer sur une action (optionnel)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_events',
      description: "Événements de marché récents : AG, résultats, communiqués, dividendes annoncés.",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Filtrer sur une action (optionnel)' },
          limit: { type: 'integer', description: "Nombre d'événements (défaut 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_notations',
      description: "Notations financières (BloomField, GCR) avec historique d'évolution.",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Filtrer sur une action (optionnel)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_movers',
      description: "Palmarès du jour : meilleures hausses, baisses, plus gros volumes.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Nombre par catégorie (défaut 5)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_fundamentals',
      description: "Fondamentaux d'une société : CA, résultat net, capitaux propres, dette, BFR.",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM 4 lettres' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_company',
      description: "Rechercher une société BRVM par nom ou code ticker.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Nom ou code (ex: "Sonatel", "banque", "SNTS")' },
        },
        required: ['query'],
      },
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function getLastDate(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  return data?.[0]?.date_marche ?? '';
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const sb = createClient();
  const lastDate = await getLastDate(sb);

  switch (name) {

    case 'get_market_snapshot': {
      const [{ data: actions }, { data: signals }] = await Promise.all([
        sb.from('brvm_actions_daily')
          .select('code, designation, secteur, pays, cours_precedent, cours_jour, variation_pct, volume, valeur_echangee, nb_transactions')
          .eq('date_marche', lastDate)
          .order('valeur_echangee', { ascending: false }),
        sb.from('signals_daily')
          .select('code, signal, score_total, confiance')
          .eq('date_marche', lastDate),
      ]);
      const sigMap = new Map((signals ?? []).map((s) => [s.code, s]));
      return {
        date: lastDate,
        actions: (actions ?? []).map((a) => ({
          ...a,
          signal: sigMap.get(a.code)?.signal ?? null,
          score: sigMap.get(a.code)?.score_total ?? null,
          confiance: sigMap.get(a.code)?.confiance ?? null,
        })),
      };
    }

    case 'get_action_detail': {
      const code = String(args.code ?? '').toUpperCase();
      const days = Math.min(Number(args.days ?? 30) || 30, 260);
      const [
        { data: hist }, { data: instr }, { data: sig },
        { data: divs }, { data: fundsRows }, { data: pubs }, { data: evts },
      ] = await Promise.all([
        sb.from('brvm_actions_daily').select('date_marche, cours_jour, variation_pct, volume, valeur_echangee').eq('code', code).order('date_marche', { ascending: false }).limit(days),
        sb.from('brvm_instruments').select('designation, secteur, pays, shares, notation_json').eq('code', code).maybeSingle(),
        sb.from('signals_daily').select('signal, score_total, confiance, explication, score_variation, score_volume, score_rsi, bonus_tendance, penalite_liquidite').eq('code', code).order('date_marche', { ascending: false }).limit(1),
        sb.from('dividends').select('exercice, montant, devise, ex_date, payment_date').eq('code', code).order('ex_date', { ascending: false }).limit(5),
        sb.from('fundamentals').select('year, revenue, net_income, equity, debt, bfr').eq('code', code).order('year', { ascending: false }).limit(5),
        sb.from('publications').select('date_publication, libelle, type_publication').eq('code', code).order('date_publication', { ascending: false }).limit(10),
        sb.from('market_events').select('event_date, title, event_type, sentiment').eq('instrument_code', code).order('event_date', { ascending: false }).limit(10),
      ]);
      return { code, instrument: instr, signal: sig?.[0] ?? null, history: hist ?? [], dividends: divs ?? [], fundamentals: fundsRows ?? [], publications: pubs ?? [], events: evts ?? [] };
    }

    case 'get_signals': {
      let q = sb.from('signals_daily').select('code, signal, score_total, confiance, explication').eq('date_marche', lastDate).order('score_total', { ascending: false });
      if (args.signal) q = q.eq('signal', String(args.signal));
      if (args.min_confiance) q = q.gte('confiance', Number(args.min_confiance));
      const { data } = await q.limit(50);
      return { date: lastDate, signals: data ?? [] };
    }

    case 'get_sector_performance': {
      const { data: actions } = await sb.from('brvm_actions_daily').select('secteur, variation_pct, valeur_echangee').eq('date_marche', lastDate).not('secteur', 'is', null);
      const map: Record<string, { variations: number[]; volume: number; up: number; down: number }> = {};
      for (const a of actions ?? []) {
        const s = a.secteur as string;
        if (!map[s]) map[s] = { variations: [], volume: 0, up: 0, down: 0 };
        if (a.variation_pct != null) map[s].variations.push(a.variation_pct);
        map[s].volume += a.valeur_echangee ?? 0;
        if ((a.variation_pct ?? 0) > 0) map[s].up++;
        else if ((a.variation_pct ?? 0) < 0) map[s].down++;
      }
      return {
        date: lastDate,
        secteurs: Object.entries(map)
          .filter(([s]) => !args.secteur || s === String(args.secteur))
          .map(([secteur, d]) => ({
            secteur,
            variation_moyenne: d.variations.length ? +(d.variations.reduce((a, b) => a + b, 0) / d.variations.length).toFixed(2) : 0,
            volume_total: d.volume,
            hausse: d.up,
            baisse: d.down,
          }))
          .sort((a, b) => b.variation_moyenne - a.variation_moyenne),
      };
    }

    case 'get_indices': {
      const days = Math.min(Number(args.days ?? 10) || 10, 90);
      const { data } = await sb.from('brvm_indices_daily').select('code, libelle, date_marche, valeur, variation_pct').order('date_marche', { ascending: false }).limit(days * 5);
      return { indices: data ?? [] };
    }

    case 'get_obligations': {
      const days = Math.min(Number(args.days ?? 5) || 5, 30);
      const { data } = await sb.from('brvm_obligations_daily').select('code, designation, date_marche, cours_jour, taux_pct, maturite, valeur_echangee').order('date_marche', { ascending: false }).limit(days * 20);
      return { obligations: data ?? [] };
    }

    case 'get_dividends': {
      let q = sb.from('dividends').select('code, exercice, montant, devise, ex_date, payment_date').order('ex_date', { ascending: false }).limit(50);
      if (args.code) q = q.eq('code', String(args.code).toUpperCase());
      const { data } = await q;
      return { dividends: data ?? [] };
    }

    case 'get_events': {
      const limit = Math.min(Number(args.limit ?? 20) || 20, 50);
      let q = sb.from('market_events').select('instrument_code, event_date, title, summary, event_type, sentiment, source').order('event_date', { ascending: false }).limit(limit);
      if (args.code) q = q.eq('instrument_code', String(args.code).toUpperCase());
      const { data } = await q;
      return { events: data ?? [] };
    }

    case 'get_notations': {
      let q = sb.from('brvm_instruments').select('code, designation, secteur, notation_json').not('notation_json', 'is', null);
      if (args.code) q = q.eq('code', String(args.code).toUpperCase());
      const { data } = await q.order('code');
      return { notations: (data ?? []).map((r) => ({ code: r.code, designation: r.designation, secteur: r.secteur, notation: r.notation_json })) };
    }

    case 'get_top_movers': {
      const limit = Math.min(Number(args.limit ?? 5) || 5, 20);
      const { data: actions } = await sb.from('brvm_actions_daily').select('code, designation, secteur, cours_jour, variation_pct, valeur_echangee').eq('date_marche', lastDate).not('variation_pct', 'is', null);
      const sorted = [...(actions ?? [])];
      return {
        date: lastDate,
        top_hausse: [...sorted].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).slice(0, limit),
        top_baisse: [...sorted].sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).slice(0, limit),
        top_volume: [...sorted].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0)).slice(0, limit),
      };
    }

    case 'get_fundamentals': {
      const code = String(args.code ?? '').toUpperCase();
      const [{ data }, { data: instr }] = await Promise.all([
        sb.from('fundamentals').select('year, revenue, net_income, equity, debt, bfr, source_file').eq('code', code).order('year', { ascending: false }).limit(5),
        sb.from('brvm_instruments').select('designation, secteur, shares').eq('code', code).maybeSingle(),
      ]);
      return { code, instrument: instr, fundamentals: data ?? [] };
    }

    case 'search_company': {
      const query = String(args.query ?? '').toLowerCase();
      const { data } = await sb.from('brvm_instruments').select('code, designation, secteur, pays').order('code');
      return {
        results: (data ?? [])
          .filter((r) => r.code?.toLowerCase().includes(query) || r.designation?.toLowerCase().includes(query) || r.secteur?.toLowerCase().includes(query))
          .slice(0, 10),
      };
    }

    default:
      return { error: `Outil inconnu: ${name}` };
  }
}
