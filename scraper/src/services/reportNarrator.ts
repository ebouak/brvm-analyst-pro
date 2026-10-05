/**
 * Service de narration LLM pour rapports mensuels.
 *
 * Cascade commune DeepSeek → Gemini → Grok (src/llm/redacteur.ts), puis texte
 * déterministe. Réécrit le 2026-10-05 : l'ancienne version appelait `grok-2`
 * (retiré, 404), demandait au modèle « pourquoi ces signaux ont gagné » et des
 * « opportunités d'entrée… actionnables » — une cause et un conseil qu'aucune
 * donnée ne fonde — et ses replis affirmaient en dur des faits jamais mesurés
 * (« reflètent une bonne discipline », « ont créé des mouvements de marché »).
 *
 * Désormais chaque sortie passe trois garde-fous, ceux de l'analyse hebdo :
 * aucun chiffre absent des données, aucune cause affirmée, aucun conseil.
 * Une sortie refusée fait passer au fournisseur suivant, puis au repli.
 */

import { logger } from '../logger.js';
import { rediger, type MessageLlm } from '../llm/redacteur.js';
import { assertNoCausalClaim, assertNoForeignNumber } from '../hebdo/polish.js';

export interface Signal {
  code: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  daysHeld: number;
  fundamentals?: {
    per?: number;
    pb?: number;
    graham?: number;
  };
}

export interface MarketEvent {
  title: string;
  date: string;
  impact: string;
}

export interface Sector {
  sector: string;
  avgRsi: number;
  avgScore: number;
}

export interface NarrativeOutput {
  signals: string;
  events: string;
  recommendations: string;
}

/** Clés par fournisseur. `grok` est accepté comme alias historique de `xai`. */
export interface ClesNarrateur {
  deepseek?: string;
  gemini?: string;
  xai?: string;
  grok?: string;
}

