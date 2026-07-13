# Requirements Verification Checklist

This document maps every original requirement to its implementation in the
codebase. Status: **implemented** unless noted.

## 1. Workstation for Structured Products team

| Requirement | Status | Implementation |
|---|---|---|
| Internal team workstation | ✅ | Next.js app at `/dashboard` |
| Anand Rathi Wealth branding | ✅ | Gold/cream theme, logo, typography |
| Structured Products focus | ✅ | Copy, module naming, desk todos |

## 2. Login page

| Requirement | Status | Implementation |
|---|---|---|
| Sexy branded login | ✅ | `src/components/auth/LoginForm.tsx` |
| Reference anandrathiwealth.in styling | ✅ | Gold gradients, values, contact block |
| Reference sp-dashboard-eta theme | ✅ | Dark panels, gold accents |
| Logo displayed properly | ✅ | `/public/brand/arwl-logo.png` |
| Contact info without links | ✅ | Phone, email, address as plain text |
| Company values sections | ✅ | Fearless, Uncomplicated, Data, Transparency |
| User ID / email field | ✅ | Email input labeled "USER ID / EMAIL" |
| Password field | ✅ | With show/hide toggle |
| Sign In button | ✅ | Gold gradient primary button |
| Forgot password near Sign In | ✅ | Link beside Sign In button |

## 3. Team database (7 members)

| Member | Email | Status |
|---|---|---|
| Kaplpesh Koradia | kalpeshkoradia@rathi.com | ✅ `src/data/team.ts` |
| Vinay Rathi | vinayrathi@rathi.com | ✅ |
| Sammedhi Shah | sammedishah@rathi.com | ✅ |
| Parth Parekh | parthparekh@rathi.com | ✅ |
| Nishchay Soni | nishchaysoni@rathi.com | ✅ |
| Subhendu Maji | subhendumaji@rathi.com | ✅ |
| Shibayan Biswas | shiabaynbiswas@rathi.com | ✅ |

Default passwords: `scripts/seed-passwords.local.json` (gitignored) or
`SEED_DEFAULT_PASSWORD_MAP` env var.

## 4. Authentication flows

| Requirement | Status | Implementation |
|---|---|---|
| MongoDB user storage | ✅ | Mongoose `User` model |
| bcrypt password hashing | ✅ | `src/lib/auth.ts` |
| Default password on first seed | ✅ | `src/lib/seed.ts` |
| Forgot password → email link | ✅ | `/forgot-password` → SMTP → `/reset-password` |
| User can set new password | ✅ | `POST /api/auth/reset-password` |
| Email OTP after password login | ✅ | `POST /api/auth/login` → `/otp` |
| Correct OTP → dashboard | ✅ | `POST /api/auth/verify-otp` → `/dashboard` |
| Wrong OTP → back to login | ✅ | Clears cookies, redirects `/login` |

## 5. Home dashboard (post-login)

| Requirement | Status | Implementation |
|---|---|---|
| Sexy elegant terminal | ✅ | Terminal header, ticker, sparklines |
| Personalized greeting | ✅ | `Greeting.tsx` with time-of-day |
| Nifty live data | ✅ | Yahoo Finance `^NSEI` |
| Sensex live data | ✅ | Yahoo Finance `^BSESN` |
| Bank Nifty | ✅ | `^NSEBANK` |
| India VIX | ✅ | `^INDIAVIX` |
| USD/INR | ✅ | `INR=X` |
| Gold reference | ✅ | `GC=F` |
| Live charts (Nifty/Sensex/Bank Nifty) | ✅ | TradingView embeds with tab switcher |
| Financial news (Indian markets) | ✅ | RSS feeds + featured headline |
| Calendar | ✅ | `CalendarPanel.tsx` |
| Todo list | ✅ | MongoDB-backed `TodoPanel.tsx` |
| Free data sources only | ✅ | Yahoo, RSS, TradingView widgets |
| Morningstar-style density | ✅ | Terminal bar, ticker, index cards, quick modules |

## 6. Sidebar modules

| Requirement | Status | Implementation |
|---|---|---|
| Left sidebar navigation | ✅ | `Sidebar.tsx` |
| Primary SP Dashboard main module | ✅ | `src/data/modules.ts` |
| Submodules mapped to sp-dashboard | ✅ | 8 submodules with correct `spPath` |
| Click navigates to correct page | ✅ | `[[...path]]` catch-all + iframe |
| Overview → `/` | ✅ |
| Portfolio Analytics → `/portfolio/analytics` | ✅ |
| Portfolio Details → `/portfolio/details` | ✅ |
| Desk → `/desk` | ✅ |
| Intelligence → `/intelligence` | ✅ |
| Valuation → `/valuation` | ✅ |
| Payoff → `/payoff` | ✅ |
| Upload → `/upload` | ✅ |

## 7. Dark mode

| Requirement | Status | Implementation |
|---|---|---|
| Light/dark toggle | ✅ | `ThemeProvider.tsx` + sidebar button |
| Persisted preference | ✅ | `localStorage` key `sp-theme` |
| Charts respect theme | ✅ | TradingView theme sync |

## 8. GitHub repository

| Requirement | Status | Implementation |
|---|---|---|
| New repo under ShibayanBiswas | ✅ | https://github.com/ShibayanBiswas/sp-workstation (private) |
| Code pushed | ✅ | `main` branch |

## 9. Vercel + MongoDB deployment

| Requirement | Status | Implementation |
|---|---|---|
| MongoDB Atlas support | ✅ | `MONGODB_URI` in `.env.example` |
| Vercel deployment guide | ✅ | `DEPLOY.md` |
| Local dev without Atlas | ✅ | `MONGODB_URI=memory` fallback |

## 10. Local run script

| Requirement | Status | Implementation |
|---|---|---|
| PowerShell runner for Ubuntu | ✅ | `run.ps1` with `dev`, `build`, `seed`, etc. |
| Documentation | ✅ | `docs/LOCAL_DEVELOPMENT.md` |

## Test credentials (Shibayan Biswas)

- Email: `shiabaynbiswas@rathi.com`
- Default password: in `scripts/seed-passwords.local.json`
- Flow: Login → OTP (dev preview when `EMAIL_DEV_MODE=true`) → Dashboard

## Adding new team members

Tell the developer the name, email, and default password. They will:

1. Add to `src/data/team.ts`
2. Add password to local seed file or `SEED_DEFAULT_PASSWORD_MAP`
3. Run `pwsh ./run.ps1 seed`
