import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDistanceToNow } from './time';

describe('formatDistanceToNow', () => {
  beforeEach(() => {
    // Mock Date.now() to a fixed time: 2024-01-15T12:00:00.000Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for times less than 60 seconds ago', () => {
    expect(formatDistanceToNow('2024-01-15T12:00:00.000Z')).toBe('just now');
    expect(formatDistanceToNow('2024-01-15T11:59:30.000Z')).toBe('just now');
    expect(formatDistanceToNow('2024-01-15T11:59:01.000Z')).toBe('just now');
  });

  it('returns minutes ago for times between 1-59 minutes ago', () => {
    expect(formatDistanceToNow('2024-01-15T11:59:00.000Z')).toBe('1m ago');
    expect(formatDistanceToNow('2024-01-15T11:55:00.000Z')).toBe('5m ago');
    expect(formatDistanceToNow('2024-01-15T11:30:00.000Z')).toBe('30m ago');
    expect(formatDistanceToNow('2024-01-15T11:01:00.000Z')).toBe('59m ago');
  });

  it('returns hours ago for times between 1-23 hours ago', () => {
    expect(formatDistanceToNow('2024-01-15T11:00:00.000Z')).toBe('1h ago');
    expect(formatDistanceToNow('2024-01-15T06:00:00.000Z')).toBe('6h ago');
    expect(formatDistanceToNow('2024-01-14T13:00:00.000Z')).toBe('23h ago');
  });

  it('returns days ago for times between 1-6 days ago', () => {
    expect(formatDistanceToNow('2024-01-14T12:00:00.000Z')).toBe('1d ago');
    expect(formatDistanceToNow('2024-01-12T12:00:00.000Z')).toBe('3d ago');
    expect(formatDistanceToNow('2024-01-09T12:00:00.000Z')).toBe('6d ago');
  });

  it('returns formatted date for times 7+ days ago', () => {
    // 7 days ago
    const result7Days = formatDistanceToNow('2024-01-08T12:00:00.000Z');
    expect(result7Days).toMatch(/Jan\s+8/);

    // 30 days ago
    const result30Days = formatDistanceToNow('2023-12-16T12:00:00.000Z');
    expect(result30Days).toMatch(/Dec\s+16/);
  });

  it('handles edge cases at time boundaries', () => {
    // Exactly 60 seconds ago should be 1m
    expect(formatDistanceToNow('2024-01-15T11:59:00.000Z')).toBe('1m ago');

    // Exactly 60 minutes ago should be 1h
    expect(formatDistanceToNow('2024-01-15T11:00:00.000Z')).toBe('1h ago');

    // Exactly 24 hours ago should be 1d
    expect(formatDistanceToNow('2024-01-14T12:00:00.000Z')).toBe('1d ago');
  });
});
