import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { User, AllowlistEntry, AuditLogEntry } from '@shared/types';

export async function fetchUsers(): Promise<User[]> {
  return apiGet<User[]>('/api/admin/users');
}

export async function updateUserRole(userId: string, role: string): Promise<User> {
  return apiPatch<User>(`/api/admin/users/${userId}/role`, { role });
}

export async function updateUserStatus(userId: string, status: string): Promise<User> {
  return apiPatch<User>(`/api/admin/users/${userId}/status`, { status });
}

export async function fetchAllowlist(): Promise<AllowlistEntry[]> {
  return apiGet<AllowlistEntry[]>('/api/admin/allowlist');
}

export async function addToAllowlist(email: string, note?: string): Promise<AllowlistEntry> {
  return apiPost<AllowlistEntry>('/api/admin/allowlist', { email, note });
}

export async function removeFromAllowlist(id: string): Promise<void> {
  await apiDelete(`/api/admin/allowlist/${id}`);
}

export async function fetchAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  return apiGet<AuditLogEntry[]>(`/api/admin/audit-log?limit=${limit}`);
}

export async function fetchUserData(userId: string): Promise<{ user_id: string; metrics: number; entries: number; reflections: number }> {
  return apiGet(`/api/admin/users/${userId}/data`);
}
