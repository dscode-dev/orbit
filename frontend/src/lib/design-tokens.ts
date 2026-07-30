/**
 * ORBIT V2 — Design Tokens (typed mirror of src/styles.css)
 *
 * Use these when a value is needed in TypeScript (charts, motion, canvas).
 * For styling, always prefer the Tailwind classes generated from the CSS tokens.
 */

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "3rem",
  "4xl": "4rem",
} as const;

export const radius = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  full: "9999px",
} as const;

export const shadow = {
  soft: "var(--shadow-soft)",
  elevated: "var(--shadow-elevated)",
  float: "var(--shadow-float)",
  glow: "var(--shadow-glow)",
} as const;

export const blur = {
  glass: "var(--blur-glass)",
  panel: "var(--blur-panel)",
} as const;

export const zIndex = {
  base: 0,
  sticky: 20,
  drawer: 40,
  overlay: 50,
  toast: 60,
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export const chartColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
] as const;

/** Motion primitives — fast, natural, never showy. */
export const easeOrbit = [0.22, 1, 0.36, 1] as const;

export const motionDuration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.4,
} as const;

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: motionDuration.base, ease: easeOrbit },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: motionDuration.base, ease: easeOrbit },
};

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadow;
