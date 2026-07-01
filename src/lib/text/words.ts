// First `n` words of `text`, preserving the original inter-word whitespace run
// so markdown/newlines survive the cut. n<=0 → '', n>=wordCount → full text.
export function sliceWords(text: string, n: number): string {
  if (n <= 0) return '';
  const re = /\s+/g;
  let count = 0;
  let idx = 0;
  // Skip any leading whitespace so the first word counts.
  const lead = /^\s+/.exec(text);
  if (lead) idx = lead[0].length;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index < idx) continue;
    count += 1;
    if (count === n) return text.slice(0, m.index);
  }
  return text; // fewer than n words present
}
