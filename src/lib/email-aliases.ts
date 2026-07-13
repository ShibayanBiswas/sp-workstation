/** Maps alternate spellings / legacy emails to the canonical roster email. */
const LOGIN_EMAIL_ALIASES: Record<string, string> = {
  "shiabaynbiswas@rathi.com": "shibayanbiswas@rathi.com",
};

export function resolveLoginEmail(email: string): string {
  const normalized = email.toLowerCase().trim();
  return LOGIN_EMAIL_ALIASES[normalized] ?? normalized;
}
