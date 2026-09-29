import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const symbol = params.code.toUpperCase();
  const supabase = createClient();
  const { data: scores } = await supabase.from('quant_model_scores').select('*').eq('security_id', symbol).order('score_date',{ascending:false}).limit(5);
  const { data: inst } = await supabase.from('brvm_instruments').select('code,designation,secteur,famille_comptable').eq('code', symbol).maybeSingle();
  const { data: hist } = await supabase.from('brvm_actions_daily').select('date_marche,cours_jour,volume,valeur_echangee').eq('code', symbol).order('date_marche',{ascending:false}).limit(260);
  const { data: divs } = await supabase.from('dividends').select('exercice,montant,ex_date,payment_date').eq('code', symbol).order('exercice',{ascending:false}).limit(6);
  if (!scores || scores.length===0) return NextResponse.json({ symbol, instrument: inst??null, scores: [], history: hist??[], dividends: divs??[], legalNotice: 'Score quantitatif propriétaire de Westbourse, indicatif et non constitutif d’un conseil en investissement.' });
  return NextResponse.json({ symbol, instrument: inst, latest: scores[0], history: scores, priceHistory: hist??[], dividends: divs??[], legalNotice: 'Score quantitatif propriétaire de Westbourse, indicatif et non constitutif d’un conseil en investissement.' });
}
