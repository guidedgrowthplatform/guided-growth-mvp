import { apiPost } from './client';

export async function uploadJournalImage(file: File): Promise<string> {
  const MAX_SIZE = 3 * 1024 * 1024; // 3MB (base64 inflates ~33%, must fit Vercel's 4.5MB body limit)
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Image must be under 3MB');
  }

  // Convert to base64 using FileReader (natively optimized)
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix (e.g. "data:image/png;base64,")
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const result = await apiPost<{ url: string }>('/api/reflections/journal?action=upload', {
    data: base64,
    contentType: file.type,
  });

  return result.url;
}
