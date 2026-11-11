import SignInClient from './SignInClient';
import { getLoginMarket } from './getLoginMarket';
import { LoginMarketBar } from '@/components/auth/LoginMarketBar';
import { fromSur } from '@/lib/auth/urlsAcces';
import { libellePage } from '@/lib/nav';

export const revalidate = 300;

export default async function LoginPage(
  props: {
    searchParams: Promise<{ error?: string; next?: string }>;
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
      <SignInClient next={searchParams.next} />
    </div>
  );
}
