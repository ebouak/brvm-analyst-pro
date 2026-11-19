'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const SECTIONS = [
  ['operations', '01 · Opérations'],
  ['bridge', '02 · Bridge'],
  ['dividendes', '03 · Dividendes'],
  ['comportements', '04 · Comportements'],
  ['origine-cash', '05 · WPLI'],
  ['impact-structurel', '06 · Structure'],
  ['scenarios', '07 · Scénarios'],
] as const;

export default function ReadingAids() {
  const [progression, setProgression] = useState(0);
  const [active, setActive] = useState<string>(SECTIONS[0][0]);

  useEffect(() => {
    const actualiser = () => {
      const hauteur = document.documentElement.scrollHeight - window.innerHeight;
      setProgression(hauteur > 0 ? Math.min(100, window.scrollY / hauteur * 100) : 0);
      const visible = SECTIONS
        .map(([id]) => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY }))
        .filter((section) => section.top <= window.innerHeight * 0.35)
        .at(-1);
      if (visible) setActive(visible.id);
    };
    actualiser();
    window.addEventListener('scroll', actualiser, { passive: true });
    window.addEventListener('resize', actualiser);
    return () => {
      window.removeEventListener('scroll', actualiser);
      window.removeEventListener('resize', actualiser);
    };
  }, []);

  return (
    <>
      <div className="coris-reading-progress" aria-hidden="true">
        <i style={{ width: `${progression}%` }} />
      </div>
      <aside className="coris-reading-nav" aria-label="Sommaire de l’article">
        <p>Dans cette analyse</p>
        <nav>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined}>{label}</a>
          ))}
        </nav>
      </aside>
      <button
        type="button"
        className="coris-back-top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Retour en haut de l’article"
      >
        <ArrowUp aria-hidden />
        <span>Haut</span>
      </button>
    </>
  );
}
