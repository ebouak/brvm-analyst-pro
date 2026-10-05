import type { Commentaire } from '@/lib/carnet/commentaire';
import { syntheseRedigee } from '@/lib/carnet/syntheseServeur';

const CLASSE =
  'rounded-lg border-l-2 border-accent bg-accent/[0.06] px-3.5 py-2.5 text-sm leading-relaxed text-ivory';

/** La synthèse déterministe — aussi l'état d'attente et le repli. */
export function SyntheseDeterministe({ texte, classe }: { texte: string | null; classe?: string }) {
  if (!texte) return null;
  return <p className={`${classe ?? ''} ${CLASSE}`}>{texte}</p>;
}

/**
 * Synthèse rédigée par un modèle, à partir des seuls constats affichés juste
 * en dessous. Si aucun texte ne passe le garde-fou (chiffre étranger,
 * causalité, conseil), c'est la synthèse déterministe qui s'affiche — la page
 * n'est jamais vide ni bloquée par un fournisseur.
 *
 * La mention « rédigée par un modèle » n'est pas décorative : le lecteur doit
 * savoir qu'un texte est produit par une machine, et ce qui l'encadre.
 */
export default async function SyntheseSeance({
  commentaire,
  classe,
}: {
  commentaire: Commentaire;
  classe?: string;
}) {
  const redigee = await syntheseRedigee(commentaire);
  if (!redigee) return <SyntheseDeterministe texte={commentaire.synthese} classe={classe} />;
  return (
    <div className={classe}>
      <p className={CLASSE}>{redigee}</p>
      <p className="mt-1 text-[11px] text-faint">
        Synthèse rédigée par un modèle de langage à partir des seuls constats ci-dessous, vérifiée :
        aucun chiffre hors constats, aucune cause affirmée, aucun conseil.
      </p>
    </div>
  );
}
