# Vercel Deployment

The GitHub repository is private:
<https://github.com/ShibayanBiswas/sp-workstation>.

Before deployment, confirm that you have access to the repository, a MongoDB
Atlas project, an SMTP account, and a Vercel account.

## 1. Create MongoDB Atlas database

1. Go to [MongoDB Atlas](https://cloud.mongodb.com) and sign in.
2. Create a **Free (M0)** cluster.
3. Create a database user (Database Access) with a strong password.
4. Configure Network Access for Vercel. A temporary `0.0.0.0/0` rule is the
   simplest serverless setup but allows connection attempts from any source;
   use an Atlas/Vercel integration or controlled egress when available.
5. Click **Connect → Drivers** and copy the URI:

```text
mongodb+srv://<dbUser>:<dbPassword>@<cluster>.mongodb.net/sp-workstation?retryWrites=true&w=majority
```

## 2. Configure SMTP (real OTP emails)

Use a Gmail App Password (or corporate SMTP):

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=your@gmail.com`
- `SMTP_PASS=your-app-password`
- Set `EMAIL_DEV_MODE=false` in production

## 3. Confirm GitHub access

```bash
cd "/home/shibayanbiswas/Desktop/SP Workstation"
gh auth status
git remote -v
git push origin main
```

## 4. Deploy on Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import the `sp-workstation` GitHub repository
3. Framework: **Next.js** (auto-detected)
4. Add Environment Variables:

| Name | Value |
|---|---|
| `MONGODB_URI` | Atlas connection string from step 1 |
| `JWT_SECRET` | long random string |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` |
| `NEXT_PUBLIC_SP_DASHBOARD_URL` | `https://sp-dashboard-eta.vercel.app` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your SMTP user |
| `SMTP_PASS` | your SMTP password |
| `SMTP_FROM` | `SP Workstation <noreply@…>` |
| `EMAIL_DEV_MODE` | `false` |
| `SEED_DEFAULT_PASSWORD_MAP` | JSON from `scripts/seed-passwords.example.json` filled with real defaults |
| `FORCE_RESET_PASSWORDS` | `false` |

5. Click **Deploy**
6. Update `NEXT_PUBLIC_APP_URL` to the final Vercel URL if it changed, then
   redeploy.
7. Seed users once:

```bash
curl -X POST https://YOUR-PROJECT.vercel.app/api/auth/seed \
  -H "x-seed-secret: YOUR_JWT_SECRET"
```

8. Sign in with your team email → enter OTP from email → dashboard.

> First login also auto-seeds if the users collection is empty **and** `SEED_DEFAULT_PASSWORD_MAP` (or local `scripts/seed-passwords.local.json`) is available.

## 5. Local development

```bash
cp .env.example .env.local
# MONGODB_URI=memory works locally without Atlas
npm install
npm run dev
```

Open http://localhost:3000

## 6. Production checks

- Confirm `EMAIL_DEV_MODE=false`.
- Confirm OTP and reset email delivery.
- Confirm the reset link uses the production domain.
- Confirm the Atlas database persists users and todos across redeployments.
- Confirm every Primary SP Dashboard route opens or provides its new-tab
  fallback.
- Remove `SEED_DEFAULT_PASSWORD_MAP` after provisioning if automatic creation
  is no longer required.

See [Security Notes](docs/SECURITY.md) and
[Operations](docs/OPERATIONS.md) before wider rollout.
