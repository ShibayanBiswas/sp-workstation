# Requirements Verification Checklist

Maps original requirements to current implementation. Status: **implemented**
unless noted.

## 1. Workstation for Structured Products team

| Requirement | Status | Implementation |
|---|---|---|
| Internal team workstation | ✅ | Next.js app at `/dashboard` |
| Anand Rathi Wealth branding | ✅ | Gold/cream theme, logo, typography |
| Structured Products focus | ✅ | Copy, module naming, desk layout |

## 2. Login page

| Requirement | Status | Implementation |
|---|---|---|
| Branded login | ✅ | `src/components/auth/LoginForm.tsx` |
| Logo displayed | ✅ | `BrandLogo` component |
| User ID / email field | ✅ | Email input |
| Password field | ✅ | With show/hide toggle |
| Sign In button | ✅ | Gold gradient primary button |
| Forgot password | ✅ | Link beside Sign In |

## 3. Team database

| Member | Email | Status |
|---|---|---|
| Kaplpesh Koradia | kalpeshkoradia@rathi.com | ✅ `src/data/team.ts` |
| Vinay Rathi | vinayrathi@rathi.com | ✅ |
| Sammedhi Shah | sammedishah@rathi.com | ✅ |
| Parth Parekh | parthparekh@rathi.com | ✅ |
| Nishchay Soni | nishchaysoni@rathi.com | ✅ |
| Subhendu Maji | subhendumaji@rathi.com | ✅ |
| Shibayan Biswas | shibayanbiswas@rathi.com | ✅ |

Passwords: `scripts/seed-passwords.local.json` or `SEED_DEFAULT_PASSWORD_MAP`.

## 4. Authentication flows

| Requirement | Status | Implementation |
|---|---|---|
| MongoDB user storage | ✅ | Mongoose `User` model |
| bcrypt password hashing | ✅ | `src/lib/auth.ts` |
| Forgot password → email link | ✅ | `/forgot-password` → SMTP → `/reset-password` |
| User can set new password | ✅ | `POST /api/auth/reset-password` |
| Email OTP after password login | ✅ | `POST /api/auth/login` → `/otp` |
| Correct OTP → dashboard | ✅ | `POST /api/auth/verify-otp` |
| Wrong OTP → retry on OTP page | ✅ | Error shown; pending cookie kept |

## 5. Home dashboard

| Requirement | Status | Implementation |
|---|---|---|
| Terminal layout | ✅ | `DashboardHome.tsx` |
| Personalized greeting | ✅ | `Greeting.tsx` |
| Live tape (auto-scroll) | ✅ | `IndianMarketTape` — 13 indices |
| Snapshot cards | ✅ | `IndianMarketCards` — ordered display |
| Candlestick chart | ✅ | `CandlestickChart` + `lightweight-charts` |
| Default timeframe 1D | ✅ | `LiveCharts.tsx` |
| IST time axis | ✅ | `src/lib/chart-ist.ts` |
| Index order | ✅ | Benchmarks → sectors → VIX → USD/INR |
| No raw Yahoo tickers in UI | ✅ | Names only (e.g. "Nifty 50") |
| 30s live refresh | ✅ | Markets + chart polling |
| Zoom disabled on chart | ✅ | `handleScroll` / `handleScale` off |

### Indices covered

Nifty 50, Sensex, Bank Nifty, Midcap, Next 50, sector indices (IT, Auto,
FMCG, Metal, Pharma, Energy, Fin Service), India VIX, USD/INR.

## 6. Sidebar modules

| Requirement | Status | Implementation |
|---|---|---|
| Left sidebar navigation | ✅ | `Sidebar.tsx` (fixed width, no collapse) |
| Primary SP Dashboard | ✅ | `src/data/modules.ts` |
| Submodule routing | ✅ | `[[...path]]` catch-all + iframe |

## 7. Dark mode

| Requirement | Status | Implementation |
|---|---|---|
| Light/dark toggle | ✅ | `ThemeProvider.tsx` + sidebar button |
| Persisted preference | ✅ | `localStorage` key `sp-theme` |
| Chart respects theme | ✅ | `CandlestickChart` theme sync |

## 8. GitHub repository

| Requirement | Status | Implementation |
|---|---|---|
| Private repo | ✅ | https://github.com/ShibayanBiswas/sp-workstation |
| Code on `main` | ✅ | |

## 9. Vercel + MongoDB deployment

| Requirement | Status | Implementation |
|---|---|---|
| MongoDB Atlas | ✅ | `MONGODB_URI` |
| Deployment guide | ✅ | `DEPLOY.md` (from scratch) |
| Local dev without Atlas | ✅ | `MONGODB_URI=memory` |

## 10. Local run script

| Requirement | Status | Implementation |
|---|---|---|
| PowerShell runner | ✅ | `run.ps1` — `dev`, `build`, `seed`, etc. |

## Removed from home (by design)

- News panel — removed
- Calendar — removed from home
- Todo panel — removed from home
- TradingView embeds — replaced with `lightweight-charts`
