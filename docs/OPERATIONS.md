# Operations and Troubleshooting

## Health check

Start the application, then check the login page:

```bash
curl -I http://127.0.0.1:3000/login
```

A redirect or successful HTML response confirms that Next.js is accepting
requests. Authenticated API checks require browser cookies.

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

### OTP does not arrive

- Verify SMTP host, port, user, password, and sender.
- Gmail requires an App Password when two-step verification is enabled.
- Inspect server logs for the Nodemailer error.
- In local development only, set `EMAIL_DEV_MODE=true` and use the UI preview.

### Reset link points to localhost in production

Set:

```dotenv
NEXT_PUBLIC_APP_URL=https://YOUR-PRODUCTION-DOMAIN
```

Redeploy so newly generated emails use the production URL.

### Primary SP Dashboard is blank

Use “Open in new tab.” The external dashboard may reject iframe embedding
through CSP or `X-Frame-Options`. This cannot be overridden by the workstation.

### Quotes or news are missing

Yahoo Finance and RSS feeds are unofficial/best-effort integrations. Provider
rate limits, schema changes, or outages may cause partial data. The workstation
must not be used as the sole source for trade execution or client reporting.

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
- SMTP failures and local preview notices;
- API route exceptions;
- external market/news fetch failures.

Do not forward production logs containing OTPs, reset links, cookies, or
environment variables.

## Backup and recovery

MongoDB Atlas backups depend on the selected Atlas tier and configuration.
Before production use:

- enable an appropriate Atlas backup policy;
- document restore ownership and recovery objectives;
- test restoration to a separate database;
- rotate credentials after a suspected disclosure.
