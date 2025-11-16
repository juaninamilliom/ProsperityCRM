export const PHONE_REGEX = /^\(\d{3}\) \d{3}-\d{4}$/;

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  const len = digits.length;
  if (len < 4) {
    return digits;
  }
  if (len < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isPhoneValid(value: string) {
  if (!value.trim()) return true;
  return PHONE_REGEX.test(value.trim());
}
