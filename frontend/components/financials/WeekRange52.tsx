import { formatCours } from '@/lib/financials/formatters';

/**
 * Plage 52 semaines, en tube gradué.
 *
 * LE TUBE PORTE UNE POSITION, PAS UN VERDICT. Le dégradé va du plus-bas au
 * plus-haut comme une échelle de thermomètre : il dit où se situe le cours
 * dans sa plage annuelle, il ne dit pas si c'est une bonne affaire. Un titre
 * au plus-haut peut être une dynamique comme une survalorisation — la page
 * n'a pas à trancher à la place du lecteur.
 *
 * Les bornes sont calculées par `scraper/src/scrapers/range52.ts` sur les
 * clôtures des 365 derniers jours, et seulement à partir de 20 séances
 * cotées. En dessous, elles sont nulles et ce composant le dit au lieu
 * d'afficher un tube vide qu'on prendrait pour un plus-bas.
 */

interface Props {
  bas: number | null;
  haut: number | null;
  actuel: number | null;
}

export default function WeekRange52({ bas, haut, actuel }: Props) {
  const complet = bas != null && haut != null && actuel != null;
  const plage = complet ? haut - bas : 0;

  if (!complet || plage <= 0) {
    return (
      <div className="space-y-2">
        <p className="overline text-muted">Plage 52 semaines</p>
        <p className="text-xs text-faint">
          {complet
            ? 'Cours inchangé sur la période : la plage est plate.'
            : 'Pas encore assez de séances cotées sur douze mois.'}
        </p>
      </div>
    );
  }

  const position = Math.max(0, Math.min(100, ((actuel - bas) / plage) * 100));

  /* Couleur du repère : elle suit la POSITION dans la plage, comme le
     dégradé du tube. Aucun jugement — juste la lecture de l'échelle. */
  const teinte = position >= 66 ? 'text-up' : position <= 33 ? 'text-down' : 'text-warn';

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="overline text-muted">Plage 52 semaines</p>
        <p className={`tabular text-xs font-medium ${teinte}`}>
          {Math.round(position)} % de la plage
        </p>
      </div>

      {/* Le tube. `pt-1 pb-1` réserve la place du repère, qui déborde du rail. */}
      <div
        className="relative py-1"
        role="meter"
        aria-label="Position du cours dans sa plage de 52 semaines"
        aria-valuemin={bas}
        aria-valuemax={haut}
        aria-valuenow={actuel}
        aria-valuetext={`${formatCours(actuel)} FCFA, soit ${Math.round(position)} % de la plage entre ${formatCours(bas)} et ${formatCours(haut)}`}
      >
        <div className="relative h-3 rounded-full bg-sunken border border-border overflow-hidden">
          {/* Remplissage : le dégradé complet est peint sur toute la largeur
              puis révélé jusqu'à la position, pour que la couleur d'un point
              donné ne dépende pas du niveau atteint. */}
          <div
            className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${position}%` }}
          >
            <div
              className="h-full rounded-full"
              style={{
                // Le calque révélateur mesure `position %` du rail ; pour que le
                // dégradé couvre le rail ENTIER, l'enfant doit mesurer cette
                // fraction inverse. Sinon la couleur d'un point dépendrait du
                // niveau atteint, et le tube changerait de teinte chaque jour.
                width: `${(100 / Math.max(position, 1)) * 100}%`,
                background:
                  'linear-gradient(90deg, rgb(var(--color-down)) 0%, rgb(var(--color-warn)) 50%, rgb(var(--color-up)) 100%)',
              }}
            />
          </div>

          {/* Graduations au quart : donnent l'échelle sans ajouter de chiffre.
              Teinte claire — un repère sombre disparaîtrait sur la partie
              non remplie du rail, là où l'échelle est justement utile. */}
          {[25, 50, 75].map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-y-0 w-px bg-ivory/20"
              style={{ left: `${t}%` }}
            />
          ))}
        </div>

        {/* Le repère de niveau, posé sur le rail. */}
        <span
          aria-hidden
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-ivory shadow-[0_0_0_3px_rgb(var(--color-accent)/0.28)] transition-[left] duration-500 ease-out motion-reduce:transition-none"
          style={{ left: `${position}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">
          Bas <span className="tabular text-ivory">{formatCours(bas)}</span>
        </span>
        <span className="text-muted">
          Actuel <span className={`tabular font-semibold ${teinte}`}>{formatCours(actuel)}</span>
        </span>
        <span className="text-muted">
          Haut <span className="tabular text-ivory">{formatCours(haut)}</span>
        </span>
      </div>
    </div>
  );
}
