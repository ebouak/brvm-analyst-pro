/**
 * Barre de cote : logique PURE (aucune I/O, aucun React).
 *
 * Tout ce que la barre affiche vient d'ici ou du registre de navigation
 * (`lib/navRegistre.ts`) : panneaux, état de séance, cellule de contexte,
 * colonne vivante. Aucun lien n'est écrit dans un composant : retirer une
 * entrée du registre la retire de la barre, du plein écran mobile et de la
 * palette.
 */
import { MENU_COMPTE, REGISTRE, RUBRIQUES, type EntreeNav, type Rubrique } from '@/lib/navRegistre';
import { HEURE_FIN_SEANCE_UTC, HEURE_OUVERTURE_UTC, estEnSeance } from '@/lib/freshness';

// ── Panneaux dérivés du registre ────────────────────────────────────────────

export interface LienPanneau {
  href: string;
  label: string;
  description: string;
  premium: boolean;
}

export interface PanneauDef {
  id: Rubrique;
  libelle: string;
  /** Deux colonnes de liens, dans l'ordre du registre. */
  colonnes: [LienPanneau[], LienPanneau[]];
}

/** Rubriques qui ont leur propre cellule dans la barre (la sixième vit dans la cellule d'action). */
export const RUBRIQUES_BARRE: Rubrique[] = ['marche', 'idee', 'revenus', 'apprendre'];

function lien(e: EntreeNav): LienPanneau {
  return {
    href: e.chemin,
    label: e.libelleMenu ?? e.libelle,
    description: e.description ?? '',
    premium: Boolean(e.premium),
  };
}

/** Un panneau par rubrique, dérivé du registre : entrées `menu`, rangées par `colonne`. */
export function construirePanneaux(registre: readonly EntreeNav[] = REGISTRE): PanneauDef[] {
  return RUBRIQUES.map((r) => {
    const entrees = registre.filter((e) => e.statut === 'menu' && e.rubrique === r.id);
    return {
      id: r.id,
      libelle: r.libelle,
      colonnes: [
        entrees.filter((e) => (e.colonne ?? 1) === 1).map(lien),
        entrees.filter((e) => e.colonne === 2).map(lien),
      ] as [LienPanneau[], LienPanneau[]],
    };
  });
}

export const PANNEAUX: PanneauDef[] = construirePanneaux();

export function panneauDe(id: Rubrique): PanneauDef {
  return PANNEAUX.find((p) => p.id === id) ?? PANNEAUX[0];
}

/** Compte : MENU_COMPTE du registre, rangé sous le panneau « Mon portefeuille ». */
export const LIENS_COMPTE = MENU_COMPTE;

/** Lien statique de repli de la colonne vivante (affiché tant que rien n'est chargé, ou en cas d'échec). */
export const REPLI_VIVANT: Record<Rubrique, { titre: string; href: string; label: string }> = {
  aujourdhui: { titre: 'À la une', href: '/brief', label: 'Voir le brief de séance' },
  marche: { titre: 'Plus fortes variations de la séance', href: '/actions', label: 'Voir toutes les valeurs' },
  idee: { titre: 'Valeurs de la semaine', href: '/analyses/hebdo', label: 'Voir la dernière édition' },
  revenus: { titre: 'Prochains détachements', href: '/dividendes', label: 'Voir le calendrier des dividendes' },
  apprendre: { titre: 'Formations en direct', href: '/formations', label: 'Voir les formations' },
  portefeuille: { titre: 'Votre portefeuille', href: '/portefeuille', label: 'Ouvrir mon portefeuille' },
};

// ── État de séance (horloge du marché) ──────────────────────────────────────

