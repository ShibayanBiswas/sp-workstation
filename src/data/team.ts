export type TeamMemberSeed = {
  name: string;
  email: string;
  /** Optional default password used only when seeding a brand-new user. */
  password?: string;
  role: "member" | "admin";
};

/**
 * Canonical team roster — add new members here when they join.
 * Default passwords live in `scripts/seed-passwords.local.json` (gitignored)
 * or env `SEED_DEFAULT_PASSWORD_MAP` (JSON). Never commit plaintext passwords.
 */
export const TEAM_MEMBERS: TeamMemberSeed[] = [
  {
    name: "Kalpesh Koradia",
    email: "kalpeshkoradia@rathi.com",
    role: "member",
  },
  {
    name: "Vinay Rathi",
    email: "vinayrathi@rathi.com",
    role: "admin",
  },
  {
    name: "Sammedhi Shah",
    email: "sammedishah@rathi.com",
    role: "member",
  },
  {
    name: "Parth Parekh",
    email: "parthparekh@rathi.com",
    role: "member",
  },
  {
    name: "Nishchay Soni",
    email: "nishchaysoni@rathi.com",
    role: "member",
  },
  {
    name: "Subhendu Maji",
    email: "subhendumaji@rathi.com",
    role: "member",
  },
  {
    name: "Shibayan Biswas",
    email: "shibayanbiswas@rathi.com",
    role: "admin",
  },
];
