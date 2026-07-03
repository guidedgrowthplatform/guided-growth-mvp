import type { VercelResponse } from '@vercel/node';
import { classifyTarget, type DbTarget } from '@gg/shared/env/projectRefs';

export function resolveDbTarget(): DbTarget {
  return classifyTarget(`${process.env.DATABASE_URL ?? ''} ${process.env.SUPABASE_URL ?? ''}`);
}

export function isProdDb(): boolean {
  return resolveDbTarget() === 'prod';
}

export function refuseIfProd(res: Pick<VercelResponse, 'status'>): boolean {
  if (isProdDb()) {
    res
      .status(403)
      .json({ error: 'Refused: destructive endpoint blocked against the production database' });
    return true;
  }
  return false;
}
