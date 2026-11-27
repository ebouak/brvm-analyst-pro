/**
 * Construction déterministe et sourcée du contexte d'un épisode de crise
 * (marché, macroéconomique UEMOA, entreprises/événements). Pur, sans I/O.
 *
 * Règle : aucune cause économique n'est attribuée sans observation ou source datée.
 */
import type {
  ContexteEntreprisesEpisode,
  ContexteMacroEpisode,
  EpisodeCrise,
  VariablesMarcheEpisode,
} from './types.js';

export interface MacroRow {
  indicateur: string;
  zone: string;
  date_valeur: string;
  valeur: number;
  unite: string;
  source: string;
}

export interface NervositeRow {
  date_marche: string;
  valeur: number | null;
}

export interface EventRow {
  event_date: string;
  instrument_code: string | null;
  event_type: string | null;
  title: string;
  source: string | null;
  importance_level?: string | null;
}

export interface ActionDayMetric {
  date_marche: string;
  code: string;
  secteur: string | null;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
}

const BANQUE_CODES = new Set([
  'BBGC', 'BICB', 'BICC', 'BOAB', 'BOABF', 'BOAC', 'BOAM', 'BOAN',
  'BOAS', 'CBIBF', 'ECOC', 'ETIT', 'NSBC', 'ORGT', 'SGBC', 'SIBC',
]);

const round2 = (x: number) => Math.round(x * 100) / 100;

