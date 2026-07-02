// Server mirror of frontend applyName: known nickname → substituted;
// unknown → token dropped cleanly so no literal "{name}" reaches the model.
export function fillBeatName(text: string, nickname?: string | null): string {
  if (!text.includes('{name}')) return text;
  const name = (nickname ?? '').trim();
  if (name) return text.split('{name}').join(name);
  return text
    .replace(/\s*,?\s*\{name\}/g, '')
    .replace(/\{name\}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}
