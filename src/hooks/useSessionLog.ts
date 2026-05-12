import { useContext } from 'react';
import { SessionLogContext } from '@/contexts/SessionLogContext';

export function useSessionLog() {
  const ctx = useContext(SessionLogContext);
  if (!ctx) {
    throw new Error('useSessionLog must be used within <SessionLogProvider>');
  }
  return ctx;
}
