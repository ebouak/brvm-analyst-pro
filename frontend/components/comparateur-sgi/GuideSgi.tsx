/* Contenu éditorial du comparateur : six critères et questions fréquentes.
   Aucun état, aucune donnée : rendu serveur, lisible sans JavaScript. */

const CRITERES: { n: string; t: string; d: string }[] = [
  { n: '01', t: 'Le coût réel', d: 'Comparez le courtage en pourcentage, mais aussi les minimums par ordre, les droits de garde et la tenue de compte. Pour de petits montants, un minimum de perception pèse souvent plus lourd que le taux affiché.' },
  { n: '02', t: "L'autonomie numérique", d: 'Pouvez-vous passer vos ordres en ligne ou via une application, ou faut-il téléphoner à chaque fois ? Si vous voulez gérer seul, exigez une démonstration de la plateforme avant de signer.' },
  { n: '03', t: "L'accès depuis l'étranger", d: "Diaspora ou hors UEMOA : vérifiez que la SGI accepte les dossiers à distance et sait gérer les virements internationaux. L'essentiel de la place se concentre en Côte d'Ivoire." },
  { n: '04', t: 'Le conseil et la réactivité', d: "Un débutant gagne à choisir une équipe pédagogue et joignable. Testez le service client avant d'ouvrir : posez deux questions précises et jugez la qualité des réponses." },
  { n: '05', t: "La solidité et l'adossement", d: "Une SGI adossée à un grand groupe bancaire offre un réseau d'agences ; une maison indépendante peut être plus souple et spécialisée. Cela dépend de votre profil." },
  { n: '06', t: 'Le dépôt minimum', d: "Le ticket d'entrée va de quelques dizaines de milliers à plus d'un million de FCFA. Il ne figure pas dans les barèmes homologués : demandez-le par écrit à la SGI." },
];

const FAQ: { q: string; r: string; open?: boolean }[] = [
  { q: 'Faut-il vraiment passer par une SGI ?', r: "Oui, sans exception. La réglementation du marché régional réserve l'accès à la cote aux intermédiaires agréés. Un particulier ne peut ni acheter ni vendre une action de la BRVM en direct : il doit obligatoirement ouvrir un compte chez une SGI, qui transmet et exécute ses ordres.", open: true },
  { q: "Combien coûte l'ouverture et la tenue d'un compte ?", r: "L'ouverture d'un compte-titres est le plus souvent gratuite. Dans les barèmes homologués par l'AMF-UMOA, le courtage d'un client de la zone UEMOA est plafonné entre 0,2 % et 1 % de l'ordre selon la SGI. S'ajoutent les commissions de la BRVM et du dépositaire (0,3 % de chaque ordre), des droits de garde et parfois une tenue de compte : demandez toujours le barème complet par écrit." },
  { q: 'Puis-je choisir une SGI dans un autre pays que le mien ?', r: "Oui. La BRVM est un marché régional unifié couvrant les huit pays de l'UEMOA. Vous pouvez ouvrir un compte chez n'importe quelle SGI agréée, y compris hors de votre pays de résidence, dès lors qu'elle accepte votre dossier." },
  { q: 'Quel délai et quels documents pour ouvrir le compte ?', r: "Comptez en général une à deux semaines entre le dépôt du dossier et l'activation. Prévoyez une pièce d'identité valide, un justificatif de domicile, un justificatif de revenus ou d'origine des fonds, et un RIB." },
  { q: 'Pourrai-je passer mes ordres en ligne ?', r: "Cela dépend de la SGI. Certaines facturent explicitement une « bourse en ligne » dans leur barème homologué ; pour les autres, l'information n'est pas publiée. Si l'autonomie compte pour vous, demandez une démonstration avant de vous engager." },
  { q: 'Existe-t-il une « meilleure » SGI ?', r: "Non, il n'y a pas de classement universel. La SGI idéale dépend de votre profil : petits ordres → frais bas et pédagogie ; investisseur actif → plateforme rapide ; non-résident → gestion à distance. Servez-vous des six critères pour trancher selon vos besoins." },
];

export function CriteresSgi() {
  return (
    <section aria-labelledby="titre-criteres">
      <p className="overline mb-2 text-gold-2">Méthode</p>
      <h2 id="titre-criteres" className="mb-1 font-display text-xl text-ivory">Six critères pour décider</h2>
      <p className="mb-5 max-w-[64ch] text-sm leading-relaxed text-muted">
        Au-delà du nom, ce sont ces points qui font la différence à l&apos;usage. Posez-les en questions directes à
        chaque SGI que vous contactez.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CRITERES.map((c) => (
          <div key={c.n} className="flex gap-4 rounded-2xl border border-border bg-surface p-5">
            <span className="flex-none font-mono text-[14px] text-accent">{c.n}</span>
            <div>
              <h3 className="mb-1.5 font-display text-[1.1rem] text-ivory">{c.t}</h3>
              <p className="text-[14.5px] leading-relaxed text-muted">{c.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FaqSgi() {
  return (
    <section aria-labelledby="titre-faq">
      <p className="overline mb-2 text-gold-2">Questions fréquentes</p>
      <h2 id="titre-faq" className="mb-4 font-display text-xl text-ivory">Avant d&apos;ouvrir un compte</h2>
      <div className="border-t border-border">
        {FAQ.map((f) => (
          <details key={f.q} open={f.open} className="group border-b border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-[1.1rem] text-ivory marker:hidden">
              {f.q}
              <span className="font-mono text-xl text-accent transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="max-w-[74ch] pb-5 text-[14.5px] leading-relaxed text-muted">{f.r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
