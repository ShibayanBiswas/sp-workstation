# SP Workstation

Internal Anand Rathi Wealth Structured Products team workstation. It provides
local OTP authentication, a live Indian markets home terminal, dark mode, and
mapped access to the Primary SP Dashboard.

## Main capabilities

- Branded sign-in with on-screen OTP verification, logout, and OTP-based password change
- Distinct login errors: **Invalid email ID** (non-roster) and **Wrong password** (valid email)
- MongoDB-backed users and OTP records
- Live tape, snapshot cards, and candlestick charts for 13 Indian indices
- **Unified live sync** — prices and returns refresh every 60 seconds across tape, cards, and chart
- Primary SP Dashboard module and submodule navigation
- Responsive light and dark themes with polished motion

## Ubuntu quick start with PowerShell

Requirements: Node.js 20.9+, npm, and PowerShell 7 (`pwsh`).

```bash
cd "/home/shibayanbiswas/Desktop/SP Workstation"
pwsh ./run.ps1 install
pwsh ./run.ps1 dev
```

Open <http://127.0.0.1:3000>. Press `Ctrl+C` to stop the server.

When `.env.local` is absent, the runner creates a development configuration
with in-memory MongoDB. This local database is erased whenever the process stops.

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
- [Vercel deployment (from scratch)](DEPLOY.md)

## Command reference

```text
pwsh ./run.ps1 help
pwsh ./run.ps1 install
pwsh ./run.ps1 dev
pwsh ./run.ps1 lint
pwsh ./run.ps1 build
pwsh ./run.ps1 start
pwsh ./run.ps1 seed
node scripts/smoke-test.mjs   # optional API smoke test (set SMOKE_PASSWORD)
```

## Configuration

Copy `.env.example` when creating an explicit configuration. Never commit
`.env.local`, Atlas credentials, JWT secrets, or the local seed password file.

Production requires persistent MongoDB, a stable random `JWT_SECRET`, and the
deployed `NEXT_PUBLIC_APP_URL`.

## Team changes

The roster is maintained in `src/data/team.ts`. Initial passwords are supplied
through `scripts/seed-passwords.local.json` (Git-ignored) or the deployment
variable `SEED_DEFAULT_PASSWORD_MAP`. Run the seed after adding a member.

## Index display order

Live tape and snapshot cards follow the order in `src/data/indian-markets.ts`:

1. Main benchmarks (Nifty 50, Sensex, Bank Nifty, Midcap, Next 50)
2. Sector indices
3. India VIX
4. USD/INR