export function construireContexteEpisode(
  episode: EpisodeCrise,
  donnees: {
    nervosite?: readonly NervositeRow[];
    macroRows?: readonly MacroRow[];
    events?: readonly EventRow[];
    actionsWindow?: readonly ActionDayMetric[];
    volumeBaselineMoyen?: number | null;
  },
): {
  contexte_marche: VariablesMarcheEpisode;
  contexte_macro: ContexteMacroEpisode;
  contexte_entreprises: ContexteEntreprisesEpisode;
} {
  const finFenetre = episode.date_recuperation ?? episode.trajectoire_base100.at(-1)?.date ?? episode.date_creux;

  // 1. Contexte de marché (volatilité BRVM-V + largeur/banques/concentration si fournis)
  const nervDansFenetre = (donnees.nervosite ?? []).filter(
    (n) => n.date_marche >= episode.date_sommet && n.date_marche <= episode.date_creux && n.valeur != null,
  );
  const vols = nervDansFenetre.map((n) => n.valeur as number);
  const volatilite_moyenne = vols.length > 0 ? round2(vols.reduce((a, b) => a + b, 0) / vols.length) : null;
  const volatilite_max = vols.length > 0 ? round2(Math.max(...vols)) : null;

  let pct_titres_baisse_moyen: number | null = null;
  let volume_relatif_moyen: number | null = null;
  let perf_banques_pct: number | null = null;
  let concentration_sectorielle: number | null = null;

  const acts = (donnees.actionsWindow ?? []).filter(
    (a) => a.date_marche >= episode.date_sommet && a.date_marche <= episode.date_creux,
  );
  if (acts.length > 0) {
    const parDate = new Map<string, { neg: number; tot: number; vol: number }>();
    const parCode = new Map<string, { first: number; last: number; firstDate: string; lastDate: string; sec: string }>();

    for (const a of acts) {
      const d = parDate.get(a.date_marche) ?? { neg: 0, tot: 0, vol: 0 };
      if (a.variation_pct != null) {
        d.tot++;
        if (a.variation_pct < 0) d.neg++;
      }
      if (a.volume != null && a.volume > 0) d.vol += a.volume;
      parDate.set(a.date_marche, d);

      if (a.cours_jour != null && a.cours_jour > 0) {
        const cur = parCode.get(a.code);
        if (!cur) {
          parCode.set(a.code, {
            first: a.cours_jour,
            last: a.cours_jour,
            firstDate: a.date_marche,
            lastDate: a.date_marche,
            sec: a.secteur ?? (BANQUE_CODES.has(a.code) ? 'Services financiers' : 'Autre'),
          });
        } else {
          if (a.date_marche < cur.firstDate) { cur.first = a.cours_jour; cur.firstDate = a.date_marche; }
          if (a.date_marche > cur.lastDate) { cur.last = a.cours_jour; cur.lastDate = a.date_marche; }
        }
      }
    }

    const dailyPcts = [...parDate.values()].filter((x) => x.tot > 0).map((x) => (100 * x.neg) / x.tot);
    if (dailyPcts.length > 0) {
      pct_titres_baisse_moyen = round2(dailyPcts.reduce((a, b) => a + b, 0) / dailyPcts.length);
    }

    if (donnees.volumeBaselineMoyen && donnees.volumeBaselineMoyen > 0) {
      const avgVol = [...parDate.values()].reduce((s, x) => s + x.vol, 0) / parDate.size;
      volume_relatif_moyen = round2(avgVol / donnees.volumeBaselineMoyen);
    }

    const bankPerfs: number[] = [];
    const perfsBySector = new Map<string, number[]>();
    for (const [code, info] of parCode.entries()) {
      if (info.first <= 0) continue;
      const p = ((info.last / info.first) - 1) * 100;
      // Écarte les variations > ±70 % non ajustées sur une seule séance (splits anciens)
      if (Math.abs(p) > 95) continue;
      if (BANQUE_CODES.has(code)) bankPerfs.push(p);
      const list = perfsBySector.get(info.sec) ?? [];
      list.push(p);
      perfsBySector.set(info.sec, list);
    }
    if (bankPerfs.length > 0) {
      perf_banques_pct = round2(bankPerfs.reduce((a, b) => a + b, 0) / bankPerfs.length);
    }
    const secAvgs = [...perfsBySector.values()]
      .filter((xs) => xs.length >= 2)
      .map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
    if (secAvgs.length >= 2) {
      concentration_sectorielle = round2(Math.max(...secAvgs) - Math.min(...secAvgs));
    }
  }

  // 2. Contexte macroéconomique sourcé (fenêtre annuelle de l'épisode)
  const anDeb = episode.date_sommet.slice(0, 4);
  const anFin = finFenetre.slice(0, 4);
  const macroAll = donnees.macroRows ?? [];

  const tauxBceao = macroAll
    .filter((m) => m.indicateur === 'bceao_taux_directeur' && m.date_valeur <= episode.date_creux)
    .sort((a, b) => a.date_valeur.localeCompare(b.date_valeur));
  const tauxDebut =
    tauxBceao.filter((m) => m.date_valeur <= episode.date_sommet).at(-1)?.valeur ?? tauxBceao[0]?.valeur ?? null;
  const tauxFin = tauxBceao.at(-1)?.valeur ?? null;

  const pibs = macroAll.filter(
    (m) => m.indicateur === 'pib_croissance_pct' && m.zone === 'UEMOA' && m.date_valeur.slice(0, 4) >= anDeb && m.date_valeur.slice(0, 4) <= anFin,
  );
  const infls = macroAll.filter(
    (m) => m.indicateur === 'inflation_pct' && m.zone === 'UEMOA' && m.date_valeur.slice(0, 4) >= anDeb && m.date_valeur.slice(0, 4) <= anFin,
  );

  const observations = macroAll
    .filter((m) => {
      const y = m.date_valeur.slice(0, 4);
      return (m.zone === 'UEMOA' || m.indicateur === 'bceao_taux_directeur') && y >= anDeb && y <= anFin;
    })
    .slice(0, 16);

  // 3. Contexte des entreprises (événements & publications datés)
  const evWindow = (donnees.events ?? []).filter(
    (e) => e.event_date >= episode.date_sommet && e.event_date <= finFenetre,
  );
  const par_type: Record<string, number> = {};
  for (const e of evWindow) {
    const t = e.event_type ?? 'autre';
    par_type[t] = (par_type[t] ?? 0) + 1;
  }
  const faits_notables = evWindow
    .filter((e) => e.importance_level === 'high' || e.event_type === 'resultats' || e.event_type === 'notation')
    .slice(0, 8)
    .map((e) => ({
      date: e.event_date,
      code: e.instrument_code,
      type: e.event_type ?? 'autre',
      titre: e.title,
      source: e.source ?? 'BRVM',
    }));

  return {
    contexte_marche: {
      volatilite_moyenne,
      volatilite_max,
      pct_titres_baisse_moyen,
      volume_relatif_moyen,
      perf_banques_pct,
      concentration_sectorielle,
    },
    contexte_macro: {
      taux_bceao_debut_pct: tauxDebut,
      taux_bceao_fin_pct: tauxFin,
      pib_uemoa_moyen_pct: pibs.length > 0 ? round2(pibs.reduce((s, x) => s + x.valeur, 0) / pibs.length) : null,
      inflation_uemoa_moyenne_pct: infls.length > 0 ? round2(infls.reduce((s, x) => s + x.valeur, 0) / infls.length) : null,
      observations,
    },
    contexte_entreprises: {
      nb_evenements: evWindow.length,
      par_type,
      faits_notables,
    },
  };
}
