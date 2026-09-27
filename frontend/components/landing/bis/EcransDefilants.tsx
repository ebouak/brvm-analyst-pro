'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

/**
 * « Ce que vous allez voir » — les écrans réels, révélés au défilement.
 *
 * Adapté du motif Framer Motion « scroll-triggered cards », avec quatre
 * différences qui ne sont pas cosmétiques.
 *
 * 1. DES CAPTURES RÉELLES, PAS DES EMOJI. Le motif d'origine empile des fruits ;
 *    ici chaque carte est une page publique du site, capturée le 2026-09-27.
 *    Les dix captures qui dormaient dans `public/screens/` étaient INUTILISABLES :
 *    elles portaient l'ancienne marque « BRVM Analyst Pro », les libellés
 *    « Diagnostic IA » et « Demander à l'IA » retirés depuis, et 47 valeurs
 *    alors que le marché en compte 48 depuis l'admission de BBGC. Les montrer
 *    aurait présenté une autre marque au visiteur.
 *
 * 2. LES COULEURS VIENNENT DU DESIGN SYSTEM, pas d'un arc-en-ciel HSL. Le voile
 *    derrière chaque carte reprend le jeton qui correspond à CE QUE LA PAGE
 *    MONTRE — l'accent pour les cours, le vert pour les analyses, l'ambre pour
 *    le brief. Une couleur qui informe, pas qui décore.
 *
 * 3. RIEN N'EST JAMAIS INVISIBLE. Le motif d'origine part de `y: 300` dans un
 *    conteneur `overflow: hidden` : sans JavaScript, les cartes restent hors du
 *    cadre. Ici le repos vaut `opacity: .45` et 48 px de décalage — visible en
 *    toute circonstance, y compris si l'hydratation échoue. C'est la règle que
 *    l'audit de cette landing a posée : jamais de contenu garé à `opacity: 0`.
 *
 * 4. `overflow: clip` ET NON `hidden`. Mesuré le 2026-09-26 : `hidden` fait de
 *    l'élément un CONTENEUR DE DÉFILEMENT, ce qui avait rendu inerte toute
 *    animation `animation-timeline: view()` de la section. `clip` découpe à
 *    l'identique sans créer ce conteneur.
 *
 * `prefers-reduced-motion` supprime le mouvement, sans supprimer le contenu.
 */

interface Ecran {
  src: string;
  titre: string;
  phrase: string;
  href: string;
  /** Jeton de couleur du voile, choisi d'après le contenu de la page. */
  jeton: string;
}

const ECRANS: Ecran[] = [
  {
    src: '/screens/wb-societes.webp',
    titre: 'Toutes les sociétés cotées',
    phrase: 'Cours, note et fiche d’analyse pour chaque valeur de la cote.',
    href: '/societes',
    jeton: '--color-accent',
  },
  {
    src: '/screens/wb-fiche.webp',
    titre: 'La fiche d’une valeur',
    phrase: 'Cours, dividendes, fondamentaux et plage 52 semaines sur une seule page.',
    href: '/societes/SNTS',
    jeton: '--color-up',
  },
  {
    src: '/screens/wb-brief.webp',
    titre: 'Le brief de séance',
    phrase: 'Indices, hausses, baisses et volumes, composés après chaque clôture.',
    href: '/brief',
    jeton: '--color-warn',
  },
  {
    src: '/screens/wb-hebdo.webp',
    titre: 'L’analyse de la semaine',
    phrase: 'Les valeurs qui bougent, avec leurs niveaux tirés des cours réels.',
    href: '/analyses/hebdo',
    jeton: '--color-purple',
  },
  {
    src: '/screens/wb-sgi.webp',
    titre: 'Le comparateur de courtiers',
    phrase: 'Les SGI agréées, leurs frais réels, et ce que coûte un ordre.',
    href: '/comparateur-sgi',
    jeton: '--color-accent',
  },
];

/** Repos VISIBLE : 45 % d'opacité et 48 px, jamais zéro. */
const carte: Variants = {
  repos: { y: 48, opacity: 0.45, rotate: -1.5 },
  vue: {
    y: 0,
    opacity: 1,
    rotate: 0,
    transition: { type: 'spring', bounce: 0.28, duration: 0.7 },
  },
};

export function EcransDefilants() {
  const sobre = useReducedMotion();

  return (
    <section className="ecrans" aria-labelledby="h-ecrans">
      <p className="overline">Ce que vous allez voir</p>
      <h2 id="h-ecrans">Des écrans réels, pas des maquettes</h2>
      <p className="lead">
        Chaque image ci-dessous est une page publique du site, telle qu’elle s’affiche aujourd’hui.
      </p>

      <div className="ecrans-pile">
        {ECRANS.map((e) => (
          <motion.div
            key={e.src}
            className="ecran-cadre"
            initial={sobre ? false : 'repos'}
            whileInView="vue"
            // `once` : la carte ne rejoue pas à chaque passage. Une animation
            // qui se redéclenche en remontant la page devient un tic.
            viewport={{ once: true, amount: 0.35 }}
            variants={sobre ? undefined : carte}
          >
            <div className="ecran-voile" style={{ background: `rgb(var(${e.jeton}) / .16)` }} aria-hidden="true" />
            <Link href={e.href} className="ecran-carte">
              <Image
                src={e.src}
                alt={`Capture de la page ${e.titre.toLowerCase()} sur WESTBOURSE`}
                width={1360}
                height={600}
                sizes="(max-width: 900px) 92vw, 760px"
                loading="lazy"
              />
              <div className="ecran-texte">
                <b>{e.titre}</b>
                <span>{e.phrase}</span>
                <em>Ouvrir la page <span aria-hidden="true">→</span></em>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
