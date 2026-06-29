/**
 * _beatStyle.ts, shared visual foundation for all flow-designer beats.
 *
 * The underscore prefix keeps the beat-glob from auto-registering this file
 * as a beat. Import from this module instead of copy-pasting the same font
 * stack, color literals, and card shape into every beat file.
 *
 * All colors map directly to the CSS custom properties in src/index.css so
 * that a theme change there propagates here without touching beat files.
 * Use the helper `cssRgb` or `cssColor` when you need a string value; use
 * the plain constants in style objects that accept rgb() or rgba() strings.
 *
 * Rules in force everywhere beats use this file:
 *   - No em dashes in any string, comment, or copy. Use commas or periods.
 *   - The coach never says tap, scroll, click, or press.
 */

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/** The product font stack. Use this in every inline fontFamily declaration. */
export const FONT =
  "Urbanist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ---------------------------------------------------------------------------
// Color palette, mapped to the CSS tokens in src/index.css
// ---------------------------------------------------------------------------

/**
 * Raw RGB triplets (no `rgb()` wrapper) matching the CSS custom property values
 * declared in :root. Use these with the helpers below to build color strings.
 *
 *   --color-primary:          19 91 235
 *   --color-text:             15 23 42
 *   --color-text-secondary:   100 116 139
 *   --color-text-subtle:      51 65 85
 *   --color-border:           226 232 240
 *   --color-border-light:     241 245 249
 *   --color-surface:          255 255 255
 *   --color-surface-secondary:245 247 250
 *   --color-primary-bg:       232 237 245
 */

/** Guided Growth blue. rgb(19, 91, 235). */
export const PRIMARY = 'rgb(19,91,235)' as const;
/** Guided Growth blue at full opacity as an rgba() string (identical to PRIMARY). */
export const PRIMARY_SOLID = 'rgba(19,91,235,1)' as const;

/** Deep ink for body text and headings. */
export const INK = 'rgb(15,23,42)' as const;

/** Muted body text: secondary labels, descriptions. */
export const SUBTLE = 'rgb(100,116,139)' as const;

/** Slightly darker muted text (--color-text-subtle). */
export const SUBTLE_DARK = 'rgb(51,65,85)' as const;

/** Standard card and section border. */
export const BORDER = 'rgb(226,232,240)' as const;

/** Extra-light divider border. */
export const BORDER_LIGHT = 'rgb(241,245,249)' as const;

/** Pure white card surface. */
export const SURFACE = 'rgb(255,255,255)' as const;

/** Off-white secondary surface. */
export const SURFACE_SECONDARY = 'rgb(245,247,250)' as const;

/**
 * The coach background: a soft blue gradient used on every coach-turn beat.
 * Apply as `background` on the beat's outermost container.
 */
export const COACH_BG = 'linear-gradient(180deg, #E8EEFC 0%, #C9D8F7 100%)' as const;

/**
 * The user background: warm cream used on every user-turn / form beat.
 * Apply as `background` on the beat's outermost container.
 */
export const USER_BG = 'linear-gradient(180deg, #FCF6E6 0%, #F6E9C2 100%)' as const;

// ---------------------------------------------------------------------------
// Orb ring sizing, shared between BeatOrb and the animated sequences
// ---------------------------------------------------------------------------

/**
 * Proportional ring-step ratio: step = Math.round(orbSize * ORB_RING_RATIO).
 *
 * This value keeps the concentric pulse rings at a consistent visual spread
 * relative to orb diameter across all sizes (56px canvas orb, 150px full
 * sequences). Derived from the midpoint between the two previously divergent
 * values so both converge to the same proportional look.
 *
 *   56px orb:  Math.round(56  * 0.053) = 3
 *   150px orb: Math.round(150 * 0.053) = 8
 */
export const ORB_RING_RATIO = 0.053 as const;

/**
 * Compute the ringStep for a given orb diameter so the ring spread looks
 * proportionally identical at any size.
 *
 * Pass the result to DualButton's `ringStep` prop.
 */
export function orbRingStep(orbSize: number): number {
  return Math.max(2, Math.round(orbSize * ORB_RING_RATIO));
}

// ---------------------------------------------------------------------------
// Shared card style
// ---------------------------------------------------------------------------

/**
 * Standard white rounded card. Apply as a React `style` object (or spread it).
 *
 * Matches the card shape in HabitScheduleCard and the v3 mock: white, 20px
 * radius, one soft shadow. The border-radius mirrors --radius-xl from index.css.
 */
export const CARD: React.CSSProperties = {
  background: SURFACE,
  borderRadius: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
  padding: '12px 16px',
};

// ---------------------------------------------------------------------------
// Section / form label
// ---------------------------------------------------------------------------

/**
 * Uppercase section label style, matching the `.lbl` class in the v3 mock.
 * Use on <p> or <span> above a chip row or picker.
 */
export const SECTION_LABEL: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: SUBTLE,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Standard spacing scale (px)
// ---------------------------------------------------------------------------

/** Spacing tokens: align beats without hardcoded magic numbers. */
export const SPACE = {
  /** 4px, tight gap between label and control. */
  xs: 4,
  /** 8px, inner card gap. */
  sm: 8,
  /** 12px, between stacked cards or form rows. */
  md: 12,
  /** 16px, outer padding of cards and bubbles. */
  lg: 16,
  /** 24px, section gap. */
  xl: 24,
} as const;
