export async function sha256Hash(value: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoded = new TextEncoder().encode(value);
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(buffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `anon_${hex}`;
  }

  const { createHash } = await import('node:crypto');
  const hex = createHash('sha256').update(value).digest('hex');
  return `anon_${hex}`;
}

export async function anonymizeFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): Promise<T> {
  const copy = { ...obj };
  for (const field of fields) {
    const val = copy[field];
    if (typeof val === 'string' && val.length > 0) {
      (copy as Record<string, unknown>)[field as string] = await sha256Hash(val);
    }
  }
  return copy;
}
