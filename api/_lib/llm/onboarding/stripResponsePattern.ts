// AI RESPONSE PATTERN scripts quote the next screen's opening line — text path reads them out
const AI_RESPONSE_PATTERN_SECTION = /^AI RESPONSE PATTERN:.*?(?=^SYSTEM ACTIONS?:)/ms;

export function stripResponsePattern(contextBlock: string): string {
  return contextBlock.replace(AI_RESPONSE_PATTERN_SECTION, '').replace(/\n{3,}/g, '\n\n');
}
