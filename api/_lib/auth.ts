import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { handleCors } from './cors.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
if (!supabaseUrl) {
  console.error('[auth] SUPABASE_URL is not set — auth verification will fail');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
}

export async function getUser(req: VercelRequest): Promise<AuthenticatedUser | null> {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7); // Remove 'Bearer '

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }

    // Extract role and status from JWT app_metadata (set by custom_access_token_hook)
    const claims = user.app_metadata as { role?: string; status?: string };

    return {
      id: user.id,
      email: user.email!,
      role: (claims.role ?? 'user') as 'user' | 'admin',
      status: (claims.status ?? 'active') as 'active' | 'disabled',
    };
  } catch {
    return null;
  }
}

export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthenticatedUser | null> {
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  if (user.status === 'disabled') {
    res.status(403).json({ error: 'Account disabled' });
    return null;
  }
  return user;
}

export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthenticatedUser | null> {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}

export async function setUserContext(_userId: string) {
  // No-op
}

// Returns true if OPTIONS preflight was handled
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  return handleCors(req, res);
}
