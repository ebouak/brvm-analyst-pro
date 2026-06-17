import type { Metadata } from 'next';
import LevelModal from '@/components/debutant/LevelModal';
import LevelGreeting from '@/components/debutant/LevelGreeting';
import LeadForm from '@/components/debutant/LeadForm';

export const metadata: Metadata = {
  title: 'Investir à la BRVM quand on débute — accompagnement pas à pas',
  description:
    'Vous débutez en bourse ? On vous explique simplement comment ouvrir un compte titres et investir à la BRVM, avec l’aide d’un partenaire habilité.',
  alternates: { canonical: '/debutant' },
  openGraph: {
    title: 'Débuter à la BRVM, simplement',
    description:
      'Comprendre la bourse régionale (UEMOA) et ouvrir votre compte titres, accompagné(e) par un partenaire habilité.',
    type: 'website',
  },
};

const ETAPES = [
  { n: '1', titre: 'Comprendre les bases', desc: 'Action, dividende, ordre de bourse : on démystifie le vocabulaire, sans jargon.' },
  { n: '2', titre: 'Choisir un intermédiaire (SGI)', desc: 'Seule une Société de Gestion et d’Intermédiation agréée peut passer vos ordres. On vous oriente.' },
  { n: '3', titre: 'Ouvrir votre compte titres', desc: 'Constitution du dossier, dépôt initial : un partenaire habilité vous accompagne étape par étape.' },
  { n: '4', titre: 'Passer votre premier ordre', desc: 'Vous achetez vos premières actions en confiance, avec un suivi simple.' },
];

const DOCS = [
  'Pièce d’identité en cours de validité',
  'Justificatif de domicile récent',
  'Un RIB / coordonnées bancaires',
  'Photo d’identité (selon la SGI)',
];

/**
 * Page publique /debutant — tunnel d'accompagnement des investisseurs débutants.
 * Thème clair (cream/teal), distinct de l'app sombre. Affiche la modale de niveau
 * (after 3,5 s, one-time), un message personnalisé, et le formulaire de contact.
 */
export default function DebutantPage() {
  return (
    <main className="min-h-screen bg-[#f6f3ee] text-[#191714]">
      <LevelModal />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pt-16 pb-10 sm:pt-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#0b6b6f]">
          BRVM pour les débutants
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Investir à la BRVM,{' '}
          <span className="text-[#0b6b6f]">même en partant de zéro.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#6e6a63]">
          La Bourse Régionale des Valeurs Mobilières (UEMOA) est accessible à tous.
          On vous explique chaque étape simplement, et un partenaire habilité vous
          accompagne jusqu’à l’ouverture de votre compte titres.
        </p>
        <div className="mt-7">
          <a
            href="#cta"
            className="inline-flex items-center gap-2 rounded-full bg-[#0b6b6f] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(11,107,111,0.18)] transition hover:bg-[#084d50]"
          >
            Être accompagné(e) gratuitement →
          </a>
        </div>
      </section>

      {/* Message personnalisé selon le niveau */}
      <section className="mx-auto max-w-5xl px-5 pb-4">
        <LevelGreeting />
      </section>

      {/* Parcours 4 étapes */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-2xl font-bold">Votre parcours en 4 étapes</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {ETAPES.map((e) => (
            <div
              key={e.n}
              className="rounded-2xl border border-[#ddd7cd] bg-[#fbfaf7] p-5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d4ebe8] text-sm font-bold text-[#0b6b6f]">
                {e.n}
              </span>
              <h3 className="mt-3 text-base font-semibold">{e.titre}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#6e6a63]">{e.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Checklist documents */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="rounded-2xl border border-[#ddd7cd] bg-[#fbfaf7] p-6 sm:p-8">
          <h2 className="text-xl font-bold">Les documents à prévoir</h2>
          <p className="mt-1 text-sm text-[#6e6a63]">
            Préparez ces pièces pour accélérer l’ouverture de votre compte (la liste exacte dépend de la SGI).
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {DOCS.map((d) => (
              <li key={d} className="flex items-start gap-2.5 text-sm text-[#191714]">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#d4ebe8] text-xs text-[#0b6b6f]">✓</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA final + formulaire */}
      <section id="cta" className="mx-auto max-w-3xl scroll-mt-8 px-5 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Parlons de votre projet</h2>
          <p className="mx-auto mt-3 max-w-xl text-[#6e6a63]">
            Laissez vos coordonnées : un partenaire habilité vous recontacte pour
            ouvrir votre compte BRVM et répondre à toutes vos questions. C’est gratuit
            et sans engagement.
          </p>
        </div>
        <div className="mt-8">
          <LeadForm />
        </div>
        <p className="mt-4 text-center text-xs text-[#9b958c]">
          WESTBOURSE est un outil d’aide à la décision. Les ordres de bourse sont
          passés par une SGI agréée. Investir comporte un risque de perte en capital.
        </p>
      </section>
    </main>
  );
}
