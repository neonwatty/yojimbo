/**
 * Gesture detection utilities for mobile touch interactions.
 */

export interface TouchPoint {
  clientX: number;
  clientY: number;
}

export interface SwipeGestureConfig {
  minSwipeDistance?: number;
  topZoneHeight?: number;
  bottomZoneHeight?: number;
}

export type SwipeZone = 'top' | 'bottom' | null;
export type SwipeDirection = 'up' | 'down' | 'left' | 'right' | null;

const DEFAULT_CONFIG: Required<SwipeGestureConfig> = {
  minSwipeDistance: 50,
  topZoneHeight: 60,
  bottomZoneHeight: 60,
};

/**
 * Determines which edge zone a touch started in.
 */
export function detectTouchZone(
  touchY: number,
  containerTop: number,
  containerHeight: number,
  config: SwipeGestureConfig = {}
): SwipeZone {
  const { topZoneHeight, bottomZoneHeight } = { ...DEFAULT_CONFIG, ...config };

  const relativeY = touchY - containerTop;

  if (relativeY < topZoneHeight) {
    return 'top';
  }

  if (relativeY > containerHeight - bottomZoneHeight) {
    return 'bottom';
  }

  return null;
}

/**
 * Calculates the direction and distance of a swipe gesture.
 */
export function calculateSwipe(
  start: TouchPoint,
  end: TouchPoint
): { deltaX: number; deltaY: number; direction: SwipeDirection } {
  const deltaX = end.clientX - start.clientX;
  const deltaY = end.clientY - start.clientY;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  let direction: SwipeDirection = null;

  // Only determine direction if there's meaningful movement
  if (absX > 10 || absY > 10) {
    if (absY > absX) {
      direction = deltaY > 0 ? 'down' : 'up';
    } else {
      direction = deltaX > 0 ? 'right' : 'left';
    }
  }

  return { deltaX, deltaY, direction };
}

/**
 * Determines if a swipe gesture should trigger a navigation action.
 * Returns 'settings' for swipe down from top, 'instances' for swipe up from bottom.
 */
export function determineSwipeAction(
  zone: SwipeZone,
  start: TouchPoint,
  end: TouchPoint,
  config: SwipeGestureConfig = {}
): 'settings' | 'instances' | null {
  const { minSwipeDistance } = { ...DEFAULT_CONFIG, ...config };
  const { deltaY, deltaX, direction } = calculateSwipe(start, end);

  // Must be primarily vertical swipe (not horizontal scroll)
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return null;
  }

  // Check minimum swipe distance
  if (Math.abs(deltaY) < minSwipeDistance) {
    return null;
  }

  // Swipe down from top zone → open settings
  if (zone === 'top' && direction === 'down') {
    return 'settings';
  }

  // Swipe up from bottom zone → open instances
  if (zone === 'bottom' && direction === 'up') {
    return 'instances';
  }

  return null;
}

/**
 * Checks if a swipe is primarily vertical (for drawer gestures).
 */
export function isVerticalSwipe(start: TouchPoint, end: TouchPoint): boolean {
  const { deltaX, deltaY } = calculateSwipe(start, end);
  return Math.abs(deltaY) > Math.abs(deltaX);
}

/**
 * Checks if a swipe distance exceeds the minimum threshold.
 */
export function isSwipeThresholdMet(
  start: TouchPoint,
  end: TouchPoint,
  config: SwipeGestureConfig = {}
): boolean {
  const { minSwipeDistance } = { ...DEFAULT_CONFIG, ...config };
  const { deltaY } = calculateSwipe(start, end);
  return Math.abs(deltaY) >= minSwipeDistance;
}
