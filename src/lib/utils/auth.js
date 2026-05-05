// Authentication utility functions

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if email is valid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {boolean} - True if password meets requirements
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  
  // Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

/**
 * Hash password using a simple hash function
 * In a real application, you would use bcrypt or similar
 * @param {string} password - Password to hash
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required and must be a string');
  }
  
  // Simple hash for demonstration (NOT for production use)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate password reset token
 * @returns {string} - Random token
 */
export function generateResetToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if password is strong enough
 * @param {string} password - Password to check
 * @returns {object} - Strength analysis
 */
export function analyzePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return {
      isStrong: false,
      score: 0,
      feedback: ['Password is required']
    };
  }
  
  let score = 0;
  const feedback = [];
  
  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Password should be at least 8 characters long');
  }
  
  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain at least one uppercase letter');
  }
  
  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain at least one lowercase letter');
  }
  
  // Number check
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain at least one number');
  }
  
  // Special character check
  if (/[@$!%*?&]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password should contain at least one special character (@$!%*?&)');
  }
  
  return {
    isStrong: score >= 4,
    score,
    feedback
  };
}