/** Nombres présents dans un texte (milliers à la française recollés). */
export function chiffresDe(texte: string): number[] {
  const n = texte.replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1');
  return (n.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
}

const CONSEILS = [
  'acheter', 'vendre', 'achetez', 'vendez', 'recommand', 'conseill', 'opportunité',
  'opportunite', 'il faut', 'devrait', 'devraient', "point d'entrée", 'point d’entrée',
];

export function sansConseil(texte: string): boolean {
  const t = texte.toLowerCase();
  return !CONSEILS.some((m) => t.includes(m));
}

const REGLES =
  "Règles absolues : n'utilise AUCUN chiffre qui ne figure pas dans les données ; " +
  "n'affirme aucune cause (pas de « grâce à », « en raison de », « porté par », « suite à ») ; " +
  'ne donne aucun conseil et ne fais aucune prévision (pas de « acheter », « vendre », ' +
  '« opportunité », « devrait ») ; si les données ne permettent pas de conclure, dis-le.';

export class ReportNarrator {
  private readonly cles: Record<string, string | undefined>;

  constructor(cles: ClesNarrateur) {
    this.cles = { deepseek: cles.deepseek, gemini: cles.gemini, xai: cles.xai ?? cles.grok };
  }

  private async rediger(consigne: string, donnees: string): Promise<string | null> {
    const chiffres = chiffresDe(donnees);
    const messages: MessageLlm[] = [
      { role: 'system', content: `Tu es analyste de marché pour la BRVM. Français professionnel. ${REGLES}` },
      { role: 'user', content: `${consigne}\n\nDONNÉES :\n${donnees}` },
    ];
    const r = await rediger(messages, async (f) => this.cles[f] ?? null, {
      temperature: 0.3,
      maxTokens: 600,
      accepter: (t) => assertNoForeignNumber(t, chiffres) && assertNoCausalClaim(t) && sansConseil(t),
      journal: ({ fournisseur, raison }) =>
        logger.warn({ provider: fournisseur, raison }, 'rapport mensuel : narration écartée — fournisseur suivant'),
    });
    return r?.texte ?? null;
  }

  /** Les meilleurs signaux du mois : ce qu'ils ont en commun dans les données. */
  async narrateSignals(topSignals: Signal[]): Promise<string> {
    if (topSignals.length === 0) return 'Aucun signal gagnant ce mois.';
    const donnees = topSignals
      .map((s) => {
        const f = s.fundamentals;
        const fond = f
          ? ` ; PER ${f.per?.toFixed(1) ?? 'N/D'}, cours/valeur comptable ${f.pb?.toFixed(2) ?? 'N/D'}, Graham ${f.graham?.toFixed(0) ?? 'N/D'} FCFA`
          : '';
        return `- ${s.code} : entrée ${s.entryPrice.toFixed(0)} FCFA, sortie ${s.exitPrice.toFixed(0)} FCFA, ${s.pnlPct.toFixed(2)} % sur ${s.daysHeld} jours${fond}`;
      })
      .join('\n');
    const texte = await this.rediger(
      'Décris en 100 à 150 mots ces meilleurs signaux du mois : rendement, durée de détention, et ce que ' +
        'leurs indicateurs fondamentaux ont en commun ou non. Un gain passé ne dit rien du suivant : ' +
        "n'explique pas pourquoi ils ont gagné.",
      donnees,
    );
    return texte ?? this.generateFallbackSignals(topSignals);
  }

  /** Les événements du mois, tels que décrits — sans réaction inventée. */
  async narrateEvents(events: MarketEvent[]): Promise<string> {
    if (events.length === 0) return 'Aucun événement majeur ce mois sur le marché BRVM.';
    const donnees = events.map((e) => `- ${e.date} : ${e.title} (${e.impact})`).join('\n');
    const texte = await this.rediger(
      'Résume en 80 à 120 mots ces événements du mois, tels qu’ils sont décrits. ' +
        "N'invente aucune réaction d'investisseurs ni aucun mouvement de cours qui ne figure pas dans les données.",
      donnees,
    );
    return texte ?? this.generateFallbackEvents(events);
  }

  /**
   * Lecture sectorielle du mois écoulé. Le champ s'appelle encore
   * `recommendations` (colonne de `monthly_reports`) mais ne recommande RIEN :
   * il décrit un classement passé.
   */
  async generateRecommendations(topSectors: Sector[]): Promise<string> {
    if (topSectors.length === 0) return 'Aucune lecture sectorielle disponible ce mois.';
    const donnees = topSectors
      .map((s) => `- ${s.sector} : RSI moyen ${s.avgRsi.toFixed(1)}, score moyen ${s.avgScore.toFixed(1)}`)
      .join('\n');
    const texte = await this.rediger(
      'Décris en 50 à 90 mots ce classement sectoriel du mois écoulé (RSI moyen, score moyen). ' +
        "Précise qu'il décrit le passé et ne constitue pas une recommandation.",
      donnees,
    );
    return texte ?? this.generateFallbackRecommendations(topSectors);
  }

  private generateFallbackSignals(signals: Signal[]): string {
    const codes = signals.map((s) => `${s.code} (+${s.pnlPct.toFixed(1)} %)`).join(', ');
    const jours = Math.round(signals.reduce((sum, s) => sum + s.daysHeld, 0) / signals.length);
    return `Meilleurs signaux ce mois : ${codes}, détenus ${jours} jours en moyenne. Un gain passé ne préjuge pas des suivants.`;
  }

  private generateFallbackEvents(events: MarketEvent[]): string {
    return `Événements du mois : ${events.map((e) => e.title).join(' ; ')}.`;
  }

  private generateFallbackRecommendations(sectors: Sector[]): string {
    const noms = sectors.map((s) => s.sector);
    return `Secteurs les mieux notés le mois écoulé : ${noms.join(', ')}. Ce classement décrit le passé ; il ne constitue pas une recommandation.`;
  }
}

export function createReportNarrator(): ReportNarrator {
  return new ReportNarrator({
    deepseek: process.env.DEEPSEEK_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    xai: process.env.XAI_API_KEY ?? process.env.GROK_API_KEY,
  });
}
