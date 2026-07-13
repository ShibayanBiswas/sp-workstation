# Local Development on Ubuntu

## Requirements

- Ubuntu or another supported Linux distribution
- Node.js 20.9 or newer
- npm
- PowerShell 7 (`pwsh`) to use `run.ps1`

Verify:

```bash
node --version
npm --version
pwsh --version
```

## Install PowerShell 7

PowerShell is not the same program as the default Bash shell. Follow
Microsoft's current Ubuntu installation instructions:

<https://learn.microsoft.com/powershell/scripting/install/install-ubuntu>

After installation, the executable must be available as `pwsh`.

## First run

From the repository:

```bash
cd "/home/shibayanbiswas/Desktop/SP Workstation"
pwsh ./run.ps1 install
pwsh ./run.ps1 dev
```

Open <http://127.0.0.1:3000>.

`dev` runs in the foreground. Press `Ctrl+C` to stop it.

If `.env.local` does not exist, `run.ps1 dev` creates a safe local file with:

- an ephemeral in-memory MongoDB;
- a generated JWT secret;
- local application URL;
- local OTP codes shown on the verification screen.

It never overwrites an existing `.env.local`.

## PowerShell command runner

```text
pwsh ./run.ps1 help
pwsh ./run.ps1 install
pwsh ./run.ps1 dev
pwsh ./run.ps1 lint
pwsh ./run.ps1 build
pwsh ./run.ps1 start
pwsh ./run.ps1 seed
```

Use a different port:

```bash
pwsh ./run.ps1 dev -Port 3001
```

Listen on all interfaces for LAN testing:

```bash
pwsh ./run.ps1 dev -HostAddress 0.0.0.0
```

## Bash equivalents

PowerShell is optional for the application itself:

```bash
npm ci
npm run dev -- -H 127.0.0.1 -p 3000
npm run lint
npm run build
npm run start -- -H 127.0.0.1 -p 3000
npm run seed
```

## Local data behavior

With `MONGODB_URI=memory`, data persists only while the dev process runs.
Restarting the app creates a new database. The first login auto-seeds users
when the local password map is available.

For persistent development:

1. create a MongoDB Atlas development database;
2. set its URI in `.env.local`;
3. run `pwsh ./run.ps1 seed`.

## Validation before a change is handed off

```bash
pwsh ./run.ps1 lint
pwsh ./run.ps1 build
```

Next.js 16 does not run ESLint as part of `next build`, so both checks are
required.
