import { apiPatch, apiPost } from './client';

export function updateProfile(data: {
  name?: string;
  nickname?: string;
}): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>('/api/onboarding/profile', data);
}

export function uploadAvatar(dataUrl: string): Promise<{ imageUrl: string }> {
  return apiPost<{ imageUrl: string }>('/api/onboarding/profile', { dataUrl });
}
