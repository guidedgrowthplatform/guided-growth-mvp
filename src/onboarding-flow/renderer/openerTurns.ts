/**
 * Split an authored opener into its turns: a newline is a TURN BREAK, one coach
 * bubble per line. The transform authors multi-prompt openers this way (e.g. the
 * profile beat's greeting / age / gender prompts, see designerToFlow's
 * resolveOpener). Single-line openers come back as a one-element array, so
 * callers render identically for both shapes. Pure leaf module (no React) so the
 * turn-break convention is unit-testable in isolation.
 */
export function openerTurns(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}
