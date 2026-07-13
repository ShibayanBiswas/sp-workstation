# SP Workstation

Internal Anand Rathi Wealth Structured Products team workstation. It provides
password and email-OTP authentication, an Indian markets home terminal,
personal calendar/todos, dark mode, and mapped access to the Primary SP
Dashboard.

## Main capabilities

- Branded sign-in, email OTP, logout, and email password recovery
- MongoDB-backed users, verification records, and user-owned todos
- Nifty 50, Sensex, Bank Nifty, and India VIX snapshots
- TradingView charts and Indian financial news feeds
- Primary SP Dashboard module and submodule navigation
- Responsive light and dark themes

## Ubuntu quick start with PowerShell

Requirements: Node.js 20.9+, npm, and PowerShell 7 (`pwsh`).

```bash
cd "/home/shibayanbiswas/Desktop/SP Workstation"
pwsh ./run.ps1 install
pwsh ./run.ps1 dev
```

Open <http://127.0.0.1:3000>. Press `Ctrl+C` to stop the server.

When `.env.local` is absent, the runner creates a development configuration
with in-memory MongoDB and development OTP previews. This local database is
erased whenever the process stops.

Without PowerShell:

```bash
npm ci
npm run dev -- -H 127.0.0.1 -p 3000
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Local development and `run.ps1`](docs/LOCAL_DEVELOPMENT.md)
- [Authentication and password recovery](docs/AUTHENTICATION.md)
- [API reference](docs/API.md)
- [Database and team provisioning](docs/DATABASE.md)
- [Security notes](docs/SECURITY.md)
- [Operations and troubleshooting](docs/OPERATIONS.md)
- [Vercel deployment](DEPLOY.md)

## Command reference

```text
pwsh ./run.ps1 help
pwsh ./run.ps1 install
pwsh ./run.ps1 dev
pwsh ./run.ps1 lint
pwsh ./run.ps1 build
pwsh ./run.ps1 start
pwsh ./run.ps1 seed
```

## Configuration

Copy `.env.example` when creating an explicit configuration. Never commit
`.env.local`, SMTP/Atlas credentials, JWT secrets, OTPs, reset links, or the
local seed password file.

Production requires persistent MongoDB, working SMTP, a stable random
`JWT_SECRET`, the deployed `NEXT_PUBLIC_APP_URL`, and
`EMAIL_DEV_MODE=false`.

## Team changes

The roster is maintained in `src/data/team.ts`. Initial passwords are supplied
through `scripts/seed-passwords.local.json` (Git-ignored) or the deployment
variable `SEED_DEFAULT_PASSWORD_MAP`. Run the seed after adding a member.
