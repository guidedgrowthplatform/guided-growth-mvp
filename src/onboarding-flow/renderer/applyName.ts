/**
 * {name} templating, ported from the flow builder (FlowBuilder.tsx applyName).
 *
 * The builder lets beat copy carry a {name} token that is substituted with the
 * user's name at render time (a single global name input drives the whole flow).
 * In the running engine the name is captured at the auth beat and lives in the
 * accumulated answers as `nickname`, so we substitute from there. When no name is
 * known yet, fall back to a warm neutral so a templated line still reads cleanly.
 */
export function applyName(text: string, name?: string | null): string {
  if (!text.includes('{name}')) return text;
  const safe = (name ?? '').trim() || 'there';
  return text.split('{name}').join(safe);
}
