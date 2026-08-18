import SignInClient from '../login/SignInClient';
import { getLoginMarket } from '../login/getLoginMarket';
import { LoginMarketBar } from '@/components/auth/LoginMarketBar';

export const revalidate = 300;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const market = await getLoginMarket();
  return (
    <div className="relative min-h-screen">
      <LoginMarketBar asOf={market.asOf} ticks={market.ticks} candles={market.candles} />
      {searchParams.error && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-down/40 bg-down/15 px-4 py-2 backdrop-blur-sm">
          <p className="text-xs text-down">{searchParams.error}</p>
        </div>
      )}
      <SignInClient subscribeNewsletter subtitle="Créez votre compte gratuit" next={searchParams.next} />
    </div>
  );
}
