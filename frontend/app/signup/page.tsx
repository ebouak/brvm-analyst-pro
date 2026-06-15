import SignInClient from '../login/SignInClient';

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="relative min-h-screen">
      {searchParams.error && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-down/40 bg-down/15 px-4 py-2 backdrop-blur-sm">
          <p className="text-xs text-down">{searchParams.error}</p>
        </div>
      )}
      <SignInClient subscribeNewsletter subtitle="Créez votre compte gratuit" />
    </div>
  );
}
