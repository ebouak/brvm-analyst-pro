// Colonne vivante de la barre de cote : données de MARCHÉ, publiques.
// Aucune session, aucun cookie : la réponse est identique pour tous et se met
// en cache 60 s côté serveur/CDN. Appelée au premier survol d'une cellule,
// jamais au chargement de la page. Données de portefeuille : route distincte
// (/api/nav/portefeuille), privée.
import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import {
  apercuAujourdhui, apercuApprendre, apercuIdee, apercuMarche, apercuRevenus, estCodeValeur,
  type ContexteValeur, type LigneCours, type LigneDetachement,
} from '@/lib/barreDeCote';

export const runtime = 'nodejs';

const CACHE = 'public, s-maxage=60, stale-while-revalidate=120';

function reponse(corps: unknown, status = 200) {
  return NextResponse.json(corps, { status, headers: { 'Cache-Control': status === 200 ? CACHE : 'no-store' } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const r = url.searchParams.get('r') ?? '';
  const db = createPublicClient();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  try {
    switch (r) {
      case 'marche': {
        const { data: der } = await db.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
        const date = (der?.[0]?.date_marche as string | undefined) ?? null;
        if (!date) return reponse({ apercu: apercuMarche([], null) });
        const { data } = await db.from('brvm_actions_daily').select('code, variation_pct').eq('date_marche', date).range(0, 999);
        return reponse({ apercu: apercuMarche((data ?? []) as LigneCours[], date) });
      }
      case 'revenus': {
        const { data } = await db.from('dividends').select('code, ex_date').gte('ex_date', aujourdhui).order('ex_date', { ascending: true }).limit(20);
        return reponse({ apercu: apercuRevenus((data ?? []) as LigneDetachement[], aujourdhui) });
      }
      case 'idee': {
        const { data } = await db.from('hebdo_editions').select('date_edition').order('date_edition', { ascending: false }).limit(1);
        return reponse({ apercu: apercuIdee((data?.[0]?.date_edition as string | undefined) ?? null) });
      }
      case 'aujourdhui': {
        const [{ data: brief }, { data: div }] = await Promise.all([
          db.from('brief_daily').select('date_marche, tendance:data->>tendance').order('date_marche', { ascending: false }).limit(1),
          db.from('dividends').select('code, ex_date').gte('ex_date', aujourdhui).order('ex_date', { ascending: true }).limit(1),
        ]);
        const b = brief?.[0] as { date_marche: string; tendance: string | null } | undefined;
        return reponse({
          apercu: apercuAujourdhui(b ? { date: b.date_marche, tendance: b.tendance } : null, ((div?.[0] as LigneDetachement | undefined) ?? null)),
        });
      }
      case 'apprendre': {
        const { data } = await db
          .from('formations')
          .select('titre, date_evenement')
          .eq('published', true)
          .gte('date_evenement', new Date().toISOString())
          .order('date_evenement', { ascending: true })
          .limit(1);
        const f = data?.[0] as { titre: string; date_evenement: string } | undefined;
        return reponse({ apercu: apercuApprendre(f ? { titre: f.titre, date_evenement: f.date_evenement.slice(0, 10) } : null) });
      }
      case 'contexte': {
        const code = (url.searchParams.get('code') ?? '').toUpperCase();
        if (!estCodeValeur(code)) return reponse({ erreur: 'code invalide' }, 400);
        const { data } = await db.from('brvm_actions_daily').select('code, cours_jour, variation_pct').eq('code', code).order('date_marche', { ascending: false }).limit(1);
        const l = data?.[0] as { code: string; cours_jour: number | null; variation_pct: number | null } | undefined;
        if (!l) return reponse({ contexte: null });
        const c: ContexteValeur = { code: l.code, cours: l.cours_jour, variation_pct: l.variation_pct };
        return reponse({ contexte: c });
      }
      default:
        return reponse({ erreur: 'rubrique inconnue' }, 400);
    }
  } catch {
    // Le client retombe sur son lien statique : aucune donnée partielle n'est servie.
    return reponse({ erreur: 'indisponible' }, 503);
  }
}
