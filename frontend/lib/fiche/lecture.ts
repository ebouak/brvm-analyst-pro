export interface EntreesLecture {
  cours: number | null; variationPct: number | null;
  ma20: number | null; ma50: number | null; ma200: number | null;
  macd: number | null; macdSignal: number | null; rsi: number | null;
  volume: number | null; volumeMoyen: number | null;
}
export interface Lecture { soutient: string[]; retient: string[]; neutres: string[] }

const f = (x: number, d: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ | /g, ' ');

/** Une seule lecture : remplace jauge, analyse technique, signal et « lecture baissière », qui se contredisaient. */
export function lectureTechnique(e: EntreesLecture): Lecture {
  const soutient: string[] = [], retient: string[] = [], neutres: string[] = [];
  if (e.variationPct != null && Math.abs(e.variationPct) >= 2) {
    const h = e.variationPct > 0;
    (h ? soutient : retient).push(`Forte ${h ? 'hausse' : 'baisse'} du jour, ${h ? '+' : '−'}${f(Math.abs(e.variationPct), 2)} %`);
  }
  if (e.cours != null && e.ma20 != null) (e.cours >= e.ma20 ? soutient : retient).push(`Cours ${e.cours >= e.ma20 ? 'au-dessus' : 'en dessous'} de sa moyenne 20 séances`);
  if (e.macd != null && e.macdSignal != null) (e.macd >= e.macdSignal ? soutient : retient).push(`MACD ${e.macd >= e.macdSignal ? 'au-dessus' : 'en dessous'} de son signal`);
  if (e.ma20 != null && e.ma50 != null && e.ma200 != null) {
    if (e.ma20 < e.ma50 && e.ma50 < e.ma200) retient.push('Moyennes 20, 50, 200 en ordre baissier');
    else if (e.ma20 > e.ma50 && e.ma50 > e.ma200) soutient.push('Moyennes 20, 50, 200 en ordre haussier');
  }
  if (e.macd != null) (e.macd >= 0 ? soutient : retient).push(`MACD ${e.macd >= 0 ? 'au-dessus de' : 'sous'} zéro`);
  if (e.volume != null && e.volumeMoyen != null && e.volumeMoyen > 0) {
    const r = e.volume / e.volumeMoyen;
    (r < 1 ? retient : soutient).push(`Volume ${r < 1 ? 'sous' : 'au-dessus de'} la moyenne (${f(r, 1)}×)`);
  }
  if (e.rsi != null) {
    const r = Math.round(e.rsi);
    if (e.rsi < 30) soutient.push(`RSI ${r}, zone de survente`);
    else if (e.rsi > 70) retient.push(`RSI ${r}, zone de surachat`);
    else neutres.push(`RSI ${r} en zone neutre`);
  }
  return { soutient, retient, neutres };
}
