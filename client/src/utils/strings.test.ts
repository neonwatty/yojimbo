import { describe, it, expect } from 'vitest';
import { generateShortName } from './strings';

describe('generateShortName', () => {
  describe('basic name generation', () => {
    it('extracts meaningful words from task text', () => {
      expect(generateShortName('Fix the login bug')).toBe('Fix Login Bug');
    });

    it('filters out common filler words', () => {
      expect(generateShortName('Please add a new feature to the dashboard')).toBe('Add New Feature Dashboard');
    });

    it('title cases words', () => {
      expect(generateShortName('refactor authentication module')).toBe('Refactor Authentication Module');
    });

    it('limits to 4 words', () => {
      // Note: "Implement User Profile Settings" is 32 chars, so it gets truncated
      const result = generateShortName('implement user profile settings page with dark mode toggle');
      expect(result).toBe('Implement User Profile Sett...');
    });

    it('returns default for filler-only text', () => {
      expect(generateShortName('a the to for')).toBe('New Task');
    });

    it('returns default for empty text', () => {
      expect(generateShortName('')).toBe('New Task');
    });
  });

  describe('length limiting', () => {
    it('truncates long names to 30 characters', () => {
      const result = generateShortName('internationalization localization standardization implementation');
      expect(result.length).toBeLessThanOrEqual(30);
      expect(result).toBe('Internationalization Locali...');
    });
  });

  describe('punctuation handling', () => {
    it('removes punctuation from text', () => {
      expect(generateShortName('Fix bug: authentication fails!')).toBe('Fix Bug Authentication Fails');
    });

    it('preserves hyphens in words', () => {
      expect(generateShortName('add pre-commit hooks')).toBe('Add Pre-commit Hooks');
    });
  });

  describe('deduplication', () => {
    it('returns base name if no duplicates exist', () => {
      const existing = ['Other Task', 'Another Task'];
      expect(generateShortName('Fix Login Bug', existing)).toBe('Fix Login Bug');
    });

    it('adds number suffix for duplicate names', () => {
      const existing = ['Fix Login Bug'];
      expect(generateShortName('Fix the login bug', existing)).toBe('Fix Login Bug 2');
    });

    it('increments suffix for multiple duplicates', () => {
      const existing = ['Fix Login Bug', 'Fix Login Bug 2', 'Fix Login Bug 3'];
      expect(generateShortName('Fix the login bug', existing)).toBe('Fix Login Bug 4');
    });

    it('handles case-insensitive deduplication', () => {
      const existing = ['fix login bug'];
      expect(generateShortName('Fix Login Bug', existing)).toBe('Fix Login Bug 2');
    });

    it('handles empty existing names array', () => {
      expect(generateShortName('Fix Login Bug', [])).toBe('Fix Login Bug');
    });

    it('uses default existing names when not provided', () => {
      expect(generateShortName('Fix Login Bug')).toBe('Fix Login Bug');
    });
  });
});
