import { classifyTarget, type DbTarget } from '@gg/shared/env/projectRefs';

export function resolveDbTarget(): DbTarget {
  return classifyTarget(`${process.env.DATABASE_URL ?? ''} ${process.env.SUPABASE_URL ?? ''}`);
}

export function isProdDb(): boolean {
  return resolveDbTarget() === 'prod';
}

export function refuseIfProd(res: {
  status: (code: number) => { json: (body: unknown) => unknown };
}): boolean {
  if (isProdDb()) {
    res
      .status(403)
      .json({ error: 'Refused: destructive endpoint blocked against the production database' });
    return true;
  }
  return false;
}
