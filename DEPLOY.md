# Deployment From Scratch (Beginner Guide)

This guide assumes you have **never deployed a Next.js app** before. Follow the
steps in order. Do not skip ahead.

**What you will end up with**

- Your SP Workstation live on the internet (Vercel)
- Users stored in MongoDB Atlas
- Sign-in → on-screen OTP → dashboard
- Code safely stored on GitHub

**Repository:** <https://github.com/ShibayanBiswas/sp-workstation> (public)

---

## Big picture (read once)

| Piece | What it is | Why you need it |
|-------|------------|-----------------|
| **GitHub** | Online copy of your code | Vercel deploys from here |
| **MongoDB Atlas** | Cloud database | Stores users + OTP codes |
| **Vercel** | Hosting for the website | Runs your Next.js app 24/7 |

**You do not need email / SMTP.** OTP codes appear **on screen** after login.

### Sharing Cluster0 with another project

You can reuse the same Atlas **cluster** (e.g. Cluster0 in Mumbai). The URI must
include a **dedicated database name**:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/sp-workstation?retryWrites=true&w=majority
```

That creates/uses only the `sp-workstation` database. Other databases on the
same cluster (other apps) are left alone. Never point this app at another
project’s database name.

URL-encode special characters in the password (`@` → `%40`).

Approx. time: **30–45 minutes** the first time.

---

## Before you start — checklist

Install / create accounts for:

1. [Node.js 20+](https://nodejs.org/) (for local testing)
2. [Git](https://git-scm.com/)
3. [GitHub account](https://github.com) with access to this repo
4. [MongoDB Atlas account](https://www.mongodb.com/cloud/atlas) (free — can share an existing cluster)
5. [Vercel account](https://vercel.com) (sign in with GitHub is easiest)

---

## Part A — Push all code to GitHub

### A1. Open a terminal in the project folder

```bash
cd "/home/shibayanbiswas/Desktop/SP Workstation"
```

### A2. See what changed

```bash
git status
```

### A3. Stage, commit, and push

```bash
git add -A
git commit -m "Your short description of changes."
git push origin main
```

If GitHub asks you to log in, use a **Personal Access Token** or the GitHub CLI
(`gh auth login`) — not your GitHub password.

**You are done with Part A when** `git status` says the branch is up to date
with `origin/main`.

---

## Part B — MongoDB Atlas (database)

### B1. Create a free cluster

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and sign in.
2. Create a **Free (M0)** cluster. Pick a region close to India (or your team).
3. Wait until the cluster shows **Idle** / ready.

### B2. Create a database user

1. **Database Access** → **Add New Database User**.
2. Authentication: **Password**.
3. Username + strong password — **save them in a notes file**.
4. Role: **Atlas Admin** (or read/write on any database) is fine for this app.

### B3. Allow Vercel to connect

1. **Network Access** → **Add IP Address**.
2. Choose **Allow Access from Anywhere** → `0.0.0.0/0`.
   (Serverless hosts change IP often; this is normal for hobby/small internal apps.)

### B4. Copy the connection string

1. **Database** → **Connect** → **Drivers**.
2. Copy the URI. It looks like:

```text
mongodb+srv://<dbUser>:<dbPassword>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

3. Edit it:
   - Replace `<dbPassword>` with the real password (URL-encode `@`, `#`, etc.).
   - Add a database name before `?`, e.g. `...mongodb.net/sp-workstation?retryWrites=...`

Final example shape:

```text
mongodb+srv://spuser:MyPass123@cluster0.xxxxx.mongodb.net/sp-workstation?retryWrites=true&w=majority
```

**Keep this secret.** Never commit it to GitHub.

---

## Part C — Team passwords for first seed

1. Open `scripts/seed-passwords.example.json` in the repo.
2. Create a local copy (do **not** commit real passwords):

```bash
cp scripts/seed-passwords.example.json scripts/seed-passwords.local.json
```

3. Fill every email from `src/data/team.ts` with a strong password
   (min 8 chars, upper + lower + number).
4. For Vercel, minify that JSON to **one line**. Example:

```json
{"shibayanbiswas@rathi.com":"YourSecurePassword1","kalpeshkoradia@rathi.com":"AnotherSecurePassword1"}
```

You will paste this later as `SEED_DEFAULT_PASSWORD_MAP`.

---

## Part D — Deploy on Vercel (the website)

### D1. Import the project

