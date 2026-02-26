'use client';

import { CheckIcon, CopyIcon, DownloadIcon, QrCodeIcon, XIcon } from '@phosphor-icons/react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/Button';

const LOGO_DATA_URI =
  'data:image/svg+xml;base64,' +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 252 246"><path d="M230.14,110.89C223.44,39.98,129.37,5.09,73.93,45.77c-41.32,26.58-53.29,90.76-21.44,128.96l-9.2,45.73,40.95-21.35c15.17,7.79,30.73,9.72,46.67,10.43,2.03-.99,2.7-3.39,2.01-7.22-.42-3.81,57.13-56.49,63.8-53.14,5.16,2.02,23.78,9.52,25.76,5.25,6.34-13.61,9.18-28.41,7.66-43.55Z" fill="#213f5e"/><path d="M223.14,153.13c-7.48,18.79-20.68,32.62-38.33,42.08-.7-.12-1.39-.28-2.03-.56-3.72-1.64-13.07-23.4-14.86-28.71l.57-3.73-.99-1.94c2.51-8.08,3.4-16.71,2.66-25.88l2.03-1.36c15.33,11.39,31.79,19.09,50.95,20.1Z" fill="#2b87b4"/><path d="M184.81,195.21c-16.54,8.86-34.42,15.21-53.91,14.34l.06-40.47.85-2.01c10.41.69,20.42-.14,30.05-2.5,2.34-2,4.55-2.79,6.62-2.36,4.93,11.23,9.16,23.08,16.32,33Z" fill="#265677"/><path d="M73.93,45.77c-.55.62-.94,1.49-2.02,1.19.64-.44,1.14-1.16,2.02-1.19Z" fill="#265677"/><path d="M131.88,66.58c21.59.58,27.95,7.56,34.23,18.61,8.71,15.35,7.87,70.21,2.38,77.02-7.78,9.66-26.8,8.74-37.53,9.08-15.06.47-39.58,1.18-40.58-19.52-.81-19.23-2.48-45.76,6.23-64.14,5.23-11.03,13.5-21.63,35.26-21.05Z" fill="#fcfdfd"/><path d="M146.13,110.98c1.59-8.13-.47-15.69-8.39-19.25-19.47-7.52-31.19,18.12-13.57,29.23-.83,8.33-2.42,17.67-3.48,26.27,0,0,14.4.23,21.51.03l-3.31-26.38c4.01-1.61,6.67-6.98,7.24-9.89Z" fill="#1d304d"/></svg>`,
  );

interface InviteQRDialogProps {
  open: boolean;
  onClose: () => void;
  inviteLink: string;
  groupName?: string;
}

export default function InviteQRDialog({
  open,
  onClose,
  inviteLink,
  groupName,
}: InviteQRDialogProps) {
  const t = useTranslations('InviteQRDialog');
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleCopyImage = async () => {
    try {
      if (!qrRef.current) return;

      const canvas = qrRef.current.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) return;

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy QR code:', err);
    }
  };

  const handleDownload = () => {
    try {
      if (!qrRef.current) return;

      const canvas = qrRef.current.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) return;

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `invite-qr-${Date.now()}.png`;
      link.click();

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch (err) {
      console.error('Failed to download QR code:', err);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            {/* Dialog content */}
            <Dialog.Content
              asChild
              onEscapeKeyDown={(e) => {
                // Allow escape to close
              }}
            >
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-full max-w-sm rounded-2xl bg-(--background) border border-(--border-color) shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-color)">
                    <div className="flex items-center gap-2">
                      <QrCodeIcon className="w-5 h-5 text-(--accent)" />
                      <Dialog.Title className="text-lg font-semibold text-(--text-primary)">
                        {t('title')}
                      </Dialog.Title>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      className="p-1.5 rounded-full hover:bg-(--surface-muted) transition-colors"
                    >
                      <XIcon className="w-5 h-5 text-(--text-secondary)" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-4">
                    <Dialog.Description className="text-sm text-(--text-secondary)">
                      {t('description')}
                    </Dialog.Description>

                    {/* QR Code */}
                    <div className="flex justify-center py-4">
                      <div
                        ref={qrRef}
                        className="p-4 bg-white rounded-lg border-2 border-(--border-color)"
                      >
                        <QRCodeCanvas
                          value={inviteLink}
                          size={256}
                          level="H"
                          includeMargin={true}
                          imageSettings={{
                            src: LOGO_DATA_URI,
                            height: 56,
                            width: 56,
                            excavate: true,
                          }}
                        />
                      </div>
                    </div>

                    {groupName && (
                      <p className="text-xs text-center text-(--text-muted) px-2">
                        {t('groupLabel')}: <span className="font-medium text-(--text-primary)">{groupName}</span>
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="secondary"
                        onClick={handleCopyImage}
                        className="flex-1 flex items-center justify-center gap-2 text-sm"
                      >
                        {copied ? (
                          <>
                            <CheckIcon className="w-4 h-4" />
                            {t('copied')}
                          </>
                        ) : (
                          <>
                            <CopyIcon className="w-4 h-4" />
                            {t('copyImage')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleDownload}
                        className="flex-1 flex items-center justify-center gap-2 text-sm"
                      >
                        {downloaded ? (
                          <>
                            <CheckIcon className="w-4 h-4" />
                            {t('downloaded')}
                          </>
                        ) : (
                          <>
                            <DownloadIcon className="w-4 h-4" />
                            {t('download')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
