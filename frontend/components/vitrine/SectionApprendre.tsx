import Link from 'next/link';
import { Apparition } from './mouvement/Apparition';
import { LECON0 } from '@/lib/academy/lecon0';
import { GUIDE_SGI } from '@/lib/academy/guideSgi';
import { lienOffre, offreDuCours } from '@/lib/academy/leconsOffertes';
import { NOMS_NIVEAUX, type NiveauParcours } from '@/lib/vitrine/landingPur';

/** La formation sur la landing (spec 2026-11-28) : vidéo Leçon 0, entrées gratuites, parcours certifiant. */
export function SectionApprendre({ parcours }: { parcours: NiveauParcours[] | null }) {
  const n1 = offreDuCours('academy-niveau-1-initiation');
  const n2 = offreDuCours('academy-niveau-2-fondamental');
  const entrees = [
    n1 ? { href: lienOffre(n1), titre: 'Leçon 1 interactive', detail: 'Ouverte à tous' } : null,
    n2 ? { href: lienOffre(n2), titre: 'Cas réel : les comptes 2025 de Sonatel', detail: 'Avec un compte gratuit' } : null,
    { href: GUIDE_SGI.chemin, titre: 'Guide vidéo : choisir sa SGI', detail: `Vidéo de ${GUIDE_SGI.duree}` },
  ].filter((e): e is { href: string; titre: string; detail: string } => e !== null);
  const total = parcours ? parcours.reduce((s, p) => s + p.lecons, 0) : null;
  return (
    <section id="apprendre" className="bande-claire v-bloc" aria-labelledby="h-apprendre">
      <div className="v-colonne">
        <Apparition className="v-tete-section">
          <p className="v-surtitre">La formation</p>
          <h2 id="h-apprendre" className="v-section v-section--moyen">
            Apprendre à investir à la BRVM. <span className="vitrine-accent">Commencez gratuitement.</span>
          </h2>
        </Apparition>
        <div className="v-apprendre">
          <figure className="v-apprendre-video">
            <video controls preload="none" playsInline poster={LECON0.affiche} aria-label={`Leçon 0 : ${LECON0.titre}`}>
              <source src={LECON0.video} type="video/mp4" />
            </video>
            <figcaption className="v-note">
              Leçon 0 · {LECON0.titre} · {LECON0.duree}
            </figcaption>
          </figure>
          <div className="v-apprendre-entrees">
            {entrees.map((e) => (
              <Link key={e.href} href={e.href} className="v-apprendre-entree">
                <span className="v-apprendre-titre">{e.titre}</span>
                <span className="v-apprendre-detail">{e.detail}</span>
              </Link>
            ))}
          </div>
        </div>
        {parcours && total != null && (
          <p className="v-apprendre-parcours">
            {parcours.map((p, i) => (
              <span key={p.niveau}>
                {i > 0 && <span aria-hidden="true"> → </span>}
                {NOMS_NIVEAUX[p.niveau]} <span className="v-mono">({p.lecons})</span>
              </span>
            ))}
            <span> · {total} leçons · un examen et un certificat à chaque niveau</span>
          </p>
        )}
        <div className="v-cta-duo v-apprendre-actions">
          {n1 && (
            <Link href={lienOffre(n1)} className="v-bouton">
              Commencer la Leçon 1
            </Link>
          )}
          <Link href="/formations/academy" className="v-bouton-second">
            Voir le programme
          </Link>
        </div>
      </div>
    </section>
  );
}