1. Go to [vercel.com/new](https://vercel.com/new).
2. **Import** the `sp-workstation` GitHub repository.
3. Framework should auto-detect **Next.js**. Leave build settings default.

### D2. Add environment variables (critical)

Before clicking Deploy, open **Environment Variables** and add **all** of these:

| Variable | What to paste | Notes |
|----------|---------------|-------|
| `MONGODB_URI` | Atlas URI from Part B | Must include `/sp-workstation` |
| `JWT_SECRET` | Long random string | Generate: `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` | Update after first deploy if URL differs |
| `NEXT_PUBLIC_SP_DASHBOARD_URL` | `https://sp-dashboard-eta.vercel.app` | Primary SP Dashboard iframe |
| `SEED_DEFAULT_PASSWORD_MAP` | One-line JSON from Part C | Used to create users once |
| `FORCE_RESET_PASSWORDS` | `false` | Only `true` if you intentionally want to reset all |

### D3. Deploy

1. Click **Deploy**.
2. Wait until the build turns green.
3. Open the `.vercel.app` URL.

### D4. Fix the public app URL if needed

If your final URL is different from what you put in `NEXT_PUBLIC_APP_URL`:

1. Vercel → Project → **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_APP_URL` to the real URL
3. **Deployments** → … on latest → **Redeploy**

---

## Part E — Seed users (create accounts in MongoDB)

After the first successful deploy, create team users **once**:

```bash
curl -X POST "https://YOUR-PROJECT.vercel.app/api/auth/seed" \
  -H "x-seed-secret: YOUR_JWT_SECRET"
```

Replace:

- `YOUR-PROJECT.vercel.app` with your real URL
- `YOUR_JWT_SECRET` with the same value as `JWT_SECRET` in Vercel

**Auto-seed backup:** If the users collection is empty and
`SEED_DEFAULT_PASSWORD_MAP` is set, the **first login attempt** also seeds users.

---

## Part F — Test production like a user

### Sign in

1. Open `https://YOUR-PROJECT.vercel.app/login`
2. Enter an approved email + password → **Continue**
   - Wrong / unknown email → **Invalid email ID**
   - Correct email, wrong password → **Wrong password**
3. On `/otp`, read the **6-digit code on screen** (no email)
4. Enter the code → `/dashboard` (12-hour session)

### Change password

1. From login → **Change password**, or while logged in open `/change-password`
2. Enter the on-screen code + new password
3. Sign in again with the new password

### Markets / charts

1. Confirm live tape and Nifty chart load
2. Switch **1D / 1W / 1M / …** — the chart header **% change** should update
   for that period (session / week / month / lookback), while tape chips keep
   day change vs previous close
3. Wait ~60 seconds — **Live** pill should refresh prices

---

## Part G — Everyday workflow after the first deploy

Whenever you change code on your laptop:

```bash
cd "/home/shibayanbiswas/Desktop/SP Workstation"
git add -A
git commit -m "Describe why you changed something."
git push origin main
```

Vercel auto-deploys `main`. Watch the Deployments tab until green.

---

## Part H — Optional: prove it works locally first

```bash
cd "/home/shibayanbiswas/Desktop/SP Workstation"
cp .env.example .env.local   # if you do not already have .env.local
# For quick local DB: MONGODB_URI=memory
npm ci
npm run lint
npm run build
npm run dev -- -H 127.0.0.1 -p 3000
```

In another terminal (with a password in `scripts/seed-passwords.local.json`):

```bash
npm run smoke
```

Open <http://127.0.0.1:3000/login>.

---

## Production checklist

- [ ] Code is on GitHub `main`
- [ ] Atlas cluster + user + `0.0.0.0/0` network access
- [ ] All Vercel env vars set; deploy green
- [ ] Seed ran successfully (or auto-seed on first login)
- [ ] Login → OTP on screen → dashboard
- [ ] Change password works
- [ ] Chart timeframe % changes when switching 1D / 1W / 1M
- [ ] Live prices update within ~1 minute
- [ ] Optional: remove `SEED_DEFAULT_PASSWORD_MAP` after everyone has their password

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Cannot sign in | Re-run seed; confirm email exists in `src/data/team.ts` |
| OTP screen empty | Go back to login and sign in again |
| Chart empty / 401 | Must be logged in; wait one minute |
| Build fails on Vercel | Open build log; usually a TypeScript error already fixed on latest `main` |
| Mongo connection error | Check URI password encoding + Network Access `0.0.0.0/0` |
| Local users vanish | Expected with `MONGODB_URI=memory` — use Atlas for persistence |

More detail: [Operations](docs/OPERATIONS.md), [Security](docs/SECURITY.md),
[Authentication](docs/AUTHENTICATION.md).
