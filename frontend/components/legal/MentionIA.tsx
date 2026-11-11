/**
 * Mention de transparence pour tout contenu rédigé par une IA.
 * Jetons du design system uniquement ; aucun surtitre.
 */
export default function MentionIA({ relu = false, className = '' }: { relu?: boolean; className?: string }) {
  return (
    <p className={`text-xs text-faint leading-relaxed ${className}`.trim()}>
      Contenu généré par intelligence artificielle{relu ? ', relu par la rédaction' : ''}. Il peut contenir des
      erreurs et ne constitue pas un conseil en investissement.
    </p>
  );
}
