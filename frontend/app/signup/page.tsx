import SignInClient from '../login/SignInClient';
import { getLoginMarket } from '../login/getLoginMarket';
import { LoginMarketBar } from '@/components/auth/LoginMarketBar';
import { fromSur } from '@/lib/auth/urlsAcces';
import { libellePage } from '@/lib/nav';

export const revalidate = 300;

/** Adresse transmise par le champ de l'accueil : reprise seulement si elle a la forme d'une adresse. */
function emailSaisie(v: string | undefined): string | undefined {
  const e = (v ?? '').trim().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
}

export default async function SignupPage(
  props: {
    searchParams: Promise<{ error?: string; next?: string; email?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const market = await getLoginMarket();
  // Page protégée demandée : on le dit, avec son libellé s'il est connu.
  const demandee = fromSur(searchParams.next);
  const libelle = libellePage(demandee);
  return (
    <div className="relative min-h-screen">
      <LoginMarketBar asOf={market.asOf} ticks={market.ticks} candles={market.candles} />
      {searchParams.error && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-down/40 bg-down/15 px-4 py-2 backdrop-blur-sm">
          <p className="text-xs text-down">{searchParams.error}</p>
        </div>
      )}
      {demandee && !searchParams.error && (
        <div className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-border bg-surface/90 px-4 py-2 text-center backdrop-blur-sm">
          <p className="text-xs text-ivory">
            Connectez-vous pour accéder à cette page.{libelle ? ` Page demandée : ${libelle}.` : ''}
          </p>
        </div>
      )}
      <SignInClient subscribeNewsletter subtitle="Créez votre compte gratuit" next={searchParams.next} emailInitial={emailSaisie(searchParams.email)} />
    </div>
  );
}
