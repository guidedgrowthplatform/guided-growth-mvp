export function isEditorEmpty(html: string): boolean {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  return stripped.length === 0 && !/<img\s/i.test(html) && !/<hr\s*\/?>/i.test(html);
}
