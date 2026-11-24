/**
 * Normalizes an Indian phone number: removes +91, 91 prefix, spaces, hyphens, and non-digit characters.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/\D/g, '');
  if (cleaned.length > 10 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  }
  return cleaned;
}

export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone) return { valid: true };
  const cleaned = normalizePhoneNumber(phone);
  if (cleaned.length !== 10) {
    return { valid: false, error: 'Phone number must be exactly 10 digits.' };
  }
  return { valid: true };
}
