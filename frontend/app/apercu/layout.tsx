import type { Metadata } from 'next';
import '@/components/apercu-app/apercu-app.css';

// Toute l'arborescence /apercu/* est noindex (preview hybride A+B isolée).
// Le chrome (ApercuFrame + ApercuNav) est rendu par chaque page preview
// individuellement — pas ici — pour laisser /apercu (landing bis) intacte
// (J1-J3 : HeroHybride 60/40 + TimelineHybride + BentoFacons).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ApercuLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
