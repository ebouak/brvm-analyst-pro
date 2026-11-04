import { CalculateurCout } from '@/components/comparateur-sgi/CalculateurCout';
import { AnnuaireSgi } from '@/components/comparateur-sgi/annuaire/AnnuaireSgi';
import { CriteresSgi, FaqSgi } from '@/components/comparateur-sgi/GuideSgi';
import { SGI_DIRECTORY, type Sgi } from '@/lib/sgi-frais/directory';
import { SGI_FRAIS_SEED } from '@/lib/sgi-frais/seed-data';
import type { SgiFrais } from '@/lib/sgi-frais/types';

/* ──────────────────────────────────────────────────────────────────────────
   Vue d'ensemble du comparateur : rôle de la SGI, simulateur, annuaire,
   critères et questions fréquentes. Chaque bloc vit aussi sur sa page
   (/comparateur-sgi/simuler, /annuaire, /methodologie). Le titre et les
   repères chiffrés sont portés par le bandeau, calculés depuis les données.
   ────────────────────────────────────────────────────────────────────────── */

export default function SgiComparator({
  className = 'scroll-mt-24',
  directory,
  frais,
}: {
  className?: string;
  /** Annuaire depuis Supabase (repli sur le TS si non fourni). */
  directory?: Sgi[];
  /** Barèmes depuis Supabase (repli sur le TS si non fourni). */
  frais?: SgiFrais[];
}) {
  const SGI = directory ?? SGI_DIRECTORY;
  const FRAIS = frais ?? SGI_FRAIS_SEED;

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

      <div id="calculateur-cout" className="mt-10 scroll-mt-24">
        <p className="overline mb-2 text-gold-2">Calculer le coût réel</p>
        <h2 className="mb-1 font-display text-xl text-ivory">Combien coûterait votre investissement ?</h2>
        <p className="mb-5 max-w-[64ch] text-sm leading-relaxed text-muted">
          Décrivez votre scénario : le classement se met à jour à chaque réglage. Les coûts viennent des barèmes
          publiés par la BRVM (décisions d&apos;homologation), chacun badgé selon sa fiabilité et décomposé poste
          par poste.
        </p>
        <CalculateurCout frais={FRAIS} directory={SGI} />
      </div>

      <div className="mt-12">
        <p className="overline mb-2 text-gold-2">L&apos;annuaire</p>
        <h2 className="mb-4 font-display text-xl text-ivory">Les SGI par pays</h2>
        <AnnuaireSgi directory={SGI} frais={FRAIS} />
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
