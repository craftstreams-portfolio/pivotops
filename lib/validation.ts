// Shared validation helpers used across the app.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim();
  if (e.length > 254) return false;
  return EMAIL_RE.test(e);
}

export function emailError(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return "Email is required.";
  if (!isValidEmail(email)) return "Enter a valid email address.";
  return null;
}