// Password strength guide for the Profile page.

const COMMON = ['password', 'qwerty', '123456', '12345678', 'letmein', 'welcome', 'admin', 'iloveyou', 'abc123'];
const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

/**
 * A quick guide while typing. The server makes the final check with the same rules (at least 8 characters,
 * not only numbers, not a common password, not too close to your name or email).
 */
export function ratePassword(password, { name = '', email = '' } = {}) {
  const value = password || '';
  const lower = value.toLowerCase();
  const personal = [email.split('@')[0], ...name.toLowerCase().split(/\s+/)].filter((part) => part && part.length >= 3);
  const rules = [
    { key: 'length', label: 'At least 8 characters', met: value.length >= 8 },
    { key: 'numbers', label: 'Not only numbers', met: value.length > 0 && !/^\d+$/.test(value) },
    {
      key: 'personal',
      label: 'Not your name, email or a common password',
      met: value.length > 0 && !personal.some((part) => lower.includes(part.toLowerCase())) && !COMMON.some((word) => lower.includes(word)),
    },
    { key: 'mix', label: 'A mix of letters, numbers and symbols', met: /[a-zA-Z]/.test(value) && /\d/.test(value) && /[^a-zA-Z0-9]/.test(value) },
  ];

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^a-zA-Z0-9]/.test(value)) score += 1;
  if (!rules[0].met || !rules[1].met || !rules[2].met) score = Math.min(score, 1);
  if (!value) score = 0;
  return { score, label: LABELS[score], rules, acceptable: rules.slice(0, 3).every((rule) => rule.met) };
}
