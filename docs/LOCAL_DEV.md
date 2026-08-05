# Local Development Setup

## Overview

SBIMS follows a **headless / decoupled architecture** where the frontend application communicates
with a Deno + Hono backend API.

The backend connects to Supabase Cloud services for:

- PostgreSQL database
- Authentication
- Storage
- Row Level Security (RLS)

Developers run the backend locally while connecting to the shared Supabase Development environment.

The project follows a **Supabase Cloud-first architecture**.

Local development does not use:

- Local PostgreSQL
- Local Supabase database
- Supabase local containers

The application always connects to Supabase Cloud.

---

# Architecture

```
Developer Machine

Frontend Application
        |
        | HTTP API Requests
        ↓
Deno + Hono Backend
        |
        | Supabase SDK
        ↓
Supabase Cloud Development Project

├── PostgreSQL Database
├── Authentication
├── Storage
└── Row Level Security
```

The frontend does **not** connect directly to Supabase.

All database operations go through the backend API.

---

# Technology Stack

- Deno
- Hono
- TypeScript
- Supabase Cloud
- PostgreSQL
- Supabase Auth
- Supabase Storage

---

# Environment Strategy

The project uses separate Supabase Cloud projects.

| Environment | Purpose                        |
| ----------- | ------------------------------ |
| Development | Shared development and testing |
| Production  | Live application environment   |

Rules:

- Never use production credentials during development.
- Never connect local development machines directly to production.
- Development and production databases must remain isolated.

---

# Prerequisites

Install:

| Tool         | Purpose                                          |
| ------------ | ------------------------------------------------ |
| Git          | Source control                                   |
| Deno         | Backend runtime                                  |
| Node.js      | Frontend development                             |
| Supabase CLI | Database migration management (maintainers only) |

Verify installations:

```bash
git --version
deno --version
node --version

# Database maintainers only
supabase --version
```

---

# Fork or Clone the Repository

_Repository_: [https://github.com/imperionite/sbims](https://github.com/imperionite/sbims)

---

# Backend Setup

## Install Dependencies

Run:

```bash
deno cache src/main.ts
```

or start directly:

```bash
deno task dev
```

Deno downloads required dependencies automatically.

---

# Configure Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

Update `.env` with development credentials provided internally.

Example:

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co

SUPABASE_PUBLISHABLE_KEY=xxxxxxxx

SUPABASE_SECRET_KEY=xxxxxxxx

ENVIRONMENT=development
```

---

# Environment Variable Security

The following value is confidential:

```
SUPABASE_SECRET_KEY
```

The service role key:

- is backend-only.
- bypasses Row Level Security.
- must never be exposed to frontend applications.
- must never be committed to Git.

---

# Running the Backend

Start the backend:

```bash
deno task dev
```

Example:

```
http://localhost:8000
```

The backend connects automatically to the shared Supabase Development project using environment
variables.

---

# Frontend Development

Frontend developers should:

1. Pull latest backend changes.
2. Run backend locally.
3. Configure frontend API URL.

Example:

```env
BACKEND_API_URL=http://localhost:8000
```

Communication flow:

```
Frontend

    ↓

Backend API

    ↓

Supabase Cloud
```

---

# Supabase CLI Usage

Most developers do not need Supabase CLI.

Normal developers only need:

- Application source code
- `.env` configuration
- Running backend/frontend applications

Only database maintainers use:

```bash
supabase login
supabase link
supabase migration
supabase db push
```

---

# Docker Usage

This project does not use a local Supabase stack.

Developers should not run:

```bash
supabase start
```

The application does not connect to Docker containers.

However, database maintainers may need Docker Desktop when running certain Supabase CLI commands.

Some commands create temporary containers for database operations, such as:

- schema comparison
- migration generation
- database dumps

These containers are temporary CLI dependencies and are not the application database.

---

# Development Roles

## Application Developers

Responsible for:

- Backend API development
- Frontend development
- Business logic
- Testing

Required:

- Git
- Deno
- Node.js
- Application environment variables

Not required:

- Supabase CLI
- Database permissions
- Supabase Dashboard access

## Database Maintainers

Responsible for:

- Database schema changes
- Migration creation
- RLS policies
- Database functions
- Storage configuration

Required:

- Supabase CLI
- Supabase project access
- Database knowledge

---

# Database Change Policy

The Supabase Dashboard should not be used for permanent schema changes.

Do not manually create:

- Tables
- Columns
- Indexes
- Functions
- Triggers
- RLS policies

All changes must:

1. Be created as migration files.
2. Be reviewed through Git.
3. Be applied using Supabase CLI.

---

# Daily Developer Workflow

## Backend Developer

```bash
git checkout feature_branch

git fetch origin && git rebase origin/main

deno task dev
```

Backend connects to Supabase using `.env`.

---

## Frontend Developer

```bash
git checkout feature_branch

git fetch origin && git rebase origin/main

npm run dev
```

Frontend communicates only with the backend API.

---

# Development Rules

## Backend/Frontend

Allowed:

- API changes
- Business logic
- Bug fixes
- Documentation

Frontend developers should:

- Consume backend APIs.
- Never access the database directly.
- Never store backend credentials.

**Database changes require migrations.**
