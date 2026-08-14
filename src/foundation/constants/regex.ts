export const REGEX_PATTERNS = {
  /** Standard email pattern */
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  /** Password: 8-64 chars, at least one uppercase, one lowercase, one digit */
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/,
  /** Chinese phone number */
  PHONE_CN: /^1[3-9]\d{9}$/,
  /** Username: 3-30 chars, alphanumeric + underscore */
  USERNAME: /^[a-zA-Z0-9_]{3,30}$/,
  /** UUID v4 */
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;
