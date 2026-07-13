# API Reference

All request and response bodies use JSON. Protected endpoints require a valid
`sp_session` HTTP-only cookie.

## Authentication

### `POST /api/auth/login`

Validates the password, generates an OTP, sends email, and creates the pending
login cookie.

Request:

```json
{
  "email": "user@rathi.com",
  "password": "user-supplied-password"
}
```

Success: `200` with `ok`, masked workflow information, and development preview
fields when enabled. Invalid credentials return `401`.

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

Returns the same generic success message for known and unknown accounts.

### `POST /api/auth/reset-password`

```json
{
  "token": "token-from-reset-link",
  "password": "NewStrongPassword1"
}
```

Consumes a valid reset token and replaces the password hash.

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
      "group": "benchmark"
    }
  ],
  "marketStatus": "open",
  "asOf": "2026-07-13T06:40:00.000Z"
}
```

Quotes refresh every 30 seconds on the client. Yahoo Finance is best-effort;
data may be delayed.

## Charts

### `GET /api/chart?indexId=nifty&timeframe=1D`

Returns OHLC candle data for the selected index and timeframe.

Query parameters:

- `indexId` — key from `src/data/indian-markets.ts` (e.g. `nifty`, `sensex`)
- `timeframe` — `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, or `5Y` (default `1D`)

```json
{
  "indexId": "nifty",
  "name": "Nifty 50",
  "timeframe": "1D",
  "bars": [{ "time": 1720867500, "open": 24100, "high": 24180, "low": 24090, "close": 24158.75 }],
  "last": { "price": 24158.75, "change": -239.95, "changePercent": -0.98, "time": 1720867500 },
  "asOf": "2026-07-13T06:40:00.000Z"
}
```

Intraday bars are filtered to NSE session hours (09:15–15:30 IST). Chart time
axis labels are formatted in IST.

## Todos

Todo records are always scoped to the authenticated user.

### `GET /api/todos`

Lists incomplete items first, then newest items.

### `POST /api/todos`

```json
{
  "title": "Review rollover candidates",
  "priority": "high",
  "dueDate": "2026-07-14"
}
```

`priority` may be `low`, `medium`, or `high`.

### `PATCH /api/todos`

```json
{
  "id": "mongodb-object-id",
  "completed": true
}
```

The request may update `completed`, `title`, or `priority`.

### `DELETE /api/todos?id=<mongodb-object-id>`

Deletes the matching record only when it belongs to the current user.

## Common status codes

- `200`: request succeeded
- `400`: invalid input or expired reset token
- `401`: authentication required or credentials invalid
- `404`: user-owned object not found
- `500`: database, email, or unexpected server failure
