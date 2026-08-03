# Install Development Tools

Before setting up the project, install the required development tools.

Required tools:

| Tool         | Purpose                       |
| ------------ | ----------------------------- |
| Git          | Source control                |
| Deno         | Backend runtime               |
| Supabase CLI | Database migration management |

---

# Install Git

Download and install Git:

https://git-scm.com/downloads

Verify:

```bash
git --version
```

Example:

```text
git version 2.x.x
```

---

# Install Deno

## Windows 11

Open **PowerShell** and run:

```powershell
irm https://deno.land/install.ps1 | iex
```

Restart PowerShell.

Verify:

```powershell
deno --version
```

---

## macOS

Using Homebrew:

```bash
brew install deno
```

Verify:

```bash
deno --version
```

---

# Install Supabase CLI

Supabase CLI is used by database maintainers for:

- project linking
- database migrations
- schema synchronization

The CLI is installed using npm.

## Install Node.js

If Node.js is not installed:

Download:

https://nodejs.org/

Verify:

```bash
node --version
npm --version
```

---

## Windows 11

Open PowerShell:

```powershell
npm install -g supabase
```

---

## macOS

Open Terminal:

```bash
npm install -g supabase
```

Verify:

```bash
supabase --version
```

---

# Verify Development Environment

Run:

```bash
git --version

deno --version

supabase --version
```

Expected:

```text
Git: Installed
Deno: Installed
Supabase CLI: Installed
```

---

# Tool Usage Reminder

Most developers only need:

- Git
- Deno

Supabase CLI is only required for developers who manage database migrations.

Developers (backend and frontend) who only run the application do not need to run:

```bash
supabase link
supabase db push
supabase migration new
```

unless they are assigned database maintenance responsibilities.
