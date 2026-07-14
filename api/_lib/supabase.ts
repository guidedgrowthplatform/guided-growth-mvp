import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy: createClient throws when the service-role key is unset, so building it at
// import time makes every transitive importer explode under test envs that never
// touch Supabase. Defer construction to first property access instead.
let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } },
    );
  }
  return client;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    return Reflect.get(getClient(), prop, getClient());
  },
});
