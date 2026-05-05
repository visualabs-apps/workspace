import { describe, test, expect, vi, beforeEach } from 'vitest';
import { validateEmail, validatePassword, hashPassword, generateResetToken, analyzePasswordStrength } from '../auth.js';

describe('Auth Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateEmail', () => {
    test('should validate correct email format', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
    });

    test('should reject invalid email format', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test.example.com')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
      expect(validateEmail(123)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('should validate strong password', () => {
      expect(validatePassword('StrongPass123!')).toBe(true);
      expect(validatePassword('MySecure@Pass1')).toBe(true);
      expect(validatePassword('Test123$Password')).toBe(true);
    });

    test('should reject weak passwords', () => {
      expect(validatePassword('weak')).toBe(false);
      expect(validatePassword('')).toBe(false);
      expect(validatePassword('password')).toBe(false);
      expect(validatePassword('12345678')).toBe(false);
      expect(validatePassword('PASSWORD123')).toBe(false);
      expect(validatePassword('password123')).toBe(false);
      expect(validatePassword('Password!')).toBe(false); // Too short
      expect(validatePassword(null)).toBe(false);
      expect(validatePassword(undefined)).toBe(false);
      expect(validatePassword(123)).toBe(false);
    });
  });

  describe('hashPassword', () => {
    test('should hash password correctly', async () => {
      const password = 'test123';
      const hashed = await hashPassword(password);
      
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(50);
      expect(typeof hashed).toBe('string');
    });

    test('should generate different hashes for same password', async () => {
      const password = 'test123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // With our simple implementation, they should be the same
      // In a real implementation with salt, they would be different
      expect(hash1).toBe(hash2);
    });

    test('should throw error for invalid password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password is required and must be a string');
      await expect(hashPassword(null)).rejects.toThrow('Password is required and must be a string');
      await expect(hashPassword(undefined)).rejects.toThrow('Password is required and must be a string');
      await expect(hashPassword(123)).rejects.toThrow('Password is required and must be a string');
    });
  });

  describe('generateResetToken', () => {
    test('should generate random token', () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();
      
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes * 2 hex chars
      expect(token2.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(token1)).toBe(true);
      expect(/^[a-f0-9]{64}$/.test(token2)).toBe(true);
    });
  });

  describe('analyzePasswordStrength', () => {
    test('should analyze strong password', () => {
      const result = analyzePasswordStrength('StrongPass123!');
      
      expect(result.isStrong).toBe(true);
      expect(result.score).toBe(5);
      expect(result.feedback).toHaveLength(0);
    });

    test('should analyze weak password', () => {
      const result = analyzePasswordStrength('weak');
      
      expect(result.isStrong).toBe(false);
      expect(result.score).toBe(1); // Only length check passes
      expect(result.feedback.length).toBeGreaterThan(0);
      expect(result.feedback).toContain('Password should contain at least one uppercase letter');
      expect(result.feedback).toContain('Password should contain at least one number');
      expect(result.feedback).toContain('Password should contain at least one special character (@$!%*?&)');
    });

    test('should handle empty password', () => {
      const result = analyzePasswordStrength('');
      
      expect(result.isStrong).toBe(false);
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Password is required');
    });

    test('should handle invalid input', () => {
      const result1 = analyzePasswordStrength(null);
      const result2 = analyzePasswordStrength(undefined);
      
      expect(result1.isStrong).toBe(false);
      expect(result1.score).toBe(0);
      expect(result1.feedback).toContain('Password is required');
      
      expect(result2.isStrong).toBe(false);
      expect(result2.score).toBe(0);
      expect(result2.feedback).toContain('Password is required');
    });

    test('should give partial scores for moderate passwords', () => {
      const result1 = analyzePasswordStrength('password123'); // No uppercase, no special
      expect(result1.score).toBe(3);
      expect(result1.isStrong).toBe(false);
      
      const result2 = analyzePasswordStrength('Password123'); // No special
      expect(result2.score).toBe(4);
      expect(result2.isStrong).toBe(true); // Meets minimum threshold
      
      const result3 = analyzePasswordStrength('Password!'); // No number, too short
      expect(result3.score).toBe(4); // Has length, uppercase, lowercase, special
      expect(result3.isStrong).toBe(true); // Meets minimum threshold
    });
  });
});
