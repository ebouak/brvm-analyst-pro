import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Schémas d'outils (format function-calling OpenAI). */
export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'get_action_history',
      description: "Cours de clôture récents d'une action BRVM (par code, ex. SNTS).",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Code BRVM 4 lettres' },
          days: { type: 'integer', description: 'Nombre de séances (défaut 30, max 90)' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_fundamentals',
      description: "Derniers fondamentaux d'un émetteur (CA, résultat net, capitaux propres).",
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: 'Code BRVM 4 lettres' } },
        required: ['code'],
      },
    },
  },
];

/** Exécute un outil demandé par le LLM et renvoie un résultat sérialisable. */
export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const sb = createClient();
  if (name === 'get_action_history') {
    const code = String(args.code ?? '').toUpperCase();
    const days = Math.min(Number(args.days ?? 30) || 30, 90);
    const { data } = await sb
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour, variation_pct')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(days);
    return { code, points: data ?? [] };
  }
  if (name === 'get_fundamentals') {
    const code = String(args.code ?? '').toUpperCase();
    const { data } = await sb
      .from('fundamentals')
      .select('year, revenue, net_income, equity, debt')
      .eq('code', code)
      .order('year', { ascending: false })
      .limit(3);
    return { code, fundamentals: data ?? [] };
  }
  return { error: `Outil inconnu: ${name}` };
}
