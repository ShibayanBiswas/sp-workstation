# SP Workstation — Anand Rathi Wealth (Structured Products)

Internal workstation for the Structured Products team: secure login with email OTP, Indian markets terminal, and Primary SP Dashboard modules.

## Features

- Branded login (Anand Rathi theme), forgot-password email link, email OTP (2FA)
- Home terminal: greetings, Nifty/Sensex/Bank Nifty/India VIX, TradingView charts, market news RSS, calendar, todos
- Left navigation with **Primary SP Dashboard** main + submodules mapped to https://sp-dashboard-eta.vercel.app/
- Dark / light mode
- MongoDB user database (seeded team roster)

## Quick start

1. Copy env file and fill values:

```bash
cp .env.example .env.local
```

2. Set `MONGODB_URI` (MongoDB Atlas) and `JWT_SECRET`.

3. Install & run:

```bash
npm install
npm run dev
```

4. Open http://localhost:3000 — sign in with your team email (e.g. `shiabaynbiswas@rathi.com` / `Shibayan@123`).

5. Seed users (also auto-runs on first login if DB is empty):

```bash
curl -X POST http://localhost:3000/api/auth/seed -H "x-seed-secret: $JWT_SECRET"
```

## Email (OTP + password reset)

Configure SMTP in `.env.local`. With `EMAIL_DEV_MODE=true`, OTP and reset links are also shown in the UI / API for local testing when mail is not configured.

## Deploy on Vercel

See the end of this README / chat instructions from the agent for a full Vercel + Atlas walkthrough.

## Team roster

Managed in `src/data/team.ts`. Default passwords for first-time seed live in
`scripts/seed-passwords.local.json` (gitignored) — copy from
`scripts/seed-passwords.example.json`. Ask to add new members when they join; re-run seed.
