'use client';

import { MAX_IMAGE_HEIGHT, MAX_IMAGE_SIZE_BYTES } from '@microchat/client';
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
  compressing: boolean;
  error: string | null;
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
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.has(file.type)) {
        setError('Unsupported image format. Use JPEG, PNG, GIF, or WebP.');
        return;
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setError(`Image too large. Maximum size is ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB.`);
        return;
      }

      setCompressing(true);
      try {
        const bitmap = await createImageBitmap(file);
        let { width, height } = bitmap;

        // Scale down if height exceeds limit, maintaining aspect ratio
        if (height > MAX_IMAGE_HEIGHT) {
          const scale = MAX_IMAGE_HEIGHT / height;
          width = Math.round(width * scale);
          height = MAX_IMAGE_HEIGHT;
        }

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported in this browser.');
          return;
        }

        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const webpBlob = await canvas.convertToBlob({
          type: 'image/webp',
          quality: 0.85,
        });

        await onReady(webpBlob, width, height);
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
    compressing,
    error,
    inputProps: {
      ref: inputRef,
      type: 'file' as const,
      accept: ACCEPT_ATTR,
      className: 'hidden',
      onChange: handleChange,
    },
  };
}
