import { createClient } from '@/lib/supabase/client';
import type { IntraDayPattern, PatternScore } from './database';

export interface PatternScreenerData {
  code: string;
  pattern_type: string;
  confidence_level: string;
  advisor_delta: number;
  date_marche: string;
  quality_score: number;
  explanation_fr: string;
  detected_count: number;
}

/**
 * Get pattern score for a specific code and date (for advisor enrichment)
 */
export async function getPatternScoreForAdvisor(
  code: string,
  dateMarche: string
): Promise<PatternScore | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('brvm_pattern_scores')
    .select('*')
    .eq('code', code)
    .eq('date_marche', dateMarche)
    .single();

  if (error) {
    console.error(`Error fetching pattern score for ${code} on ${dateMarche}:`, error);
    return null;
  }

  return data || null;
}

/**
 * Get latest pattern score for a code (most recent date)
 */
export async function getLatestPatternScore(code: string): Promise<PatternScore | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('brvm_pattern_scores')
    .select('*')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error(`Error fetching latest pattern score for ${code}:`, error);
    return null;
  }

  return data || null;
}

/**
 * Get all patterns for a given date, joined with their pattern scores
 */
export async function getPatternsForDate(dateMarche: string): Promise<PatternScreenerData[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('brvm_intraday_patterns')
    .select(
      `
      code,
      pattern_type,
      confidence_level,
      quality_score,
      explanation_fr,
      date_marche,
      validation_status
    `
    )
    .eq('date_marche', dateMarche)
    .eq('validation_status', 'VALID')
    .order('confidence_level', { ascending: false })
    .order('quality_score', { ascending: false });

  if (error) {
    console.error('Error fetching patterns:', error);
    return [];
  }

  // Fetch pattern scores separately for advisor delta
  const codes = [...new Set((data || []).map((p) => p.code))];
  if (codes.length === 0) return [];

  const { data: scores, error: scoresError } = await supabase
    .from('brvm_pattern_scores')
    .select('code, advisor_sub_score_delta')
    .eq('date_marche', dateMarche)
    .in('code', codes);

  if (scoresError) {
    console.error('Error fetching pattern scores:', scoresError);
  }

  const scoreMap = new Map<string, number>();
  (scores || []).forEach((s) => {
    scoreMap.set(s.code, s.advisor_sub_score_delta || 0);
  });

  // Group patterns by code to count detections per code
  const patternsByCode = new Map<string, typeof data>();
  (data || []).forEach((p) => {
    const key = p.code;
    if (!patternsByCode.has(key)) {
      patternsByCode.set(key, []);
    }
    patternsByCode.get(key)!.push(p);
  });

  // Transform data for screener display (one row per code)
  const result: PatternScreenerData[] = [];
  patternsByCode.forEach((patterns, code) => {
    // Take the first (most confident) pattern for display
    const primary = patterns[0];
    result.push({
      code,
      pattern_type: primary.pattern_type,
      confidence_level: primary.confidence_level,
      advisor_delta: scoreMap.get(code) || 0,
      date_marche: primary.date_marche,
      quality_score: primary.quality_score,
      explanation_fr: primary.explanation_fr || 'Pattern détecté',
      detected_count: patterns.length,
    });
  });

  return result;
}

/**
 * Get patterns for multiple codes (for dashboard ticker integration)
 */
export async function getPatternsByCode(
  codes: string[],
  dateMarche: string
): Promise<Record<string, PatternScreenerData[]>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('brvm_intraday_patterns')
    .select('*')
    .in('code', codes)
    .eq('date_marche', dateMarche)
    .eq('validation_status', 'VALID');

  if (error) {
    console.error('Error fetching patterns by code:', error);
    return {};
  }

  const grouped: Record<string, PatternScreenerData[]> = {};
  codes.forEach((code) => {
    grouped[code] = [];
  });

  (data || []).forEach((p) => {
    if (!grouped[p.code]) grouped[p.code] = [];
    grouped[p.code].push({
      code: p.code,
      pattern_type: p.pattern_type,
      confidence_level: p.confidence_level,
      advisor_delta: 0, // Would fetch separately if needed
      date_marche: p.date_marche,
      quality_score: p.quality_score,
      explanation_fr: p.explanation_fr || 'Pattern détecté',
      detected_count: 1,
    });
  });

  return grouped;
}

/**
 * Get pattern statistics for a given date
 */
export async function getPatternStats(dateMarche: string): Promise<{
  totalPatterns: number;
  byType: Record<string, number>;
  byConfidence: Record<string, number>;
  codesWithPatterns: number;
}> {
  const patterns = await getPatternsForDate(dateMarche);

  const byType: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  const uniqueCodes = new Set<string>();

  patterns.forEach((p) => {
    byType[p.pattern_type] = (byType[p.pattern_type] || 0) + 1;
    byConfidence[p.confidence_level] = (byConfidence[p.confidence_level] || 0) + 1;
    uniqueCodes.add(p.code);
  });

  return {
    totalPatterns: patterns.length,
    byType,
    byConfidence,
    codesWithPatterns: uniqueCodes.size,
  };
}
