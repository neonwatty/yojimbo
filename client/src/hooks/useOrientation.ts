import { useState, useEffect } from 'react';

/**
 * Hook to detect device orientation (landscape vs portrait).
 * Updates when the device is rotated or window is resized.
 */
export function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    // Also listen for orientation change events
    const handleOrientationChange = () => {
      // Small delay to let the browser update dimensions
      setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return isLandscape;
}
