import Link from 'next/link';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { Chapitre } from '@/components/fiche/Chapitre';
import { LigneSource } from '@/components/marche/LigneSource';
import { EmptyStatePremium } from '@/components/ui/premium';
import { MyPortfolioAdvice } from '@/components/advisor/MyPortfolioAdvice';
import { LectureApprofondie, LectureApprofondieVerrouillee } from '@/components/conseiller/LectureApprofondie';
import { chargerLecturesApprofondies } from '@/lib/conseiller/lectureApprofondie';
import { Jauges } from '@/components/conseiller/Jauges';
import { SignalPremium } from '@/components/conseiller/SignalPremium';
import { lireSignaux } from '@/lib/conseiller/lectureSignal';
import { moisProchaineRevision } from '@/lib/conseiller/signal';
import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';
import { FAMILLES } from '@/lib/conseiller/facteurs';
import { lirePositions } from '@/lib/conseiller/lecture';
import { profilDe, phraseDe, soldeDe, LIBELLE_PROFIL, type Profil } from '@/lib/conseiller/profil';
import { fmtDateCourte } from '@/lib/format';

export const metadata = { title: 'Conseiller BRVM' };
// Garde par utilisateur : rendu dynamique obligatoire (plus de cache partagé).
export const dynamic = 'force-dynamic';

const GROUPES: { profil: Profil; titre: string }[] = [
  { profil: 'porteur', titre: 'Profils porteurs' },
  { profil: 'partage', titre: 'Profils partagés' },
  { profil: 'fragile', titre: 'Profils fragiles' },
  { profil: 'indetermine', titre: 'Lecture impossible' },
];

