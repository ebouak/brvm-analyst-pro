/**
 * Service de narration LLM pour rapports mensuels.
 * Utilise DeepSeek comme principal, fallback sur Mistral, puis texte par défaut.
 *
 * Responsabilités:
 * - Analyser les meilleurs signaux du mois (narrative explicative)
 * - Résumer l'impact des événements de marché (dividendes, annonces, etc.)
 * - Générer des recommandations sectorielles pour le mois suivant
 * - Graceful degradation si pas de clés API configurées
 */

import { logger } from '../logger.js';

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

export class ReportNarrator {
  constructor(private apiKeys: { deepseek?: string; mistral?: string; grok?: string }) {}

  /**
   * Générer un résumé narratif des 3 meilleurs signaux du mois.
   * Explique pourquoi ces signaux ont performé.
   */
  async narrateSignals(topSignals: Signal[]): Promise<string> {
    if (topSignals.length === 0) {
      return 'Aucun signal gagnant ce mois.';
    }

    const signalsSummary = topSignals
      .map(
        (s) => `
- ${s.code}: entrée ${s.entryPrice.toFixed(0)} FCFA, sortie ${s.exitPrice.toFixed(0)} FCFA
  P&L: +${s.pnlPct.toFixed(2)}% sur ${s.daysHeld} jours
  ${s.fundamentals ? `PER=${s.fundamentals.per?.toFixed(1) || 'N/A'}, P/B=${s.fundamentals.pb?.toFixed(2) || 'N/A'}, Graham=${s.fundamentals.graham?.toFixed(0) || 'N/A'} FCFA` : ''}
`,
      )
      .join('\n');

    const prompt = `Tu es un analyste financier professionnel. Analyse ces 3 meilleurs signaux d'investissement du mois pour BRVM (Bourse Régionale UEMOA):

${signalsSummary}

Réponds en 150-200 mots français professionnel avec:
1. Pourquoi ces 3 signaux ont gagné (analyse technique + fondamentale)
2. Points communs entre ces opportunités
3. Leçons clés pour le mois prochain

Sois précis et honnête. N'invente pas de chiffres.`;

    try {
      if (this.apiKeys.deepseek) {
        return await this.callDeepSeek(prompt);
      }
      if (this.apiKeys.mistral) {
        return await this.callMistral(prompt);
      }
      if (this.apiKeys.grok) {
        return await this.callGrok(prompt);
      }
      return this.generateFallbackSignals(topSignals);
    } catch (error) {
      logger.warn({ error }, 'LLM narration failed for signals, using fallback');
      return this.generateFallbackSignals(topSignals);
    }
  }

  /**
   * Générer un résumé narratif des événements de marché.
   * Explique leur impact sur les portefeuilles.
   */
  async narrateEvents(events: MarketEvent[]): Promise<string> {
    if (events.length === 0) {
      return 'Aucun événement majeur ce mois sur le marché BRVM.';
    }

    const eventsSummary = events
      .map((e) => `- ${e.date}: ${e.title}\n  Impact: ${e.impact}`)
      .join('\n');

    const prompt = `Tu es un analyste financier. Résume l'impact de ces événements BRVM/COSUMAF sur le marché et les portefeuilles:

${eventsSummary}

Réponds en 100-150 mots français professionnel:
- Quels ont été les impacts observés?
- Comment les investisseurs ont-ils réagi?
- Quels risques à surveiller?

Sois précis et honnête.`;

    try {
      if (this.apiKeys.deepseek) {
        return await this.callDeepSeek(prompt);
      }
      if (this.apiKeys.mistral) {
        return await this.callMistral(prompt);
      }
      if (this.apiKeys.grok) {
        return await this.callGrok(prompt);
      }
      return this.generateFallbackEvents(events);
    } catch (error) {
      logger.warn({ error }, 'LLM narration failed for events, using fallback');
      return this.generateFallbackEvents(events);
    }
  }

  /**
   * Générer des recommandations sectorielles pour le mois suivant.
   */
  async generateRecommendations(topSectors: Sector[]): Promise<string> {
    if (topSectors.length === 0) {
      return 'À surveiller: tous les secteurs. Le marché se consolide.';
    }

    const sectorsSummary = topSectors
      .map((s) => `- ${s.sector}: RSI moy ${s.avgRsi.toFixed(1)}, Score ${s.avgScore.toFixed(1)}`)
      .join('\n');

    const prompt = `Tu es un analyste de marché. Basé sur la performance sectorielle du mois:

${sectorsSummary}

Quels secteurs surveiller le mois prochain? (50-100 mots français)
- Opportunités d'entrée?
- Risques à surveiller?
- Quels catalyseurs?

Sois pratique et actionnable.`;

    try {
      if (this.apiKeys.deepseek) {
        return await this.callDeepSeek(prompt);
      }
      if (this.apiKeys.mistral) {
        return await this.callMistral(prompt);
      }
      if (this.apiKeys.grok) {
        return await this.callGrok(prompt);
      }
      return this.generateFallbackRecommendations(topSectors);
    } catch (error) {
      logger.warn({ error }, 'LLM recommendations failed, using fallback');
      return this.generateFallbackRecommendations(topSectors);
    }
  }

  private async callDeepSeek(prompt: string): Promise<string> {
    if (!this.apiKeys.deepseek) throw new Error('DeepSeek API key not configured');

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKeys.deepseek}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${error}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in DeepSeek response');

    return content;
  }

  private async callMistral(prompt: string): Promise<string> {
    if (!this.apiKeys.mistral) throw new Error('Mistral API key not configured');

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKeys.mistral}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error ${response.status}: ${error}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in Mistral response');

    return content;
  }

  private async callGrok(prompt: string): Promise<string> {
    if (!this.apiKeys.grok) throw new Error('Grok API key not configured');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKeys.grok}`,
      },
      body: JSON.stringify({
        model: 'grok-2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error ${response.status}: ${error}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content in Grok response');

    return content;
  }

  private generateFallbackSignals(signals: Signal[]): string {
    const codes = signals.map((s) => `${s.code} (+${s.pnlPct.toFixed(1)}%)`).join(', ');
    const daysAvg = signals.length > 0 ? Math.round(signals.reduce((sum, s) => sum + s.daysHeld, 0) / signals.length) : 0;

    return `Meilleurs signaux ce mois: ${codes}. Ces gains sur ${daysAvg} jours en moyenne reflètent une bonne discipline de selection technique et une exécution fidèle des critères. Les signaux ont capturé les tendances dominantes du marché BRVM cette période.`;
  }

  private generateFallbackEvents(events: MarketEvent[]): string {
    const titles = events.map((e) => e.title).join(', ');
    return `Événements observés: ${titles}. Ces annonces ont créé des mouvements de marché et ont affecté les décisions d'allocation des investisseurs. L'impact net sur les portefeuilles diversifiés a été modéré.`;
  }

  private generateFallbackRecommendations(sectors: Sector[]): string {
    if (sectors.length === 0) return 'À surveiller: tous les secteurs.';
    const topSector = sectors[0];
    if (!topSector) return 'À surveiller: tous les secteurs.';
    const others = sectors.slice(1).map((s) => s.sector);
    return `Secteur fort ce mois: ${topSector.sector}. À surveiller aussi: ${others.join(', ')}. Vigilance sur les valorisations et la liquidité à mesure que le marché se consolide.`;
  }
}

export function createReportNarrator(): ReportNarrator {
  return new ReportNarrator({
    deepseek: process.env.DEEPSEEK_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    grok: process.env.GROK_API_KEY,
  });
}
