# Authentication and Account Recovery

## Summary

Authentication uses two factors:

1. registered email and password;
2. a six-digit one-time password delivered by email.

Passwords are stored only as bcrypt hashes. Browser authentication state is
held in signed, HTTP-only cookies.

## Sign-in sequence

```mermaid
sequenceDiagram
    participant User
    participant Login as POST /api/auth/login
    participant DB as MongoDB
    participant Mail as SMTP
    participant Verify as POST /api/auth/verify-otp

    User->>Login: Email and password
    Login->>DB: Find User and compare bcrypt hash
    Login->>DB: Replace pending OTP with 10-minute OTP
    Login->>Mail: Send six-digit code
    Login-->>User: Set sp_pending cookie
    User->>Verify: OTP
    Verify->>DB: Validate unconsumed, unexpired OTP
    Verify->>DB: Mark OTP consumed
    Verify-->>User: Set sp_session; clear sp_pending
```

### Cookies

- `sp_pending`: signed HS256 JWT, HTTP-only, same-site `lax`, valid 10 minutes.
- `sp_session`: signed HS256 JWT, HTTP-only, same-site `lax`, valid 12 hours.
- Both use the `Secure` flag in production.

The session contains user ID, name, email, and role. The server verifies the
signature and expiration with `JWT_SECRET`.

### Failed OTP behavior

An incorrect or expired OTP clears both authentication cookies and directs the
user back to `/login`. The user must repeat password authentication to obtain a
new OTP.

## Password reset sequence

1. The user submits an email to `POST /api/auth/forgot-password`.
2. The API always returns a generic success response to prevent account
   enumeration.
3. For a known user, a cryptographically random token is stored with a
   30-minute expiration.
4. SMTP sends a link to `/reset-password?token=...`.
5. `POST /api/auth/reset-password` validates and consumes the token.
6. The new password is hashed with bcrypt cost factor 12.

Passwords must have at least eight characters and include uppercase,
lowercase, and numeric characters.

## Email modes

Production must set valid SMTP variables and:

```dotenv
EMAIL_DEV_MODE=false
```

Local development may use:

```dotenv
EMAIL_DEV_MODE=true
```

In development mode, OTPs and reset URLs may be returned to the UI and written
to server logs. This is convenient for local testing but is a credential
disclosure if enabled in production.

## User provisioning

The team roster in `src/data/team.ts` does not contain passwords. Initial
passwords come from one of:

1. `SEED_DEFAULT_PASSWORD_MAP`, a JSON object in the environment; or
2. `scripts/seed-passwords.local.json`, which is excluded from Git.

The seed process:

- creates missing users when a password is available;
- updates names and roles for existing users;
- does not overwrite changed passwords by default;
- overwrites passwords only when `FORCE_RESET_PASSWORDS=true`.

## Current authorization boundary

The `member` and `admin` roles are stored, but role-based permissions are not
yet enforced. All authenticated users can access the same protected dashboard
and APIs.

## Security checklist

- Use a randomly generated `JWT_SECRET` of at least 32 bytes.
- Set `EMAIL_DEV_MODE=false` outside local development.
- Never commit `.env.local` or `scripts/seed-passwords.local.json`.
- Use corporate SMTP or a dedicated transactional email account.
- Rotate default passwords after first sign-in.
- Restrict the seed endpoint after initial provisioning.
- Add rate limiting before public production use.
- Add audit logging and role enforcement before introducing privileged tools.
