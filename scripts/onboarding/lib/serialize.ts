export const compareKeys = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareKeys(left, right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}
