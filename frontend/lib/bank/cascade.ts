import { illustrationSchema, type Illustration } from '@/lib/academy/illustrations';
import { deviseDe, type Agregat, type LectureBancaire, type LigneAgregat } from './lecture';

/**
 * Du PNB au résultat net d'une banque, sur le gabarit « cascade » de
 * l'Academy (lib/academy/illustrations.ts) — PUR. Avenant du 2026-11-15 : pas
 * de second composant de cascade ; le dossier et la Revue rendent celui des
 * leçons (components/academy/lecon/Illustration.tsx).
 *
 * Chaque marche est un agrégat PUBLIÉ (PNB, charges d'exploitation, coût du
 * risque, résultat net) ; seule « autres éléments et impôt » est une
 * différence, et le total est CALCULÉ par le gabarit : il retombe exactement
 * sur le résultat net publié. Le gabarit n'a pas de sous-total : le RBE reste
 * dans le tableau. null — jamais une cascade reconstituée — si un maillon
 * manque, si les unités ou les périmètres diffèrent, ou si le gabarit refuse
 * les données (cumul qui passerait sous zéro, marche nulle).
 */
const MAILLONS: Agregat[] = ['pnb', 'charges_exploitation', 'cout_du_risque', 'resultat_net'];
const md = (v: number) => v / 1e9;

export function illustrationCascade(l: LectureBancaire): Illustration | null {
  const lignes = MAILLONS.map((cle) => l.compteResultat.find((x) => x.cle === cle));
  if (lignes.some((x) => !x)) return null;
  const [pnb, ce, cdr, rn] = lignes as LigneAgregat[];
  const unites = new Set(lignes.map((x) => x!.unite));
  if (unites.size !== 1 || unites.has('pct')) return null;
  const perimetres = new Set(lignes.map((x) => x!.valeur.perimetre).filter((p) => p !== 'non_precise'));
  if (perimetres.size > 1) return null;

  const vPnb = pnb!.valeur.valeur;
  const vCe = -Math.abs(ce!.valeur.valeur);
  const vCdr = -cdr!.valeur.valeur;
  const vRn = rn!.valeur.valeur;
  const autres = vRn - (vPnb + vCe + vCdr);
  const etapes = [
    { label: 'Charges d’exploitation', valeur: md(vCe) },
    { label: 'Coût du risque', valeur: md(vCdr) },
    // Écart d'arrondi (< 1 unité monétaire) : pas une marche.
    ...(Math.abs(autres) >= 1 ? [{ label: 'Autres éléments et impôt', valeur: md(autres) }] : []),
  ].filter((e) => e.valeur !== 0);

  const doc = l.sources[0]?.document_libelle ?? 'document publié';
  const brut = {
    gabarit: 'cascade' as const,
    titre: `Du produit net bancaire au résultat net, ${l.libelle}`,
    note: 'Chaque marche est un agrégat publié ; « autres éléments et impôt » est l’écart entre le résultat net et le PNB diminué des charges et du coût du risque.',
    unite: `Md ${deviseDe(pnb!.unite)}`,
    reel: true,
    source: `${doc}, ${l.libelle}`.slice(0, 200),
    depart: { label: 'Produit net bancaire', valeur: md(vPnb) },
    etapes,
    arrivee: 'Résultat net',
  };
  const ok = illustrationSchema.safeParse(brut);
  return ok.success ? ok.data : null;
}
