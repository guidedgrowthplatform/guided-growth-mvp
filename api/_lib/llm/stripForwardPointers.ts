// >=2 hyphen segments — excludes bare words (CHAT, DO, NOT) to dodge prose collisions.
const SCREEN_ID = String.raw`[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+`;

// Header list is a fallback for any future divider-less row.
const SECTION_BOUNDARY = new RegExp(
  String.raw`(?:^|\n)\s*(?:` +
    [
      String.raw`--- SUPPLEMENTARY ---`,
      String.raw`AI RESPONSE PATTERN:`,
      String.raw`SYSTEM ACTIONS?:`,
      String.raw`EXPECTED USER RESPONSE:`,
      String.raw`VOICE INSTRUCTIONS:`,
      String.raw`VOICE_ACTIONS`,
      String.raw`EDGE CASES:`,
      String.raw`NOTES:`,
      String.raw`CRISIS BOUNDARY:`,
    ].join('|') +
    String.raw`)`,
  'm',
);

const NEXT_LINE = /^[ \t]*NEXT:.*$/gm;
const ARROW_POINTER = new RegExp(String.raw`\s*(?:->|→)\s*${SCREEN_ID}`, 'g');
const ARROW_PATH = /\s*(?:->|→)\s*(?:beginner|advanced)\s+path\b/gi;
const PARENTHETICAL = new RegExp(String.raw`\s*\(${SCREEN_ID}\)`, 'g');
const NAVIGATE_TO = new RegExp(String.raw`\bnavigate to\s+${SCREEN_ID}`, 'gi');
const ROUTE_TO = new RegExp(String.raw`\broute to\s+(?:${SCREEN_ID}|beginner|advanced)\b`, 'gi');
const ROUTE_BASED = /\bRoute based on (?:the )?answer:?/gi;

export function stripForwardPointers(contextBlock: string): string {
  const boundary = SECTION_BOUNDARY.exec(contextBlock);
  let head = boundary ? contextBlock.slice(0, boundary.index) : contextBlock;

  head = head
    .replace(NEXT_LINE, '')
    .replace(ARROW_POINTER, '')
    .replace(ARROW_PATH, '')
    .replace(PARENTHETICAL, '')
    .replace(NAVIGATE_TO, 'continue')
    .replace(ROUTE_TO, 'continue')
    .replace(ROUTE_BASED, '');

  return head
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
