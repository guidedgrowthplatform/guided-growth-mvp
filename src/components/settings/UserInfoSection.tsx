import { Icon } from '@iconify/react';

interface Props {
  name: string;
  email: string;
  nickname?: string | null;
  avatarUrl?: string;
  onEditProfile?: () => void;
  onChangePhoto?: () => void;
}

export function UserInfoSection({
  name,
  email,
  nickname,
  avatarUrl,
  onEditProfile,
  onChangePhoto,
}: Props) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center pb-4 pt-6">
      <div className="relative">
        <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-surface bg-surface-secondary shadow-card">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-4xl font-bold text-primary">{initials}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onChangePhoto}
          className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-primary shadow-sm"
        >
          <Icon icon="lucide:camera" width={12} className="text-white" />
        </button>
      </div>
      <h2 className="mt-4 text-2xl font-bold text-primary">{name}</h2>
      {nickname && <p className="text-sm font-semibold text-primary">@{nickname}</p>}
      <p className="text-base font-medium text-content-secondary">{email}</p>
      <button
        type="button"
        onClick={onEditProfile}
        className="mt-4 rounded-full bg-primary/10 px-6 py-2 text-sm font-bold tracking-wide text-primary"
      >
        Edit Profile
      </button>
    </div>
  );
}
