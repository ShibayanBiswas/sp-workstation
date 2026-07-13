# Deployment From Scratch

Complete guide for deploying SP Workstation to production: database, users,
email OTP, password recovery, frontend, and backend on Vercel.

Repository: <https://github.com/ShibayanBiswas/sp-workstation> (private)

---

## What you are deploying

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 16 + React 19 | Login, OTP, dashboard UI |
| Backend | Next.js API routes | Auth, markets, charts |
| Database | MongoDB Atlas | Users, OTPs, reset tokens |
| Email | SMTP (Gmail or corporate) | OTP codes, password-reset links |

---

## Step 1 — MongoDB Atlas (user database)

1. Sign in at [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a **Free M0** cluster (any region close to your users).
3. **Database Access** → Add user with a strong password. Save credentials.
4. **Network Access** → Allow `0.0.0.0/0` for Vercel serverless (or use Atlas/Vercel integration when available).
5. **Connect → Drivers** → Copy the connection string:

```text
mongodb+srv://<dbUser>:<dbPassword>@<cluster>.mongodb.net/sp-workstation?retryWrites=true&w=majority
```

URL-encode special characters in the password.

**Collections created automatically:**

- `users` — email, bcrypt password hash, name, role
- `otps` — 6-digit login codes (10-minute TTL)
- `passwordresets` — reset tokens (30-minute TTL)

---

## Step 2 — SMTP (email OTP + password reset)

### Gmail example

1. Enable 2-Step Verification on the Gmail account.
2. Create an **App Password** at [Google App Passwords](https://myaccount.google.com/apppasswords).
3. Use these values in Vercel:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM="SP Workstation <noreply@anandrathiwealth.in>"
EMAIL_DEV_MODE=false
```

`EMAIL_DEV_MODE=false` is **required** in production so OTPs are only sent by email, not shown in the UI.

---

## Step 3 — Team roster and initial passwords

1. Team members are listed in `src/data/team.ts` (name, email, role only).
2. Prepare a JSON password map from `scripts/seed-passwords.example.json`:

```json
{
  "shibayanbiswas@rathi.com": "YourSecurePassword1",
  "kalpeshkoradia@rathi.com": "AnotherSecurePassword1"
}
```

3. Minify to one line for Vercel env var `SEED_DEFAULT_PASSWORD_MAP`.

---

## Step 4 — Push code to GitHub

```bash
cd "/home/shibayanbiswas/Desktop/SP Workstation"
git add -A
git commit -m "your message"
git push origin main
```

---

## Step 5 — Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the `sp-workstation` repository.
3. Framework: **Next.js** (auto-detected).
4. Add environment variables:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Atlas URI from Step 1 |
| `JWT_SECRET` | Random 32+ char string (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` |
| `NEXT_PUBLIC_SP_DASHBOARD_URL` | `https://sp-dashboard-eta.vercel.app` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password / app password |
| `SMTP_FROM` | `SP Workstation <noreply@…>` |
| `EMAIL_DEV_MODE` | `false` |
| `SEED_DEFAULT_PASSWORD_MAP` | One-line JSON from Step 3 |
| `FORCE_RESET_PASSWORDS` | `false` |

5. Click **Deploy**.
6. After deploy, set `NEXT_PUBLIC_APP_URL` to the final Vercel URL if it changed → **Redeploy**.

---

## Step 6 — Seed users into MongoDB

Run once after first deploy:

```bash
curl -X POST https://YOUR-PROJECT.vercel.app/api/auth/seed \
  -H "x-seed-secret: YOUR_JWT_SECRET"
```

> **Auto-seed:** If the users collection is empty and `SEED_DEFAULT_PASSWORD_MAP` is set, the first login attempt also seeds users.

---

## Step 7 — Authentication flows

### Sign in (every session)

1. Open `https://YOUR-PROJECT.vercel.app/login`.
2. Enter team email + password.
3. Check email for 6-digit OTP (valid 10 minutes).
4. Enter OTP at `/otp`.
5. Redirected to `/dashboard` with a 12-hour session cookie.

### Change / reset password

1. On login page → **Forgot password?**
2. Enter registered email → generic success message (prevents account enumeration).
3. Open reset link from email → `/reset-password?token=...`
4. Set new password (min 8 chars, upper + lower + number).
5. Sign in again with new password + OTP.

### Add a new team member later

1. Add to `src/data/team.ts`.
2. Add email/password to `SEED_DEFAULT_PASSWORD_MAP` (or local seed file).
3. Run seed endpoint or `pwsh ./run.ps1 seed`.
4. Member signs in and should reset password after first login.

---

## Step 8 — Production checklist

- [ ] `EMAIL_DEV_MODE=false`
- [ ] OTP email arrives (check spam folder)
- [ ] Reset email link uses production domain
- [ ] Login → OTP → dashboard works
- [ ] Live tape and chart show prices
- [ ] MongoDB Atlas shows users after seed
- [ ] Primary SP Dashboard modules open (or new-tab fallback works)
- [ ] Remove `SEED_DEFAULT_PASSWORD_MAP` after all users provisioned (optional)

---

## Step 9 — Local development

```bash
cp .env.example .env.local
# MONGODB_URI=memory works without Atlas
pwsh ./run.ps1 install
pwsh ./run.ps1 dev
```

With `EMAIL_DEV_MODE=true`, OTP preview appears on the `/otp` page for testing.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OTP not received | Verify SMTP credentials; check spam; test with Gmail App Password |
| Reset link is localhost | Set `NEXT_PUBLIC_APP_URL` to production URL and redeploy |
| Cannot sign in | Re-run seed; verify email in `team.ts` matches login |
| Chart shows no data | Must be logged in; Yahoo may rate-limit — wait and refresh |
| Users lost after restart (local) | Expected with `MONGODB_URI=memory`; use Atlas for persistence |

See [Operations](docs/OPERATIONS.md) and [Security](docs/SECURITY.md) for more detail.
