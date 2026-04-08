import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ImagePreviewModalProps {
  file: File | null;
  onConfirm: (file: File) => Promise<void>;
  onClose: () => void;
}

export function ImageCropModal({ file, onConfirm, onClose }: ImagePreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Create preview URL
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Lock body scroll
  useEffect(() => {
    if (!file) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [file]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onConfirm(file);
    } finally {
      setUploading(false);
    }
  };

  if (!file || !previewUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={uploading ? undefined : onClose}
    >
      <div
        className="relative mx-4 flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold text-content">Preview Image</h2>
          {!uploading && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-content-tertiary transition-colors hover:bg-surface-secondary hover:text-content"
              aria-label="Close"
            >
              <Icon icon="mdi:close" width={20} height={20} />
            </button>
          )}
        </div>

        {/* Image preview */}
        <div className="flex items-center justify-center bg-surface-secondary p-4">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[50vh] max-w-full rounded-lg object-contain"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-border px-5 pb-4 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-content transition-colors hover:bg-surface-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-80"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Uploading…
              </span>
            ) : (
              'Upload'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
