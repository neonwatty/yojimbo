import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMobileLayout } from './useMobileLayout';

// Create a mock matchMedia function
const createMatchMedia = (matches: boolean) => {
  return vi.fn().mockImplementation((query: string) => ({
    matches: query === '(display-mode: standalone)' ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('useMobileLayout', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const originalMatchMedia = window.matchMedia;
  const originalNavigator = window.navigator;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    // Default matchMedia mock
    window.matchMedia = createMatchMedia(false);
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'navigator', {
      writable: true,
      configurable: true,
      value: originalNavigator,
    });
  });

  describe('isMobile detection', () => {
    it('returns true when viewport width is below 768px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375, // iPhone width
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isMobile).toBe(true);
    });

    it('returns false when viewport width is 768px or above', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024, // Desktop width
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isMobile).toBe(false);
    });

    it('updates isMobile when window is resized', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isMobile).toBe(false);

      // Simulate resize to mobile
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 375,
        });
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.isMobile).toBe(true);
    });
  });

  describe('isTablet detection', () => {
    it('returns true when viewport width is between 768px and 1024px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 900, // iPad portrait width
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isTablet).toBe(true);
      expect(result.current.deviceType).toBe('tablet');
    });

    it('returns false when viewport width is below 768px (mobile)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375, // iPhone width
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isTablet).toBe(false);
      expect(result.current.deviceType).toBe('mobile');
    });

    it('returns false when viewport width is 1024px or above (desktop)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200, // Desktop width
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isTablet).toBe(false);
      expect(result.current.deviceType).toBe('desktop');
    });

    it('updates isTablet and deviceType when window is resized', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.deviceType).toBe('mobile');

      // Simulate resize to tablet
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 900,
        });
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.isTablet).toBe(true);
      expect(result.current.deviceType).toBe('tablet');

      // Simulate resize to desktop
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 1200,
        });
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.isTablet).toBe(false);
      expect(result.current.deviceType).toBe('desktop');
    });
  });

  describe('iOS detection', () => {
    it('detects iOS devices from user agent', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        configurable: true,
        value: {
          ...window.navigator,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isIOS).toBe(true);
    });

    it('returns false for non-iOS devices', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        configurable: true,
        value: {
          ...window.navigator,
          userAgent: 'Mozilla/5.0 (Linux; Android 13)',
        },
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isIOS).toBe(false);
    });
  });

  describe('standalone mode detection', () => {
    it('detects PWA standalone mode via matchMedia', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isStandalone).toBe(true);
    });

    it('detects iOS standalone mode via navigator.standalone', () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      Object.defineProperty(window, 'navigator', {
        writable: true,
        configurable: true,
        value: {
          ...window.navigator,
          standalone: true,
        },
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isStandalone).toBe(true);
    });
  });

  describe('fullscreen support', () => {
    it('reports fullscreen as supported when API is available and not iOS', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        configurable: true,
        value: {
          ...window.navigator,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.fullscreenSupported).toBe(true);
    });

    it('reports fullscreen as not supported on iOS', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        configurable: true,
        value: {
          ...window.navigator,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.fullscreenSupported).toBe(false);
    });
  });

  describe('iOS Safari detection', () => {
    it('detects Safari on iOS', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        configurable: true,
        value: {
          ...window.navigator,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        },
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isIOSSafari).toBe(true);
    });

    it('returns false for Chrome on iOS', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        configurable: true,
        value: {
          ...window.navigator,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/100.0.0.0 Mobile/15E148 Safari/604.1',
        },
      });

      const { result } = renderHook(() => useMobileLayout());
      expect(result.current.isIOSSafari).toBe(false);
    });
  });

  describe('toggleFullscreen', () => {
    it('requests fullscreen when not in fullscreen', async () => {
      const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(document.documentElement, 'requestFullscreen', {
        writable: true,
        configurable: true,
        value: requestFullscreenMock,
      });

      Object.defineProperty(document, 'fullscreenElement', {
        writable: true,
        configurable: true,
        value: null,
      });

      const { result } = renderHook(() => useMobileLayout());

      await act(async () => {
        await result.current.toggleFullscreen();
      });

      expect(requestFullscreenMock).toHaveBeenCalled();
    });

    it('exits fullscreen when in fullscreen', async () => {
      const exitFullscreenMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(document, 'exitFullscreen', {
        writable: true,
        configurable: true,
        value: exitFullscreenMock,
      });

      Object.defineProperty(document, 'fullscreenElement', {
        writable: true,
        configurable: true,
        value: document.documentElement,
      });

      const { result } = renderHook(() => useMobileLayout());

      await act(async () => {
        await result.current.toggleFullscreen();
      });

      expect(exitFullscreenMock).toHaveBeenCalled();
    });
  });
});
