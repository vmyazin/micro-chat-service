'use client';

import { useEffect } from 'react';
import { useCallStore } from '@/stores/call-store';

export function CallFaviconUpdater() {
  const activeSession = useCallStore((state) => state.activeSession);
  const callState = useCallStore((state) => state.callState);
  
  const isActive = !!activeSession || callState === 'in-call';

  useEffect(() => {
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    
    if (!link.dataset.originalHref) {
      link.dataset.originalHref = link.href || '/icon.svg';
    }

    if (isActive) {
      link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%2322c55e"/></svg>';
    } else {
      link.href = link.dataset.originalHref;
    }
  }, [isActive]);

  return null;
}
