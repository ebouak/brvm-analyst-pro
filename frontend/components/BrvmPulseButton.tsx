"use client";

import Link from "next/link";
import { PulseBeams } from "@/components/ui/pulse-beams";

const beams = [
  {
    path: "M260 80H20C14 80 10 84 10 90V140",
    gradientConfig: {
      initial: { x1: "0%", x2: "0%", y1: "80%", y2: "100%" },
      animate: {
        x1: ["0%", "0%", "180%"],
        x2: ["0%", "0%", "160%"],
        y1: ["80%", "0%", "0%"],
        y2: ["100%", "20%", "20%"],
      },
      transition: {
        duration: 2.2,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "linear" as const,
        repeatDelay: 1.6,
      },
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
      animate: {
        x1: ["20%", "100%", "100%"],
        x2: ["0%", "90%", "90%"],
        y1: ["80%", "80%", "-20%"],
        y2: ["100%", "100%", "0%"],
      },
      transition: {
        duration: 2.2,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "linear" as const,
        repeatDelay: 1.8,
      },
    },
    connectionPoints: [
      { cx: 530, cy: 18, r: 4 },
      { cx: 300, cy: 80, r: 4 },
    ],
  },
];

// Palette cyan / bleu / teal — cohérente avec l'univers finance / market data.
const gradientColors = {
  start: "#16d9ff",
  middle: "#1d9bf0",
  end: "#7dd3fc",
};

export function BrvmPulseButton({ href = "/terminal" }: { href?: string }) {
  return (
    <PulseBeams
      beams={beams}
      gradientColors={gradientColors}
      baseColor="#1e3a47"
      accentColor="#22d3ee"
      className="bg-transparent py-10"
    >
      <Link
        href={href}
        className="group relative z-10 inline-flex h-14 items-center justify-center rounded-full border border-white/10 bg-[#0b1620] px-7 text-sm font-medium text-white shadow-[0_0_40px_rgba(0,0,0,0.35)]"
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(80%_120%_at_50%_0%,rgba(34,211,238,0.22)_0%,rgba(34,211,238,0)_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <span className="relative bg-gradient-to-r from-cyan-200 via-sky-100 to-cyan-200 bg-clip-text text-transparent">
          Ouvrir le terminal
        </span>
      </Link>
    </PulseBeams>
  );
}
