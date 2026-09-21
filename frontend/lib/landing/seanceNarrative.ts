/**
 * « Ce que dit la séance » — texte DÉRIVÉ des métriques, fonction pure.
 *
 * Règle du projet (lib/narrative.ts) : pas de texte analytique inventé. Chaque
 * phrase ci-dessous est une fonction des chiffres qu'on lui donne ; « À
 * surveiller » ne nomme que ce qui est mesuré (le secteur le plus faible, le
 * plus fort, la valeur la plus échangée) — jamais des « publications à venir »
 * ou des « opportunités de rebond » que rien en base ne fonde.
 */

export interface SeanceMetrics {
  nbActions: number;
  hausses: number;
  baisses: number;
  inchangees: number;
  brvmCVar: number | null;
  secteurs: { secteur: string; variation_pct: number; nb: number }[];
  topHausse: { code: string; variation: number } | null;
  topBaisse: { code: string; variation: number } | null;
  plusEchangee: { code: string; valeur: number } | null;
}

export interface SeanceNarrative {
  /** Sous-titre du bloc, une phrase. */
  sousTitre: string;
  /** Phrase d'accroche en gras. */
  accroche: string;
  /** Développement, une à deux phrases. */
  corps: string;
  /** Points factuels « à surveiller » (0 à 3). */
  surveiller: string[];
}

const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const pl = (n: number, s: string, p: string) => (n > 1 ? p : s);

export function orientation(m: SeanceMetrics): 'hausse' | 'baisse' | 'equilibre' | 'vide' {
  if (m.nbActions === 0) return 'vide';
  if (m.baisses > m.hausses) return 'baisse';
  if (m.hausses > m.baisses) return 'hausse';
  return 'equilibre';
}

export function seanceNarrative(m: SeanceMetrics): SeanceNarrative {
  const o = orientation(m);
  if (o === 'vide') {
    return { sousTitre: 'Aucune séance en base.', accroche: 'Aucune donnée de séance disponible.', corps: 'La page le dit plutôt que d’afficher des cours périmés.', surveiller: [] };
  }
  const sousTitre =
    o === 'baisse' ? `${m.baisses} ${pl(m.baisses, 'valeur recule', 'valeurs reculent')}, ${m.hausses} ${pl(m.hausses, 'progresse', 'progressent')}. La séance reste orientée à la baisse.`
    : o === 'hausse' ? `${m.hausses} ${pl(m.hausses, 'valeur progresse', 'valeurs progressent')}, ${m.baisses} ${pl(m.baisses, 'recule', 'reculent')}. La séance est orientée à la hausse.`
    : `${m.hausses} ${pl(m.hausses, 'valeur progresse', 'valeurs progressent')} et autant reculent. Séance sans tendance nette.`;

  const accroche =
    o === 'baisse' ? `La baisse domine aujourd’hui : ${m.baisses} valeurs reculent contre ${m.hausses} en hausse.`
    : o === 'hausse' ? `La hausse domine aujourd’hui : ${m.hausses} valeurs progressent contre ${m.baisses} en baisse.`
    : `Séance équilibrée : ${m.hausses} valeurs en hausse, ${m.baisses} en baisse.`;

  const tries = [...m.secteurs].filter((s) => s.nb >= 2).sort((a, b) => a.variation_pct - b.variation_pct);
  const faibles = tries.filter((s) => s.variation_pct < 0).slice(0, 2);
  const forts = tries.filter((s) => s.variation_pct > 0).slice(-2).reverse();
  const idx = m.brvmCVar != null ? `L’indice composite ${m.brvmCVar >= 0 ? 'gagne' : 'cède'} ${pct(m.brvmCVar).replace(/^[+−]/, '')}` : null;
  const parts: string[] = [];
  if (idx) parts.push(idx);
  if (o === 'baisse' && faibles.length) parts.push(`${idx ? 'le' : 'Le'} repli est plus marqué sur ${faibles.map((s) => `${s.secteur.toLowerCase()} (${pct(s.variation_pct)})`).join(' et ')}`);
  else if (o === 'hausse' && forts.length) parts.push(`${idx ? 'la' : 'La'} hausse est portée par ${forts.map((s) => `${s.secteur.toLowerCase()} (${pct(s.variation_pct)})`).join(' et ')}`);
  else if (faibles.length || forts.length) parts.push(`${idx ? 'les' : 'Les'} secteurs divergent : ${[...forts, ...faibles].map((s) => `${s.secteur.toLowerCase()} ${pct(s.variation_pct)}`).join(', ')}`);
  const corps = parts.length ? parts.join(' ; ') + '.' : `${m.inchangees} ${pl(m.inchangees, 'valeur est restée inchangée', 'valeurs sont restées inchangées')}.`;

  const surveiller: string[] = [];
  if (m.topHausse) surveiller.push(`${m.topHausse.code} signe la plus forte hausse (${pct(m.topHausse.variation)}).`);
  if (m.topBaisse) surveiller.push(`${m.topBaisse.code} signe la plus forte baisse (${pct(m.topBaisse.variation)}).`);
  if (m.plusEchangee) surveiller.push(`${m.plusEchangee.code} concentre la plus forte valeur échangée de la séance.`);

  return { sousTitre, accroche, corps, surveiller };
}
