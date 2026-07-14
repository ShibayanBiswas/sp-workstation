# API Reference

All request and response bodies use JSON. Protected endpoints require a valid
`sp_session` HTTP-only cookie.

## Authentication

### `POST /api/auth/login`

Validates the password, generates an OTP, and creates the pending login cookie.
The OTP is returned in the response body for display on `/otp`.

Request:

```json
{
  "email": "user@rathi.com",
  "password": "user-supplied-password"
}
```

Responses:

| Status | `error` | Meaning |
|--------|---------|---------|
| `401` | `Invalid email ID.` | Email not in `src/data/team.ts` roster |
| `401` | `Wrong password.` | Roster email with incorrect password |
| `200` | — | Success: `ok`, `email`, `otp` (6-digit code) |

### `POST /api/auth/verify-otp`

Requires `sp_pending`.

```json
{
  "code": "123456"
}
```

Success: `200`, creates `sp_session`, clears `sp_pending`, and returns
`redirect: "/dashboard"`. Invalid OTP returns `401` with an error message; the
user can retry while the pending cookie is valid.

### `POST /api/auth/logout`

Clears pending and authenticated cookies. Returns:

```json
{ "ok": true }
```

### `GET /api/auth/me`

Returns the current session identity. Unauthenticated requests return `401`.

### `POST /api/auth/forgot-password`

```json
{ "email": "user@rathi.com" }
```

| Status | Behaviour |
|--------|-----------|
| `401` | `Invalid email ID.` — email not in roster |
| `200` | Known account: OTP generated, `sp_pending` set, returns `otp` and `redirect: "/change-password"` |

### `POST /api/auth/request-password-otp`

Requires `sp_session`. Generates OTP for the logged-in user. Returns `otp` and
`email`. Used when visiting `/change-password` while authenticated.

### `POST /api/auth/change-password`

Requires `sp_pending` with `password_reset` purpose.

```json
{
  "code": "123456",
  "password": "NewStrongPassword1"
}
```

Validates OTP, updates password hash, clears all auth cookies.

### `POST /api/auth/seed`

Creates or updates users from the team roster. Production requires:

```http
x-seed-secret: <JWT_SECRET>
```

The endpoint is intended for controlled provisioning, not routine browser use.

## Markets

### `GET /api/markets`

Returns live index quotes in display order (benchmarks → sectors → VIX → USD/INR):

```json
{
  "quotes": [
    {
      "id": "nifty",
      "name": "Nifty 50",
      "price": 24158.75,
      "change": -239.95,
      "changePercent": -0.98,
      "sparkline": [24000, 24100, 24158],
      "group": "benchmark",
      "marketTime": 1720866600
    }
  ],
  "marketStatus": "open",
  "asOf": "2026-07-13T06:40:00.000Z"
}
```

Quotes are normalized in `src/lib/market-quote.ts` (change and return computed
from price vs previous close). The client polls every **60 seconds** via
`MarketsProvider`. Yahoo Finance is best-effort; data may be delayed.

## Charts

### `GET /api/chart?indexId=nifty&timeframe=1D`

Returns OHLC candle data for the selected index and timeframe.

Query parameters:

- `indexId` — one of the IDs in `src/data/indian-markets.ts`
- `timeframe` — `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, or `5Y`
- `before` — optional Unix timestamp for scroll-back history

Response includes `bars`, `last` (price, change, changePercent, **reference**,
time), and `asOf`.

**Period returns are timeframe-aware** (`src/lib/chart-period-return.ts`):

| Timeframe | Change / % measured from |
|-----------|--------------------------|
| `1D` | **Previous close** (same as Snapshot / tape) |
| `1W` | Week open (Monday IST) → last |
| `1M` | Calendar month open (1st IST) → last |
| `3M` / `6M` / `1Y` / `5Y` | Open of first bar ~lookback ago → last |

On **1D**, chart header change/% matches Snapshot. Longer timeframes show
period returns and label the basis (e.g. “vs week open”).

The chart client polls every **60 seconds** (`LIVE_REFRESH_MS` in
`src/lib/live-refresh.ts`).

## Todos

### `GET /api/todos`

Returns todos for the authenticated user.

### `POST /api/todos`

Creates a todo.

### `PATCH /api/todos`

Updates a todo by MongoDB ObjectId.

### `DELETE /api/todos?id=<objectId>`

Deletes a todo.

> Todos API exists but has no UI yet.
