'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface ImageMessageProps {
  groupId: string;
  r2Key: string;
  width: number;
  height: number;
  isOwn: boolean;
}

export function ImageMessage({
  groupId,
  r2Key,
  width,
  height,
  isOwn,
}: ImageMessageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchImage() {
      // Use public R2 URL in production, API proxy in local dev
      const r2BaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
      const url = r2BaseUrl
        ? `${r2BaseUrl}/${r2Key}`
        : `/api/groups/${groupId}/images/${r2Key}`;

      // If we have a public URL, use it directly in <img> to avoid CORS fetch issues
      if (r2BaseUrl) {
        setSrc(url);
        // Loading is handled by img onLoad
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url, { credentials: 'include' });

        if (!response.ok) {
          throw new Error('Failed to load image');
        }

        const blob = await response.blob();
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setSrc(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load image');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchImage();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [groupId, r2Key]);

  const closeLightbox = useCallback(() => setLightbox(false), []);

  // Constrain rendered dimensions to a max of 280px wide
  const maxRenderWidth = 280;
  const scale = Math.min(1, maxRenderWidth / width);
  const renderWidth = Math.round(width * scale);
  const renderHeight = Math.round(height * scale);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg ${
          isOwn ? 'bg-white/10' : 'bg-[var(--surface-muted)]'
        }`}
        style={{ width: renderWidth, height: renderHeight }}
      >
        <span
          className={`text-xs ${isOwn ? 'text-blue-200' : 'text-[var(--text-muted)]'}`}
        >
          Image failed to load
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        className="relative overflow-hidden rounded-lg cursor-pointer"
        style={{ width: renderWidth, height: renderHeight }}
        onClick={() => src && setLightbox(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (src) setLightbox(true);
          }
        }}
      >
        {loading && (
          <div
            className={`absolute inset-0 animate-pulse rounded-lg ${
              isOwn ? 'bg-white/10' : 'bg-[var(--surface-muted)]'
            }`}
          />
        )}
        {src && (
          <img
            src={src}
            alt="Shared image"
            width={renderWidth}
            height={renderHeight}
            className="block rounded-lg object-cover"
            style={{ width: renderWidth, height: renderHeight }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setError('Failed to load image');
              setLoading(false);
            }}
          />
        )}
      </div>

      {/* Lightbox overlay */}
      <Dialog.Root open={lightbox && !!src} onOpenChange={setLightbox}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <Dialog.Content 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
            onPointerDownOutside={closeLightbox}
          >
            <Dialog.Title className="sr-only">Image preview</Dialog.Title>
            <Dialog.Description className="sr-only">A full-size preview of the shared image.</Dialog.Description>
            {src && (
              <img
                src={src}
                alt="Shared image (full size)"
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <Dialog.Close className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="sr-only">Close preview</span>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
