// Detect an explicit request to START the daily check-in, so the HOME-CHECKIN
// chat can route into the scripted beat flow instead of the LLM improvising it.
export function isCheckinRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  // "check in with my boss" / "check in on the kids" is social, not the feature.
  if (/check[\s-]?in (with|on)\b/.test(t)) return false;
  if (!/check[\s-]?in/.test(t)) return false;
  if (/\b(morning|evening|daily)\b/.test(t)) return true;
  if (/\b(do|start|begin|run|ready|let'?s|open|time)\b/.test(t)) return true;
  // Near-bare phrase ("check-in", "my check-in").
  return t.replace(/[^a-z]/g, '').replace('checkin', '').length <= 4;
}
