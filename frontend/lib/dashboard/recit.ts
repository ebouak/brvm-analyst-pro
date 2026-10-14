/**
 * Récit d'ouverture du tableau de bord (spec §12) — PUR et testé. Chaque
 * phrase n'existe que si sa donnée existe ; aucun mot qui ne s'appuie sur
 * une mesure ; aucune cause affirmée.
 */
import { fmtNumber, fmtFcfa, fmtPctSigne, fmtPctAbs } from '@/lib/format';

/** [sujet de phrase, pluriel ?] : « Les industriels mènent », « L'énergie mène ». */
export const SUJETS: Record<string, [string, boolean]> = {
  BRVMCBASE: ['La consommation de base', false],
  BRVMCDISC: ['La consommation discrétionnaire', false],
  BRVMENER: ["L'énergie", false],
  BRVMFINS: ['Les services financiers', true],
  BRVMINDU: ['Les industriels', true],
  BRVMSPUB: ['Les services publics', true],
  BRVMTELE: ['Les télécommunications', true],
};

const fini = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const n = (k: number, un: string, plus: string) => `${k} ${k > 1 ? plus : un}`;

export function titreSeance(hausses: number | null, baisses: number | null): string | null {
  if (!fini(hausses) || !fini(baisses) || hausses + baisses === 0) return null;
  if (baisses > hausses) return `Séance en repli : ${n(baisses, 'baisse', 'baisses')} pour ${n(hausses, 'hausse', 'hausses')}`;
  if (hausses > baisses) return `Séance en hausse : ${n(hausses, 'hausse', 'hausses')} pour ${n(baisses, 'baisse', 'baisses')}`;
  return `Séance équilibrée : ${n(hausses, 'hausse', 'hausses')}, ${n(baisses, 'baisse', 'baisses')}`;
}

export function chapoSeance(e: {
  composite: { valeur: number; variationPct: number } | null;
  meneur: { code: string; variationPct: number } | null;
  valeurEchangee: number | null;
  valeurEchangeeVeille: number | null;
}): string {
  const phrases: string[] = [];
  if (e.composite && fini(e.composite.valeur) && fini(e.composite.variationPct)) {
    const v = e.composite.variationPct;
    phrases.push(
      Number(v.toFixed(2)) === 0
        ? `Le BRVM Composite est stable à ${fmtNumber(e.composite.valeur, 2)} points.`
        : `Le BRVM Composite ${v < 0 ? 'cède' : 'gagne'} ${fmtPctAbs(v)} à ${fmtNumber(e.composite.valeur, 2)} points.`,
    );
  }
  const sujet = e.meneur ? SUJETS[e.meneur.code] : undefined;
  if (e.meneur && sujet && fini(e.meneur.variationPct)) {
    const [s, pluriel] = sujet;
    phrases.push(
      e.meneur.variationPct > 0
        ? `${s} ${pluriel ? 'mènent' : 'mène'} les secteurs (${fmtPctSigne(e.meneur.variationPct)}).`
        : `${s} ${pluriel ? 'résistent' : 'résiste'} le mieux (${fmtPctSigne(e.meneur.variationPct)}).`,
    );
  }
  if (fini(e.valeurEchangee) && e.valeurEchangee > 0) {
    let t = `${fmtFcfa(e.valeurEchangee)} FCFA échangés`;
    if (fini(e.valeurEchangeeVeille) && e.valeurEchangeeVeille > 0) {
      t += `, ${fmtPctSigne((e.valeurEchangee / e.valeurEchangeeVeille - 1) * 100, 1)} sur la veille`;
    }
    phrases.push(`${t}.`);
  }
  return phrases.join(' ');
}
