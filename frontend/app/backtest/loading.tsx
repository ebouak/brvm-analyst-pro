/**
 * Frontière Suspense locale. Aucune route sous ce segment n'appelle
 * `notFound()` : la diffusion en flux n'y fige donc aucun statut 404.
 * Voir `components/ui/LoadingSkeleton.tsx` pour la règle et sa preuve.
 */
export { default } from '@/components/ui/LoadingSkeleton';
