/**
 * Titre de chapitre. `premier` resserre l'espace au-dessus d'un chapitre qui suit
 * directement l'en-tête de page. `numero` est facultatif : la fiche action n'en
 * met pas (une rubrique = un chapitre), les pages de marché si.
 */
export function Chapitre({ id, numero, titre, sousTitre, premier }: { id: string; numero?: string; titre: string; sousTitre: string; premier?: boolean }) {
  return (
    <div id={id} className={`${premier ? 'mt-8 pt-8' : 'mt-16 pt-11'} grid scroll-mt-24 ${numero ? 'grid-cols-[48px_1fr]' : 'grid-cols-1'} gap-y-1 border-t border-border-strong`}>
      {numero && <span className="tabular pt-2.5 text-sm text-accent-ink">{numero}</span>}
      <h2 id={`${id}-titre`} tabIndex={-1} className="font-display text-3xl leading-tight text-ivory [text-wrap:balance] focus:outline-none md:text-[34px]">{titre}</h2>
      <p className={`${numero ? 'col-start-2' : ''} text-sm text-faint`}>{sousTitre}</p>
    </div>
  );
}
