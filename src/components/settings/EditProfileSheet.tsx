import { Icon } from '@iconify/react';
import { useRef, useState } from 'react';
import { track } from '@/analytics';
import { updateProfile, uploadAvatar } from '@/api/profile';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/contexts/ToastContext';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  onClose: () => void;
  initialName: string;
  initialNickname: string | null;
  initialAvatarUrl: string | null;
}

export function EditProfileSheet({
  onClose,
  initialName,
  initialNickname,
  initialAvatarUrl,
}: Props) {
  const { addToast } = useToast();
  const updateProfileStore = useAuthStore((s) => s.updateProfile);

  const [name, setName] = useState(initialName);
  const [nickname, setNickname] = useState(initialNickname ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials =
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast('error', 'Image must be under 2 MB');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarPreview(dataUrl);
      setPendingDataUrl(dataUrl);
    };
    reader.onerror = () => {
      addToast('error', 'Failed to read image file');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedNickname = nickname.trim();

    if (!trimmedName) {
      addToast('error', 'Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const nameChanged = trimmedName !== initialName;
      const nicknameChanged = trimmedNickname !== (initialNickname ?? '');
      const avatarChanged = pendingDataUrl !== null;

      if (nameChanged || nicknameChanged) {
        await updateProfile({
          ...(nameChanged ? { name: trimmedName } : {}),
          ...(nicknameChanged ? { nickname: trimmedNickname } : {}),
        });
      }

      if (pendingDataUrl) {
        await uploadAvatar(pendingDataUrl);
      }

      await updateProfileStore();

      const fieldsChanged: string[] = [];
      if (nameChanged) fieldsChanged.push('name');
      if (nicknameChanged) fieldsChanged.push('nickname');
      if (avatarChanged) fieldsChanged.push('avatar');
      if (fieldsChanged.length > 0) {
        track('update_profile', { fields_changed: fieldsChanged });
      }

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save profile';
      addToast('error', message);
      setAvatarPreview(initialAvatarUrl);
      setPendingDataUrl(null);
      await updateProfileStore().catch(() => {});
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet onClose={onClose} preventClose={saving}>
      <div className="px-6 pb-8 pt-2">
        <h2 className="mb-6 text-xl font-bold text-content">Edit Profile</h2>

        {/* Avatar */}
        <div className="mb-6 flex flex-col items-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-surface-secondary shadow-card">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-primary">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary shadow-sm"
            >
              <Icon icon="lucide:camera" width={14} className="text-white" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-sm font-semibold text-primary"
          >
            Change photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold text-content">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-content outline-none focus:border-primary"
          />
        </div>

        {/* Nickname */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-semibold text-content">Nickname</label>
          <div className="flex items-center rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary">
            <span className="mr-1 text-base text-content-secondary">@</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={50}
              placeholder="nickname"
              className="flex-1 bg-transparent text-base text-content outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-content-secondary">
            Letters, numbers, and underscores only
          </p>
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-full bg-primary py-3 text-base font-bold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </BottomSheet>
  );
}
