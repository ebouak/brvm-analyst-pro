export function LegalDisclaimer({ text }: { text?: string }) {
  return (
    <p className="text-center text-xs italic text-gray-400">
      {text ?? 'Les performances passées ne garantissent pas les performances futures.'}
    </p>
  );
}
