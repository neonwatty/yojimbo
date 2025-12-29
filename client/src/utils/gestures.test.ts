import { describe, it, expect } from 'vitest';
import {
  detectTouchZone,
  calculateSwipe,
  determineSwipeAction,
  isVerticalSwipe,
  isSwipeThresholdMet,
} from './gestures';

describe('gestures', () => {
  describe('detectTouchZone', () => {
    const containerTop = 100;
    const containerHeight = 800;

    it('returns "top" when touch is in top zone', () => {
      expect(detectTouchZone(110, containerTop, containerHeight)).toBe('top');
      expect(detectTouchZone(150, containerTop, containerHeight)).toBe('top');
    });

    it('returns "bottom" when touch is in bottom zone', () => {
      expect(detectTouchZone(850, containerTop, containerHeight)).toBe('bottom');
      expect(detectTouchZone(890, containerTop, containerHeight)).toBe('bottom');
    });

    it('returns null when touch is in the middle zone', () => {
      expect(detectTouchZone(400, containerTop, containerHeight)).toBe(null);
      expect(detectTouchZone(500, containerTop, containerHeight)).toBe(null);
    });

    it('respects custom zone heights', () => {
      const config = { topZoneHeight: 100, bottomZoneHeight: 100 };

      // With larger zones
      expect(detectTouchZone(190, containerTop, containerHeight, config)).toBe('top');
      expect(detectTouchZone(810, containerTop, containerHeight, config)).toBe('bottom');
    });

    it('handles edge cases at zone boundaries', () => {
      // At exactly 60px from top (default zone height) - just outside zone
      expect(detectTouchZone(160, containerTop, containerHeight)).toBe(null);

      // Just inside top zone
      expect(detectTouchZone(159, containerTop, containerHeight)).toBe('top');

      // Just inside bottom zone (container goes from 100-900, bottom zone starts at 840)
      expect(detectTouchZone(841, containerTop, containerHeight)).toBe('bottom');

      // Just outside bottom zone
      expect(detectTouchZone(839, containerTop, containerHeight)).toBe(null);
    });
  });

  describe('calculateSwipe', () => {
    it('calculates correct deltas', () => {
      const start = { clientX: 100, clientY: 200 };
      const end = { clientX: 150, clientY: 300 };

      const result = calculateSwipe(start, end);

      expect(result.deltaX).toBe(50);
      expect(result.deltaY).toBe(100);
    });

    it('detects downward swipe', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 200 };

      const result = calculateSwipe(start, end);
      expect(result.direction).toBe('down');
    });

    it('detects upward swipe', () => {
      const start = { clientX: 100, clientY: 200 };
      const end = { clientX: 100, clientY: 100 };

      const result = calculateSwipe(start, end);
      expect(result.direction).toBe('up');
    });

    it('detects rightward swipe', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 200, clientY: 100 };

      const result = calculateSwipe(start, end);
      expect(result.direction).toBe('right');
    });

    it('detects leftward swipe', () => {
      const start = { clientX: 200, clientY: 100 };
      const end = { clientX: 100, clientY: 100 };

      const result = calculateSwipe(start, end);
      expect(result.direction).toBe('left');
    });

    it('prioritizes vertical direction when Y delta is greater', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 130, clientY: 200 }; // 30px horizontal, 100px vertical

      const result = calculateSwipe(start, end);
      expect(result.direction).toBe('down');
    });

    it('prioritizes horizontal direction when X delta is greater', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 200, clientY: 130 }; // 100px horizontal, 30px vertical

      const result = calculateSwipe(start, end);
      expect(result.direction).toBe('right');
    });

    it('returns null direction for minimal movement', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 105, clientY: 105 }; // 5px each

      const result = calculateSwipe(start, end);
      expect(result.direction).toBe(null);
    });
  });

  describe('determineSwipeAction', () => {
    it('returns "settings" for swipe down from top zone', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 200 };

      expect(determineSwipeAction('top', start, end)).toBe('settings');
    });

    it('returns "instances" for swipe up from bottom zone', () => {
      const start = { clientX: 100, clientY: 800 };
      const end = { clientX: 100, clientY: 700 };

      expect(determineSwipeAction('bottom', start, end)).toBe('instances');
    });

    it('returns null for swipe up from top zone', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 20 };

      expect(determineSwipeAction('top', start, end)).toBe(null);
    });

    it('returns null for swipe down from bottom zone', () => {
      const start = { clientX: 100, clientY: 800 };
      const end = { clientX: 100, clientY: 900 };

      expect(determineSwipeAction('bottom', start, end)).toBe(null);
    });

    it('returns null when zone is null', () => {
      const start = { clientX: 100, clientY: 400 };
      const end = { clientX: 100, clientY: 300 };

      expect(determineSwipeAction(null, start, end)).toBe(null);
    });

    it('returns null when swipe is too short', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 130 }; // Only 30px

      expect(determineSwipeAction('top', start, end)).toBe(null);
    });

    it('returns null for horizontal swipes', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 200, clientY: 120 }; // More horizontal than vertical

      expect(determineSwipeAction('top', start, end)).toBe(null);
    });

    it('respects custom minimum swipe distance', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 180 }; // 80px

      // Default threshold (50px) - should work
      expect(determineSwipeAction('top', start, end)).toBe('settings');

      // Higher threshold (100px) - should fail
      expect(determineSwipeAction('top', start, end, { minSwipeDistance: 100 })).toBe(null);
    });
  });

  describe('isVerticalSwipe', () => {
    it('returns true when vertical movement exceeds horizontal', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 120, clientY: 200 };

      expect(isVerticalSwipe(start, end)).toBe(true);
    });

    it('returns false when horizontal movement exceeds vertical', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 200, clientY: 120 };

      expect(isVerticalSwipe(start, end)).toBe(false);
    });

    it('returns false when movements are equal', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 150, clientY: 150 };

      expect(isVerticalSwipe(start, end)).toBe(false);
    });
  });

  describe('isSwipeThresholdMet', () => {
    it('returns true when swipe exceeds default threshold (50px)', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 200 };

      expect(isSwipeThresholdMet(start, end)).toBe(true);
    });

    it('returns false when swipe is below default threshold', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 140 };

      expect(isSwipeThresholdMet(start, end)).toBe(false);
    });

    it('returns true when swipe equals threshold', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 150 };

      expect(isSwipeThresholdMet(start, end)).toBe(true);
    });

    it('respects custom threshold', () => {
      const start = { clientX: 100, clientY: 100 };
      const end = { clientX: 100, clientY: 180 };

      expect(isSwipeThresholdMet(start, end, { minSwipeDistance: 100 })).toBe(false);
      expect(isSwipeThresholdMet(start, end, { minSwipeDistance: 50 })).toBe(true);
    });

    it('works with upward swipes (negative delta)', () => {
      const start = { clientX: 100, clientY: 200 };
      const end = { clientX: 100, clientY: 100 };

      expect(isSwipeThresholdMet(start, end)).toBe(true);
    });
  });
});
