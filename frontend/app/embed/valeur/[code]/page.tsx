import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { parseTheme, parseLang } from '@/lib/embed/params';
import { T } from '@/lib/embed/i18n';
import EmbedFrame from '@/components/embed/EmbedFrame';
import AutoHeight from '@/components/embed/AutoHeight';

export const revalidate = 300;

interface Valeur {
  code: string;
  nom: string;
  last: {
    date_marche: string;
    cours_jour: number | null;
    variation_pct: number | null;
    volume: number | null;
  } | null;
}

/**
 * Charge une valeur — le code est VALIDÉ contre le référentiel avant toute
 * requête de marché (anti-abus : un code arbitraire ne doit pas générer de page
 * ISR ni de requête, cf. spec §4.4).
 */
async function loadValeur(codeRaw: string): Promise<Valeur | null> {
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) return null;

  const sb = createPublicClient();
  const { data: instr } = await sb
    .from('brvm_instruments')
    .select('code, designation')
    .eq('code', code)
    .eq('type', 'action')
    .maybeSingle();
  if (!instr) return null;

  const { data: rows } = await sb
    .from('brvm_actions_daily')
    .select('date_marche, cours_jour, variation_pct, volume')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1);

  return {
    code,
    nom: ((instr as { designation: string | null }).designation) ?? code,
    last: (rows?.[0] as Valeur['last']) ?? null,
  };
}

/** Titre et OG dynamiques : un widget partagé dans Slack/X affiche un aperçu réel. */
export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const v = await loadValeur(params.code);
  // `absolute` : sans lui, le template du layout racine suffixe « | WESTBOURSE »
  // et le titre se lit « … · WESTBOURSE | WESTBOURSE ».
  if (!v?.last) {
    return { title: { absolute: 'WESTBOURSE — BRVM' }, robots: { index: false } };
  }
  const cours = v.last.cours_jour?.toLocaleString('fr-FR') ?? '—';
  const varPct =
    v.last.variation_pct == null
      ? ''
      : ` ${v.last.variation_pct >= 0 ? '+' : ''}${v.last.variation_pct.toFixed(2)}%`;
  const titre = `${v.code} · ${cours} FCFA${varPct} · WESTBOURSE`;
  return {
    title: { absolute: titre },
    robots: { index: false },
    openGraph: { title: titre, description: `${v.nom} — cours BRVM en direct.` },
  };
}

export default async function EmbedValeurPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { theme?: string; lang?: string };
}) {
  const theme = parseTheme(searchParams.theme);
  const lang = parseLang(searchParams.lang);
  const v = await loadValeur(params.code);
  const up = (v?.last?.variation_pct ?? 0) >= 0;

  return (
    <EmbedFrame theme={theme} lang={lang}>
      <AutoHeight />
      {!v || !v.last ? (
        <p className="px-2 py-6 text-center text-xs opacity-70">{T[lang].indisponible}</p>
      ) : (
        <div className="px-1 py-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-semibold">{v.code}</div>
              <div className="truncate text-[11px] opacity-60">{v.nom}</div>
            </div>
            <div className="text-right">
              <div className="tabular-nums text-xl font-semibold">
                {v.last.cours_jour?.toLocaleString('fr-FR') ?? '—'}
                <span className="ml-1 text-[11px] opacity-60">FCFA</span>
              </div>
              <div className={`tabular-nums text-sm ${up ? 'text-[#3fe18b]' : 'text-[#ff6b6b]'}`}>
                {v.last.variation_pct == null
                  ? '—'
                  : `${up ? '+' : ''}${v.last.variation_pct.toFixed(2)}%`}
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[10px] opacity-60">
            <span>
              {T[lang].volume} : {v.last.volume?.toLocaleString('fr-FR') ?? '—'}
            </span>
            <span>
              {T[lang].seance} {v.last.date_marche}
            </span>
          </div>
        </div>
      )}
    </EmbedFrame>
  );
}
