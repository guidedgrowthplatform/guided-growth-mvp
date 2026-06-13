// Strip em/en dashes and dash-as-pause hyphens from user-facing coach copy.
// Keeps hyphenated words ("check-in"), numeric ranges ("5 - 10"), and paragraph
// breaks intact.
export function sanitizeCoachText(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/(\D) - (\D)/g, '$1, $2') // spaced hyphen-as-dash, but not numeric ranges
    .replace(/([.!?]),/g, '$1') // a dash after sentence punctuation became ". ," → "."
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ', ')
    .replace(/^,\s*/, '') // leading comma left by a leading dash
    .replace(/[ \t]{2,}/g, ' ') // collapse spaces only, preserve newlines
    .trim();
}
