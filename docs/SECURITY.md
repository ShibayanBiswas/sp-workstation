# Security Notes

## Data classification

This is an internal financial workstation. Treat user identities, passwords,
OTPs, reset links, todos, portfolio information, and embedded dashboard data
as confidential company information.

## Implemented controls

- bcrypt password hashing with cost factor 12
- signed, expiring JWTs in HTTP-only cookies
- `Secure` cookies in production and `SameSite=Lax`
- mandatory OTP after password verification
- one-time, expiring OTP and password-reset records
- generic forgot-password response to reduce user enumeration
- Zod validation on authentication and todo mutations
- per-user todo ownership checks
- environment and local seed files excluded from Git
- referrer and frame headers configured on the workstation

## Known gaps before broader production use

- No rate limiting on login, OTP, reset, or seed endpoints
- No login lockout, CAPTCHA, or abuse monitoring
- Roles are recorded but not enforced
- No centralized security audit trail
- No CSRF token beyond SameSite cookie protection
- No Content Security Policy
- Seed endpoint shares the JWT signing secret
- OTP values are stored as plaintext for short-lived verification
- External market and news feeds are not contractually guaranteed
- Development mode can expose OTP/reset previews

These are explicit limitations, not production guarantees.

## Required production configuration

```dotenv
EMAIL_DEV_MODE=false
MONGODB_URI=<persistent Atlas URI>
JWT_SECRET=<random value of at least 32 bytes>
NEXT_PUBLIC_APP_URL=https://<approved-domain>
```

Also configure valid SMTP credentials and limit access to the approved team.

## Secret handling

Never commit:

- `.env.local`
- SMTP credentials
- Atlas credentials
- JWT secrets
- `scripts/seed-passwords.local.json`
- OTPs or password-reset URLs

Use Vercel encrypted environment variables for deployment secrets. Rotate a
secret immediately if it appears in Git history, terminal output shared
outside the team, screenshots, tickets, or chat.

## Recommended hardening backlog

1. Add IP/user rate limiting with a shared production store.
2. Separate the seed authorization secret from `JWT_SECRET`.
3. Disable or remove the seed endpoint after provisioning.
4. Enforce admin/member authorization on privileged routes.
5. Add structured authentication and administration audit events.
6. Add a restrictive CSP covering required TradingView and iframe origins.
7. Hash OTP/reset tokens at rest.
8. Add password breach checks and mandatory first-login password changes.
9. Run dependency, SAST, and secret scans in CI.
10. Conduct a formal security review before handling client portfolio data.

## Incident response basics

If credentials may be compromised:

1. rotate Atlas, SMTP, Vercel, and JWT secrets;
2. invalidate sessions by changing `JWT_SECRET`;
3. reset affected user passwords;
4. review provider and application logs;
5. remove exposed material from every publication surface;
6. notify the responsible company security/compliance owner.
