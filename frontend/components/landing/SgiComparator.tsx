import { CriteresSgi, FaqSgi } from '@/components/comparateur-sgi/GuideSgi';

/* ──────────────────────────────────────────────────────────────────────────
   Contenu éditorial de la vue d'ensemble : rôle de la SGI, critères de
   choix et questions fréquentes. Simulateur et annuaire ont leur propre page
   (/comparateur-sgi/simuler, /annuaire). Le titre et les
   repères chiffrés sont portés par le bandeau, calculés depuis les données.
   ────────────────────────────────────────────────────────────────────────── */

export default function SgiComparator({ className = 'scroll-mt-24' }: { className?: string }) {
  return (
    <section id="comparateur-sgi" className={className}>
      {/* Rôle de la SGI */}
      <div className="grid grid-cols-1 gap-6 rounded-panel border border-border bg-surface p-6 md:grid-cols-[1.45fr_1fr] md:items-center md:p-8">
        <div>
          <p className="overline mb-2 text-gold-2">Le rôle de la SGI</p>
          <h2 className="mb-3 font-display text-xl text-ivory">Votre intermédiaire obligatoire</h2>
          <p className="mb-3 text-sm leading-relaxed text-muted">
            Une SGI (Société de Gestion et d&apos;Intermédiation) est un courtier agréé par le régulateur régional,
            l&apos;AMF-UMOA. Aucun particulier ne passe d&apos;ordre directement sur la cote : tout achat et toute vente
            transitent par une SGI, qui ouvre votre compte-titres, exécute vos ordres et conserve vos valeurs.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            La BRVM étant un marché régional unique, vous n&apos;êtes pas tenu de choisir une SGI dans votre pays de
            résidence. Le critère décisif n&apos;est pas la géographie, mais la qualité du service et les conditions.
          </p>
        </div>
        <ol className="flex flex-col">
          {[
            ['01', 'Vous', ' ouvrez un compte-titres chez une SGI.'],
            ['02', 'La SGI', ' transmet et exécute votre ordre sur la BRVM.'],
            ['03', 'Le dépositaire', ' règle, livre et conserve vos titres.'],
          ].map(([n, b, t]) => (
            <li key={n} className="flex items-start gap-4 border-b border-border py-3.5 last:border-0">
              <span className="w-6 flex-none font-mono text-[13px] text-accent">{n}</span>
              <span className="text-[14.5px] text-muted">
                <b className="font-semibold text-ivory">{b}</b>
                {t}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-12">
        <CriteresSgi />
      </div>

      <div className="mt-12">
        <FaqSgi />
      </div>

      {/* Outil associé : simulateur de budget */}
      <a
        href="/simulateur-budget"
        className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border border-accent/25 bg-accent/[0.05] p-6 transition-colors hover:border-accent/45 sm:flex-row sm:items-center"
      >
        <div>
          <p className="overline mb-1.5 text-gold-2">Outil associé</p>
          <h2 className="mb-1.5 font-display text-xl text-ivory">Que faire de votre budget ?</h2>
          <p className="max-w-[60ch] text-[14px] leading-relaxed text-muted">
            Une fois votre SGI choisie, entrez votre montant et vos frais de courtage : le simulateur compose trois
            portefeuilles BRVM (dividende, croissance, équilibré) à partir des cours réels.
          </p>
        </div>
        <span className="flex-none font-mono text-[13px] text-accent">Ouvrir le simulateur →</span>
      </a>
    </section>
  );
}
