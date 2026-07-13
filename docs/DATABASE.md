# Database and Team Provisioning

## Connections

`src/lib/db.ts` caches the Mongoose connection across hot reloads and
serverless invocations.

### Persistent mode

Set an Atlas connection string:

```dotenv
MONGODB_URI=mongodb+srv://DB_USER:DB_PASSWORD@CLUSTER.mongodb.net/sp-workstation?retryWrites=true&w=majority
```

### Ephemeral local mode

```dotenv
MONGODB_URI=memory
```

This starts `mongodb-memory-server`. It requires no local MongoDB installation,
but all data is lost when the Node.js process exits.

## Collections

### User

- `name`: display name
- `email`: normalized, unique login ID
- `passwordHash`: bcrypt hash
- `role`: `member` or `admin`
- `team`: defaults to `Structured Products`
- timestamps

### Otp

- `userId`: User reference
- `email`: delivery identity
- `code`: six-digit code
- `expiresAt`: TTL expiration
- `consumed`: replay-prevention flag
- timestamps

### PasswordReset

- `userId`: User reference
- `email`: reset identity
- `token`: unique random token
- `expiresAt`: TTL expiration
- `consumed`: replay-prevention flag
- timestamps

### Todo

- `userId`: User reference and ownership boundary
- `title`: 1–200 characters through the API
- `completed`: completion state
- `dueDate`: optional date
- `priority`: `low`, `medium`, or `high`
- timestamps

MongoDB TTL cleanup is asynchronous; application queries still explicitly
check expiration before accepting OTP or reset records.

## Local team seed

Copy the template:

```bash
cp scripts/seed-passwords.example.json scripts/seed-passwords.local.json
```

Replace every `CHANGE_ME` value. The local file is Git-ignored.

Seed with PowerShell:

```bash
pwsh ./run.ps1 seed
```

Or npm:

```bash
npm run seed
```

## Production seed

Set `SEED_DEFAULT_PASSWORD_MAP` in the deployment environment to a single-line
JSON object mapping normalized email addresses to initial passwords. Deploy,
then call:

```bash
curl -X POST "https://YOUR-APP.vercel.app/api/auth/seed" \
  -H "x-seed-secret: YOUR_JWT_SECRET"
```

After successful provisioning, the password-map variable can be removed if
automatic creation of newly listed users is not needed. Existing users retain
their password hashes during normal seeding.

## Updating the roster

1. Edit `src/data/team.ts`.
2. Add the new email/password to the local or production password map.
3. Run the seed.
4. Verify login and OTP delivery.
5. Ask the new member to reset the default password.

## Password reset during seeding

Normal seeding never replaces existing passwords. To intentionally reset all
listed users from the current password map:

```bash
FORCE_RESET_PASSWORDS=true npm run seed
```

Use this only during controlled recovery. Remove the variable immediately
afterward.
