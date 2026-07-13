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
`redirect: "/dashboard"`. Invalid OTP returns `401`, clears auth cookies, and
returns `redirect: "/login"`.

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

Returns best-effort index quotes:

```json
{
  "quotes": [
    {
      "symbol": "^NSEI",
      "name": "Nifty 50",
      "price": 24000,
      "change": 100,
      "changePercent": 0.42,
      "source": "Yahoo Finance"
    }
  ],
  "asOf": "2026-07-13T04:30:00.000Z"
}
```

External providers can return delayed, partial, or unavailable information.
This data is informational and must not be treated as an execution price.

## News

### `GET /api/news`

Returns up to 12 merged Indian-market headlines:

```json
{
  "news": [
    {
      "title": "Headline",
      "link": "https://provider.example/article",
      "source": "Provider",
      "publishedAt": "Mon, 13 Jul 2026 04:30:00 GMT",
      "summary": "Short summary"
    }
  ],
  "fetchedAt": "2026-07-13T04:31:00.000Z"
}
```

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
