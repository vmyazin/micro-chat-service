'use client';

import { IMAGE_QUALITY, MAX_IMAGE_HEIGHT, MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_WIDTH } from '@microchat/client';
import { useCallback, useRef, useState } from 'react';

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
]);

const ACCEPT_ATTR = 'image/jpeg,image/png,image/gif,image/webp,image/heic';

interface UseImagePickerOptions {
  onReady: (blob: Blob, width: number, height: number) => Promise<void>;
}

interface UseImagePickerReturn {
  pickImage: () => void;
  processFile: (file: File) => Promise<boolean>;
  compressing: boolean;
  error: string | null;
  clearError: () => void;
  inputProps: {
    ref: React.RefObject<HTMLInputElement | null>;
    type: 'file';
    accept: string;
    className: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
}

export function useImagePicker({
  onReady,
}: UseImagePickerOptions): UseImagePickerReturn {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File): Promise<boolean> => {
      setError(null);
      let success = false;

      try {
        if (!ACCEPTED_TYPES.has(file.type)) {
          setError('Unsupported image format. Use JPEG, PNG, GIF, or WebP.');
          return false;
        }

        setCompressing(true);

        const bitmap = await createImageBitmap(file);
        let { width, height } = bitmap;

        // Scale down to fit within max dimensions, maintaining aspect ratio
        const scale = Math.min(1, MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);
        if (scale < 1) {
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported in this browser.');
          return false;
        }

        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const webpBlob = await canvas.convertToBlob({
          type: 'image/webp',
          quality: IMAGE_QUALITY,
        });

        // Check compressed size
        if (webpBlob.size > MAX_IMAGE_SIZE_BYTES) {
          setError(`Compressed image too large (${(webpBlob.size / 1024).toFixed(0)} KB). Try a simpler image.`);
          return false;
        }

        await onReady(webpBlob, width, height);
        success = true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to process image.',
        );
      } finally {
        setCompressing(false);
        // Reset input so same file can be re-selected
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }

      return success;
    },
    [onReady],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile],
  );

  const pickImage = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    pickImage,
    processFile,
    compressing,
    error,
    clearError: () => setError(null),
    inputProps: {
      ref: inputRef,
      type: 'file' as const,
      accept: ACCEPT_ATTR,
      className: 'hidden',
      onChange: handleChange,
    },
  };
}
