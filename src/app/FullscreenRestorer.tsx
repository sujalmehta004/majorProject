'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function FullscreenRestorer() {
  const pathname = usePathname();

  useEffect(() => {
    const wantsFullscreen = localStorage.getItem('app_fullscreen') === 'true';
    
    if (wantsFullscreen && !document.fullscreenElement) {
      // Run with standard micro-delay to let the DOM settle on new route mount
      const timer = setTimeout(() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.warn("Fullscreen request bypassed:", err);
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  useEffect(() => {
    // Only listen and clear if page is active/focused to prevent background tabs from resetting the state
    const handleFsChange = () => {
      if (!document.fullscreenElement && document.visibilityState === 'visible') {
        localStorage.setItem('app_fullscreen', 'false');
      }
    };
    
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  return null;
}