export default async function ConseillerPage() {
  // Niveau requis LU EN BASE (feature_flags, editable dans /admin/features).
  const gate = await canAccess('conseiller');
  if (!gate.allowed) {
    return (
      <AccessGate
        required={gate.required === 'free' ? 'premium' : gate.required}
        feature="Le Conseiller"
        hint="Positions de chaque valeur par famille de facteurs."
      />
    );
  }

  let positions: Awaited<ReturnType<typeof lirePositions>> = null;
  let illisible = false;
  try {
    positions = await lirePositions();
  } catch {
    illisible = true;
  }

  if (illisible || !positions) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EnTeteCote
          titre="Conseiller"
          description="Où se situe chaque valeur de la cote, famille par famille, sans recommandation d'achat ni de vente."
          source={null}
        />
        <div className="mt-8">
          {illisible ? (
            <EmptyStatePremium title="Positions momentanément illisibles" hint="Réessayez dans un instant." />
          ) : (
            <EmptyStatePremium title="Positions pas encore calculées" hint="Elles sont mises à jour chaque soir de séance." />
          )}
        </div>
      </div>
    );
  }

  const { date, lignes } = positions;

  // Lecture approfondie : mécanisme d'accès existant de la fiche (feature_flags 'fondamentaux'). Rien de Premium n'est chargé sans accès.
  const gateApprofondie = await canAccess('fondamentaux');
  const lectures = gateApprofondie.allowed
    ? await chargerLecturesApprofondies(lignes.map((l) => l.code), date, new Date().toISOString().slice(0, 10)).catch(() => null)
    : null;

  // Signal « tendance longue » : drapeau DÉCLARÉ et ouvert seulement (le filet « non déclaré = premium » ne suffit pas ici).
  // Coupé, non déclaré ou illisible : rien n'est chargé ni affiché.
  const gateSignal = await canAccess('conseiller_signal');
  const signaux = gateSignal.allowed && !gateSignal.undeclared ? await lireSignaux(date).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <EnTeteCote
        titre="Conseiller"
        description="Où se situe chaque valeur de la cote, famille par famille, sans recommandation d'achat ni de vente."
        seance={date}
        compte={{ n: lignes.length, libelle: 'valeurs' }}
        source="Calcul WESTBOURSE sur les cours et comptes publiés"
      />

      <section aria-labelledby="t-abstention" className="mt-8 rounded-card border border-border bg-surface p-5">
        <h2 id="t-abstention" className="font-display text-xl text-ivory">
          Le Conseiller s&apos;abstient de recommander d&apos;acheter ou de vendre
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Nous avons testé, sur l&apos;historique de la BRVM depuis 2007, si une règle combinant tendance, risque et valorisation battait le marché. Le marché est trop étroit pour le prouver : environ 46 périodes indépendantes seulement, et il faudrait un écart de près de 27 % par an pour que le test le confirme. Plutôt que d&apos;afficher un conseil que nous ne pouvons pas justifier, nous montrons où se situe chaque valeur, et vous décidez.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/conseiller/track-record" className="text-accent-ink underline underline-offset-2 hover:no-underline">
            Comment nous l&apos;avons mesuré
          </Link>
        </p>
      </section>

      <Chapitre id="mes-positions" numero="01" titre="Mes positions" sousTitre="Vos lignes, avec leur position par famille." />
      <div className="mt-6">
        <MyPortfolioAdvice />
      </div>

      <Chapitre id="cote" numero="02" titre="La cote, valeur par valeur" sousTitre="Lecture des cinq familles de facteurs : une suggestion, pas une décision." />
      <p className="mt-4 rounded-card border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
        Lecture des facteurs, non testée : ce n&apos;est ni un conseil ni une décision. Le banc a montré qu&apos;on ne peut pas prouver qu&apos;elle bat le marché.
      </p>

      {signaux && (
        <section aria-labelledby="t-signal" className="mt-6 rounded-card border border-border bg-surface p-5">
          <h3 id="t-signal" className="font-display text-lg text-ivory">Signal tendance longue</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Chaque carte porte un état tiré du parcours de la valeur sur 120 et 250 séances, comparé au reste de la cote. Le seul écart mesuré sur l&apos;historique concerne l&apos;état « À éviter » ; cette mesure est exploratoire et sa confirmation, sur les séances postérieures au 10 novembre 2026, ne sera pas lue avant novembre 2031.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            État du <span className="tabular">{fmtDateCourte(signaux.date)}</span>, révisé à la première séance de chaque mois (prochaine révision : {moisProchaineRevision(date)}). Horizon : trois mois. Signal général, identique pour tous les abonnés : il ne tient compte ni de votre portefeuille ni de votre situation, et n&apos;est pas un conseil en investissement.{' '}
            <Link href="/conseiller/track-record" className="text-accent-ink underline underline-offset-2 hover:no-underline">
              Méthode et protocole
            </Link>
          </p>
        </section>
      )}

      {GROUPES.map((g) => {
        const membres = lignes
          .filter((l) => profilDe(l.tiers) === g.profil)
          .sort((a, b) => soldeDe(b.tiers) - soldeDe(a.tiers) || a.code.localeCompare(b.code));
        if (membres.length === 0) return null;
        return (
          <section key={g.profil} aria-labelledby={"g-" + g.profil} className="mt-8">
            <h3 id={"g-" + g.profil} className="font-display text-lg text-ivory">
              {g.titre} <span className="tabular text-sm text-muted">({membres.length})</span>
            </h3>
            <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {membres.map((l) => (
                <li key={l.code} className="rounded-card border border-border bg-surface p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={"/actions/" + l.code} className="font-medium text-ivory hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{l.code}</Link>
                    <span className="text-xs text-muted">{LIBELLE_PROFIL[g.profil]}</span>
                  </div>
                  {(l.classe_liquidite === 'C' || l.classe_liquidite === 'D') && (
                    <p className="mt-1 text-xs text-faint">peu échangée</p>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-ivory">{phraseDe(l.tiers)}</p>
                  <div className="mt-3">
                    <Jauges scores={l.scores} tiers={l.tiers} />
                  </div>
                  {signaux && <SignalPremium signal={signaux.parCode.get(l.code)} />}
                  {gateApprofondie.allowed ? (
                    lectures?.get(l.code) ? <LectureApprofondie lecture={lectures.get(l.code)!} tiers={l.tiers} /> : <p className="mt-3 border-t border-border pt-3 text-sm text-muted">Donnée momentanément illisible</p>
                  ) : <LectureApprofondieVerrouillee />}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <h3 className="mt-10 font-display text-lg text-ivory">Comment lire les jauges</h3>
      <p className="mt-2 text-sm text-muted">À droite = tiers le plus favorable de la cote du jour pour cette famille.</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {FAMILLES.map((f) => (
          <div key={f.cle}>
            <dt className="font-medium text-ivory">{f.titre}</dt>
            <dd className="text-muted">Tiers haut : {f.haut}</dd>
          </div>
        ))}
      </dl>

      <LigneSource>
        Positions calculées par WESTBOURSE pour la séance du {fmtDateCourte(date)} à partir des cours, des comptes et des dividendes publiés. Valeurs de liquidité C ou D : cours peu échangés, positions à lire avec prudence. Ce n&apos;est pas un conseil en investissement.
      </LigneSource>
    </div>
  );
}
