import type { DataService } from './data-service.interface';
import { mockDataService } from './mock-data-service';

// Auto-detect Supabase mode: if VITE_SUPABASE_URL is set to a real URL, use Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const useSupabase = supabaseUrl.length > 0 && !supabaseUrl.includes('placeholder');

let _service: DataService | null = null;
let _initPromise: Promise<DataService> | null = null;

function initService(): Promise<DataService> {
  if (_initPromise) return _initPromise;

  if (useSupabase) {
    _initPromise = import('./supabase-data-service').then((mod) => {
      _service = mod.supabaseDataService;
      if (import.meta.env.DEV) console.log('[ServiceProvider] Using SupabaseDataService');
      return _service;
    });
  } else {
    _service = mockDataService;
    if (import.meta.env.DEV) console.log('[ServiceProvider] Using MockDataService (localStorage)');
    _initPromise = Promise.resolve(_service);
  }

  return _initPromise;
}

// Start initialization at import time
initService();

export async function getDataService(): Promise<DataService> {
  return initService();
}
