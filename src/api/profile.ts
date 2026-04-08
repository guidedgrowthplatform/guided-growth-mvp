import { apiGet, apiPatch, apiPost } from './client';

export interface ProfileData {
  name: string | null;
  nickname: string | null;
  image: string | null;
}

export function getProfile(): Promise<ProfileData> {
  return apiGet<ProfileData>('/api/onboarding/profile');
}

export function updateProfile(data: { name?: string; nickname?: string }): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>('/api/onboarding/profile', data);
}

export function uploadAvatar(dataUrl: string): Promise<{ imageUrl: string }> {
  return apiPost<{ imageUrl: string }>('/api/onboarding/profile/avatar', { dataUrl });
}
