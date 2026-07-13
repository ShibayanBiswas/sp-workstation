# Operations and Troubleshooting

## Health check

Start the application, then check the login page:

```bash
curl -I http://127.0.0.1:3000/login
```

A redirect or successful HTML response confirms that Next.js is accepting
requests. Authenticated API checks require browser cookies.

## Smoke test

After seeding users, run the automated API smoke test:

```bash
pwsh ./run.ps1 dev          # in one terminal
SMOKE_PASSWORD='your-password' node scripts/smoke-test.mjs
```

The script verifies:

- Login page and OTP page load
- Invalid email ID rejection
- Wrong password rejection (when `SMOKE_PASSWORD` is set)
- Login → OTP → session
- Markets API (13 indices, Nifty price present)
- Chart API price alignment with markets feed
- Forgot-password OTP generation
- Logout

## Common startup failures

### `pwsh: command not found`

Install PowerShell 7 for Ubuntu, or use the npm/Bash commands in
[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).

### Port 3000 is already in use

Start on another port:

```bash
pwsh ./run.ps1 dev -Port 3001
```

Or identify the existing listener:

```bash
ss -ltnp | rg ':3000'
```

### `JWT_SECRET is not set`

Create `.env.local` or run `pwsh ./run.ps1 dev`, which creates one when
missing. Production must use a stable random secret; changing it invalidates
all sessions.

### MongoDB connection fails

- Confirm `MONGODB_URI` syntax.
- Percent-encode special characters in the database password.
- Confirm the Atlas database user has access.
- Confirm Atlas Network Access permits the deployment source.
- Use `MONGODB_URI=memory` only for local temporary testing.

### User cannot sign in after a local restart

The in-memory database was recreated. Confirm that
`scripts/seed-passwords.local.json` exists and run:

```bash
pwsh ./run.ps1 seed
```

### OTP not shown on verification page

Return to login and sign in again to regenerate the code. Codes expire after
10 minutes.

### Invalid email ID / Wrong password popups

Expected behaviour for non-roster emails and incorrect passwords. Verify the
email exists in `src/data/team.ts` and the password matches the seeded value.

### Primary SP Dashboard is blank

Use “Open in new tab.” The external dashboard may reject iframe embedding
through CSP or `X-Frame-Options`. This cannot be overridden by the workstation.

### Quotes or chart data missing

Yahoo Finance is an unofficial best-effort integration. Provider rate limits,
schema changes, or outages may cause partial data. The user must be logged in
for `/api/markets` and `/api/chart`. The dashboard auto-refreshes every **60
seconds**; look for the green **Live · synced** pill in the terminal header.
This data is informational and must not be used for trade execution.

## Production run

For a local production-mode smoke test:

```bash
pwsh ./run.ps1 build
pwsh ./run.ps1 start
```

The production server requires a persistent database and production-safe
environment variables.

## Logs

Next.js writes application output to the process terminal. Important messages
include:

- MongoDB connection or in-memory fallback;
- API route exceptions;
- external market fetch failures.

Do not forward production logs containing OTPs, cookies, or environment variables.

## Backup and recovery

MongoDB Atlas backups depend on the selected Atlas tier and configuration.
Before production use:

- enable an appropriate Atlas backup policy;
- document restore ownership and recovery objectives;
- test restoration to a separate database;
- rotate credentials after a suspected disclosure.
