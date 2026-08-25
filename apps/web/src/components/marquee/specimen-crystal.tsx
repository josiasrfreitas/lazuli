import type { ReactNode } from "react";

/**
 * A lapis lazuli crystal, cut into facets — the specimen the 403 page displays
 * under glass, and the object the product is named after.
 *
 * Purely decorative: the page states the code and the verdict in text, so this
 * is hidden from assistive technology rather than described.
 */
export function SpecimenCrystal(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      // The glow and the outer survey arcs reach past the viewBox on purpose;
      // clipping them would cut the dashes off mid-air at the svg's edge.
      className="h-auto w-full max-w-[19rem] overflow-visible"
      fill="none"
      viewBox="0 0 240 300"
      xmlns="http://www.w3.org/2000/svg"
    >
      <SpecimenPaints />

      <circle cx="120" cy="160" fill="url(#specimen-glow)" r="130" />

      <g opacity="0.22" stroke="#8ea4e0">
        <circle cx="120" cy="158" r="118" strokeDasharray="34 12" />
        <circle cx="120" cy="158" r="140" strokeDasharray="16 26" />
      </g>

      <g>
        <polygon fill="url(#specimen-bright)" points="120,24 52,74 44,166 118,170" />
        <polygon fill="url(#specimen-mid)" points="120,24 188,76 196,168 118,170" />
        <polygon fill="url(#specimen-deep)" points="44,166 118,170 126,286" />
        <polygon fill="url(#specimen-deeper)" points="118,170 196,168 126,286" />
        {/* Glint along the lit top-left edge. It hugs the apex-to-shoulder
            line so it reads as light on the arris, not a floating patch. */}
        <polygon fill="#d5e0ff" opacity="0.28" points="120,24 52,74 64,84 121,36" />
      </g>

      <g opacity="0.4" stroke="#dbe5ff" strokeLinejoin="round" strokeWidth="1">
        <polygon points="120,24 188,76 196,168 126,286 44,166 52,74" />
        <path d="M120 24 118 170M44 166 118 170 196 168" />
      </g>

      <g fill="#d8ad4a">
        <circle cx="203" cy="94" r="2.5" />
        <circle cx="46" cy="216" r="2" />
        <circle cx="196" cy="228" r="1.8" />
      </g>
    </svg>
  );
}

/**
 * Facet paints. The stone is lit from the upper left, so the gradients run
 * bright to deep across the spine rather than each facet being flat-filled.
 */
function SpecimenPaints(): ReactNode {
  return (
    <defs>
      <radialGradient id="specimen-glow">
        <stop offset="0%" stopColor="#4c6fe0" stopOpacity="0.42" />
        <stop offset="100%" stopColor="#4c6fe0" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="specimen-bright" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#b3c6ff" />
        <stop offset="100%" stopColor="#5f7fe0" />
      </linearGradient>
      <linearGradient id="specimen-mid" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#6d8bea" />
        <stop offset="100%" stopColor="#2f4bab" />
      </linearGradient>
      <linearGradient id="specimen-deep" x1="0" x2="0.4" y1="0" y2="1">
        <stop offset="0%" stopColor="#3a55b4" />
        <stop offset="100%" stopColor="#1b2a68" />
      </linearGradient>
      <linearGradient id="specimen-deeper" x1="1" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#26377e" />
        <stop offset="100%" stopColor="#141d4a" />
      </linearGradient>
    </defs>
  );
}