export interface EtatSeance {
  ouverte: boolean;
  /** Texte complet, ex. « Séance ouverte · clôture dans 1 h 12 ». */
  libelle: string;
  /** Texte court, ex. « Séance ouverte ». */
  court: string;
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function formaterDuree(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const reste = m % 60;
  return reste === 0 ? `${h} h` : `${h} h ${String(reste).padStart(2, '0')}`;
}

/**
 * État de séance à `maintenant`, d'après la fenêtre de `lib/freshness.ts`
 * (lundi-vendredi, 9 h à 16 h GMT). Heure GMT = heure d'Abidjan : aucun fuseau
 * à convertir. Aucun horaire n'est ajouté ici : seule la fenêtre existante sert.
 */
export function etatSeance(maintenant: Date): EtatSeance {
  if (estEnSeance(maintenant)) {
    const minutesFin = HEURE_FIN_SEANCE_UTC * 60 - (maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes());
    return {
      ouverte: true,
      libelle: `Séance ouverte · clôture dans ${formaterDuree(minutesFin)}`,
      court: 'Séance ouverte',
    };
  }
  const jour = maintenant.getUTCDay();
  const heure = maintenant.getUTCHours();
  const semaine = jour >= 1 && jour <= 5;
  let suite: string;
  if (semaine && heure < HEURE_OUVERTURE_UTC) {
    suite = `ouverture à ${HEURE_OUVERTURE_UTC} h GMT`;
  } else if (jour >= 1 && jour <= 4) {
    suite = 'prochaine séance demain';
  } else {
    // vendredi après la clôture, samedi, dimanche
    suite = `prochaine séance ${JOURS[1]}`;
  }
  return { ouverte: false, libelle: `Marché fermé · ${suite}`, court: 'Marché fermé' };
}

// ── Cellule de contexte (fiche valeur) ──────────────────────────────────────

const CODE_VALEUR = /^[A-Za-z0-9]{3,6}$/;

/** Code de la valeur si `pathname` est `/actions/[code]` ou l'une de ses sous-pages, sinon `null`. */
export function codeContexte(pathname: string): string | null {
  const m = /^\/actions\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!m) return null;
  const code = decodeURIComponent(m[1]);
  if (code === 'compare' || !CODE_VALEUR.test(code)) return null;
  return code.toUpperCase();
}

export function estCodeValeur(code: string): boolean {
  return CODE_VALEUR.test(code);
}

// ── Colonne vivante : forme des aperçus et constructeurs purs ───────────────

export interface LigneApercu {
  texte: string;
  detail?: string;
  href?: string;
  /** Sens de la variation, pour la couleur (jamais un signal). */
  sens?: 'hausse' | 'baisse';
}

export interface Apercu {
  titre: string;
  lignes: LigneApercu[];
  lien: { href: string; label: string };
}

export interface LigneCours {
  code: string;
  variation_pct: number | null;
  /** Cours de clôture / dernier cours. */
  cours_jour?: number | null;
}

