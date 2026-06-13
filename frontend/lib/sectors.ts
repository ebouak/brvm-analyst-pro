export interface SectorPerf {
  secteur: string;
  count: number;
  coursMean: number | null;
  varDay: number | null;
  var5d: number | null;
  var30d: number | null;
  var90d: number | null;
  var1y: number | null;
  volumeDay: number;
  sparkline30d: number[]; // perf cumulée j-30 → j (index 0 = le plus ancien)
  topHausse: { code: string; pct: number } | null;
  topBaisse: { code: string; pct: number } | null;
  hausses: number;
  baisses: number;
}

type Row = {
  code: string;
  secteur: string | null;
  date_marche: string;
  cours_jour: number | null;
  variation_pct: number | null;
  valeur_echangee: number | null;
};

/** Retourne le cours le plus proche d'une date passée pour un code donné. */
function closestBefore(
  sortedRows: Row[], // triées date_marche asc pour ce code
  targetDate: string,
): number | null {
  let result: number | null = null;
  for (const r of sortedRows) {
    if (r.date_marche <= targetDate && r.cours_jour != null) {
      result = r.cours_jour;
    }
  }
  return result;
}

/** Variation (%) entre deux cours. Null si l'un est null ou 0. */
function varPct(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

/** Soustrait N jours calendaires d'une date ISO. */
function subtractDays(isoDate: string, n: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function aggregateBySector(rows: Row[], lastDate: string): SectorPerf[] {
  // Grouper par secteur puis par code
  const bySector = new Map<string, Map<string, Row[]>>();

  for (const row of rows) {
    const sec = row.secteur ?? 'Inconnu';
    if (!bySector.has(sec)) bySector.set(sec, new Map());
    const byCode = bySector.get(sec)!;
    if (!byCode.has(row.code)) byCode.set(row.code, []);
    byCode.get(row.code)!.push(row);
  }

  // Dater les points de référence
  const ref5d = subtractDays(lastDate, 5);
  const ref30d = subtractDays(lastDate, 30);
  const ref90d = subtractDays(lastDate, 90);
  const ref1y = subtractDays(lastDate, 365);

  const results: SectorPerf[] = [];

  for (const [secteur, byCode] of bySector) {
    // Trier chaque code par date
    for (const codeRows of byCode.values()) {
      codeRows.sort((a, b) => a.date_marche.localeCompare(b.date_marche));
    }

    const codes = Array.from(byCode.keys());
    const count = codes.length;

    // Moyennes simples des variations par période
    const dayVars: number[] = [];
    const var5ds: number[] = [];
    const var30ds: number[] = [];
    const var90ds: number[] = [];
    const var1ys: number[] = [];
    const coursToday: number[] = [];
    let volumeDay = 0;
    let hausses = 0;
    let baisses = 0;
    let topHausse: { code: string; pct: number } | null = null;
    let topBaisse: { code: string; pct: number } | null = null;

    for (const code of codes) {
      const codeRows = byCode.get(code)!;
      const todayRow = codeRows.find((r) => r.date_marche === lastDate);
      const closeToday = todayRow?.cours_jour ?? closestBefore(codeRows, lastDate);

      if (closeToday != null) coursToday.push(closeToday);

      // Variation jour
      if (todayRow?.variation_pct != null) {
        const v = todayRow.variation_pct;
        dayVars.push(v);
        if (v > 0) {
          hausses++;
          if (!topHausse || v > topHausse.pct) topHausse = { code, pct: v };
        } else if (v < 0) {
          baisses++;
          if (!topBaisse || v < topBaisse.pct) topBaisse = { code, pct: v };
        }
      }

      // Volume jour
      if (todayRow?.valeur_echangee != null) volumeDay += todayRow.valeur_echangee;

      // Variations sur périodes
      const close5d = closestBefore(codeRows, ref5d);
      const close30d = closestBefore(codeRows, ref30d);
      const close90d = closestBefore(codeRows, ref90d);
      const close1y = closestBefore(codeRows, ref1y);

      const v5 = varPct(close5d, closeToday);
      const v30 = varPct(close30d, closeToday);
      const v90 = varPct(close90d, closeToday);
      const v1y = varPct(close1y, closeToday);

      if (v5 != null) var5ds.push(v5);
      if (v30 != null) var30ds.push(v30);
      if (v90 != null) var90ds.push(v90);
      if (v1y != null) var1ys.push(v1y);
    }

    const avg = (arr: number[]): number | null =>
      arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

    // Sparkline 30j : perf cumulée quotidienne du secteur sur les 30 derniers jours
    // On récupère toutes les dates distinctes dans la fenêtre
    const allDates = Array.from(
      new Set(
        rows
          .filter((r) => r.date_marche >= ref30d && r.date_marche <= lastDate)
          .map((r) => r.date_marche),
      ),
    ).sort();

    const sparkline30d: number[] = [];
    for (const date of allDates) {
      const dayPerfs: number[] = [];
      for (const code of codes) {
        const codeRows = byCode.get(code)!;
        const close30dRef = closestBefore(codeRows, ref30d);
        const closeAtDate = closestBefore(codeRows, date);
        const v = varPct(close30dRef, closeAtDate);
        if (v != null) dayPerfs.push(v);
      }
      if (dayPerfs.length > 0) {
        sparkline30d.push(avg(dayPerfs)!);
      }
    }

    results.push({
      secteur,
      count,
      coursMean: avg(coursToday),
      varDay: avg(dayVars),
      var5d: avg(var5ds),
      var30d: avg(var30ds),
      var90d: avg(var90ds),
      var1y: avg(var1ys),
      volumeDay,
      sparkline30d,
      topHausse,
      topBaisse,
      hausses,
      baisses,
    });
  }

  // Tri par défaut : varDay desc
  results.sort((a, b) => (b.varDay ?? -Infinity) - (a.varDay ?? -Infinity));

  return results;
}

export function quadrant(
  var30: number | null,
  var90: number | null,
): 'leading' | 'improving' | 'weakening' | 'lagging' | null {
  if (var30 == null || var90 == null) return null;
  if (var30 >= 0 && var90 >= 0) return 'leading';
  if (var30 >= 0 && var90 < 0) return 'improving';
  if (var30 < 0 && var90 >= 0) return 'weakening';
  return 'lagging';
}
