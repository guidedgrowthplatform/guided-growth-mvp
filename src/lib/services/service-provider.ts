// Service Provider — toggle between Mock and Supabase backends
// Set VITE_USE_SUPABASE=true in .env.local to use Supabase

import type { DataService } from './data-service.interface';
import { mockDataService } from './mock-data-service';

// 🚧 AUTH BYPASS: set to true for local dev/testing (uses MockDataService + test user)
export const AUTH_BYPASS = true;

// Auto-detect Supabase mode: if VITE_SUPABASE_URL is set to a real URL, use Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const useSupabase = !AUTH_BYPASS && supabaseUrl.length > 0 && !supabaseUrl.includes('placeholder');

let _service: DataService | null = null;
let _initPromise: Promise<DataService> | null = null;

function initService(): Promise<DataService> {
  if (_initPromise) return _initPromise;

  if (useSupabase) {
    _initPromise = import('./supabase-data-service').then(mod => {
      _service = mod.supabaseDataService;
      console.log('[ServiceProvider] Using SupabaseDataService');
      return _service;
    });
  } else {
    _service = mockDataService;
    console.log('[ServiceProvider] Using MockDataService (localStorage)');
    _initPromise = Promise.resolve(_service);
  }

  return _initPromise;
}

// Start initialization at import time
initService();

export async function getDataService(): Promise<DataService> {
  return initService();
}

// Synchronous getter — returns mock if supabase not yet loaded
// Note: does NOT cache mock into _service to avoid poisoning the singleton
export function getDataServiceSync(): DataService {
  if (_service) return _service;
  // Return mock temporarily without caching — async init will set _service correctly
  return mockDataService;
}

// Reset (for testing)
export function resetServiceProvider(): void {
  _service = null;
  _initPromise = null;
}

