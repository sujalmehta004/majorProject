/**
 * Professional Form Validation Helpers for MedHub Platform
 */

// Email regex pattern checking standard format name@domain.tld
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
};

// Standard 10-digit phone number validation (Nepal/South Asia standard 10-digit format starting with 9 or 0-9)
export const isValidPhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  // Cleans spaces, dashes, +977 prefix if present
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '').replace(/^977/, '');
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(cleaned);
};

// NMC (Nepal Medical Council) license number - numbers only validation
export const isValidNmcNumber = (nmc: string): boolean => {
  if (!nmc || typeof nmc !== 'string') return false;
  const nmcRegex = /^[0-9]+$/;
  return nmcRegex.test(nmc.trim());
};

// Generic Positive Number validation (price, quantity, stock, etc.)
export const isPositiveNumber = (val: number | string): boolean => {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return !isNaN(num) && num > 0;
};

// Non-negative number validation (0 or positive)
export const isNonNegativeNumber = (val: number | string): boolean => {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return !isNaN(num) && num >= 0;
};

// Clean phone number to 10 digits
export const formatPhoneNumber = (phone: string): string => {
  return phone.replace(/[\s\-\+\(\)]/g, '').replace(/^977/, '').slice(0, 10);
};
