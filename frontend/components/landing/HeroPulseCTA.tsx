"use client";

// Orphelin depuis c1be40b (Phase 13) — HeroDeviceMockup (production) n'utilise
// plus ce composant. Conservé sur demande explicite, ne pas réutiliser sans
// vérifier que ce choix tient toujours.
import Link from "next/link";
import { PulseBeams } from "@/components/ui/pulse-beams";

// Deux faisceaux cyan/teal partant du CTA (effet hero — nécessite de l'espace).
const beams = [
  {
    path: "M260 80H20C14 80 10 84 10 90V140",
    gradientConfig: {
      initial: { x1: "0%", x2: "0%", y1: "80%", y2: "100%" },
      animate: { x1: ["0%", "0%", "180%"], x2: ["0%", "0%", "160%"], y1: ["80%", "0%", "0%"], y2: ["100%", "20%", "20%"] },
      transition: { duration: 2.2, repeat: Infinity, repeatType: "loop" as const, ease: "linear" as const, repeatDelay: 1.6 },
    },
    connectionPoints: [
      { cx: 10, cy: 140, r: 4 },
      { cx: 260, cy: 80, r: 4 },
    ],
  },
  {
    path: "M300 80H520C526 80 530 76 530 70V18",
    gradientConfig: {
      initial: { x1: "20%", x2: "0%", y1: "80%", y2: "100%" },
      animate: { x1: ["20%", "100%", "100%"], x2: ["0%", "90%", "90%"], y1: ["80%", "80%", "-20%"], y2: ["100%", "100%", "0%"] },
      transition: { duration: 2.2, repeat: Infinity, repeatType: "loop" as const, ease: "linear" as const, repeatDelay: 1.8 },
    },
    connectionPoints: [
      { cx: 530, cy: 18, r: 4 },
      { cx: 300, cy: 80, r: 4 },
    ],
  },
];

const gradientColors = { start: "#16d9ff", middle: "#1d9bf0", end: "#7dd3fc" };

/** CTA hero « Créer un compte gratuit » avec les vrais faisceaux PulseBeams. */
export function HeroPulseCTA() {
  return (
    <PulseBeams
      beams={beams}
      gradientColors={gradientColors}
      baseColor="#1e3a47"
      accentColor="#22d3ee"
      className="bg-transparent py-6"
    >
      <Link
        href="/signup"
        className="landing-hero-cta relative z-10 inline-flex min-h-[48px] items-center rounded-full px-6 text-sm font-bold text-[#03222b] shadow-gold"
      >
        Créer un compte gratuit
      </Link>
    </PulseBeams>
  );
}