function pct(v: number): string {
  const s = Math.abs(v).toFixed(2).replace('.', ',');
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s} %`;
}

/** Les deux plus fortes hausses et les deux plus fortes baisses de la séance. Seules les variations non nulles comptent. */
export function apercuMarche(lignes: LigneCours[], dateSeance: string | null): Apercu {
  const valides = lignes.filter((l): l is LigneCours & { variation_pct: number } => typeof l.variation_pct === 'number' && Number.isFinite(l.variation_pct));
  const hausses = valides.filter((l) => l.variation_pct > 0).sort((a, b) => b.variation_pct - a.variation_pct).slice(0, 2);
  const baisses = valides.filter((l) => l.variation_pct < 0).sort((a, b) => a.variation_pct - b.variation_pct).slice(0, 2);
  const mk = (l: LigneCours & { variation_pct: number }): LigneApercu => ({
    texte: l.code,
    detail: pct(l.variation_pct),
    href: `/actions/${l.code}`,
    sens: l.variation_pct > 0 ? 'hausse' : 'baisse',
  });
  return {
    titre: dateSeance ? `Variations de la séance du ${dateCourte(dateSeance)}` : REPLI_VIVANT.marche.titre,
    lignes: [...hausses.map(mk), ...baisses.map(mk)],
    lien: { href: REPLI_VIVANT.marche.href, label: REPLI_VIVANT.marche.label },
  };
}

export function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export interface LigneDetachement {
  code: string;
  ex_date: string;
}

/** Les trois prochains détachements connus (date de détachement à venir ou du jour). */
export function apercuRevenus(rows: LigneDetachement[], aujourdhui: string): Apercu {
  const prochains = rows
    .filter((r) => r.ex_date >= aujourdhui)
    .sort((a, b) => (a.ex_date < b.ex_date ? -1 : a.ex_date > b.ex_date ? 1 : a.code.localeCompare(b.code)))
    .slice(0, 3);
  return {
    titre: prochains.length ? 'Prochains détachements connus' : REPLI_VIVANT.revenus.titre,
    lignes: prochains.map((r) => ({ texte: r.code, detail: dateCourte(r.ex_date), href: `/societes/${r.code}` })),
    lien: { href: REPLI_VIVANT.revenus.href, label: REPLI_VIVANT.revenus.label },
  };
}

export function apercuIdee(dateEdition: string | null): Apercu {
  const lignes: LigneApercu[] = [];
  if (dateEdition) lignes.push({ texte: `Valeurs de la semaine`, detail: `édition du ${dateCourte(dateEdition)}`, href: `/analyses/hebdo/${dateEdition}` });
  lignes.push({ texte: 'Saisonnalité', detail: 'ce mois-ci', href: '/saisonnalite' });
  return { titre: 'À lire', lignes, lien: { href: REPLI_VIVANT.idee.href, label: REPLI_VIVANT.idee.label } };
}

export function apercuAujourdhui(dateBrief: string | null, prochain: LigneDetachement | null): Apercu {
  const lignes: LigneApercu[] = [];
  if (dateBrief) lignes.push({ texte: 'Brief de la séance', detail: dateCourte(dateBrief), href: `/brief/${dateBrief}` });
  if (prochain) lignes.push({ texte: `Prochain détachement : ${prochain.code}`, detail: dateCourte(prochain.ex_date), href: `/societes/${prochain.code}` });
  return { titre: 'À la une', lignes, lien: { href: REPLI_VIVANT.aujourdhui.href, label: REPLI_VIVANT.aujourdhui.label } };
}

export interface LigneFormation {
  titre: string;
  date_evenement: string;
}

export function apercuApprendre(prochaine: LigneFormation | null): Apercu {
  return {
    titre: prochaine ? 'Prochaine formation en direct' : REPLI_VIVANT.apprendre.titre,
    lignes: prochaine ? [{ texte: prochaine.titre, detail: dateCourte(prochaine.date_evenement), href: '/formations' }] : [],
    lien: { href: REPLI_VIVANT.apprendre.href, label: REPLI_VIVANT.apprendre.label },
  };
}

export interface PositionValorisee {
  quantite: number;
  cours: number | null;
  variation_pct: number | null;
}

/**
 * Valeur du portefeuille et variation du jour. Une position sans cours n'est
 * PAS comptée à zéro : elle est exclue et déclarée (`sansCours`).
 */
export function apercuPortefeuille(positions: PositionValorisee[]): Apercu {
  const prisesEnCompte = positions.filter((p) => typeof p.cours === 'number' && p.cours > 0);
  const sansCours = positions.length - prisesEnCompte.length;
  if (positions.length === 0 || prisesEnCompte.length === 0) {
    return {
      titre: REPLI_VIVANT.portefeuille.titre,
      lignes: positions.length === 0 ? [{ texte: 'Aucune position enregistrée' }] : [],
      lien: { href: REPLI_VIVANT.portefeuille.href, label: REPLI_VIVANT.portefeuille.label },
    };
  }
  let valeur = 0;
  let variationFcfa = 0;
  let variationConnue = true;
  for (const p of prisesEnCompte) {
    const cours = p.cours as number;
    const v = p.quantite * cours;
    valeur += v;
    if (typeof p.variation_pct === 'number' && p.variation_pct > -100) {
      variationFcfa += v - v / (1 + p.variation_pct / 100);
    } else {
      variationConnue = false;
    }
  }
  const lignes: LigneApercu[] = [
    { texte: `${Math.round(valeur).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`, detail: 'valeur au dernier cours' },
  ];
  if (variationConnue && valeur - variationFcfa > 0) {
    const p = (variationFcfa / (valeur - variationFcfa)) * 100;
    lignes.push({ texte: `Variation du jour`, detail: pct(p), sens: p > 0 ? 'hausse' : p < 0 ? 'baisse' : undefined });
  }
  if (sansCours > 0) lignes.push({ texte: `${sansCours} position${sansCours > 1 ? 's' : ''} sans cours, non comptée${sansCours > 1 ? 's' : ''}` });
  return { titre: REPLI_VIVANT.portefeuille.titre, lignes, lien: { href: REPLI_VIVANT.portefeuille.href, label: REPLI_VIVANT.portefeuille.label } };
}

export interface ContexteValeur {
  code: string;
  cours: number | null;
  variation_pct: number | null;
}

export function formaterContexte(c: ContexteValeur): { cours: string; variation: string; sens?: 'hausse' | 'baisse' } {
  return {
    cours: c.cours == null ? 'n.d.' : `${Math.round(c.cours).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`,
    variation: c.variation_pct == null ? 'n.d.' : pct(c.variation_pct),
    sens: c.variation_pct == null || c.variation_pct === 0 ? undefined : c.variation_pct > 0 ? 'hausse' : 'baisse',
  };
}
