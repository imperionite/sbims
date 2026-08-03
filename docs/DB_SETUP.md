# Supabase Cloud Database Setup and Maintenance Guide

## Overview

This document explains how to recreate, configure, and maintain the SBIMS Supabase Cloud database
environment.

This guide is intended for:

- Database maintainers
- Backend maintainers
- System administrators

It documents:

- Supabase Cloud project creation
- Database configuration
- Security settings
- API credentials
- Project linking
- Migration management
- Existing database structure

The project follows a **Supabase Cloud-first architecture**.

Local development does not use:

- Docker Desktop
- Local Supabase containers
- Local PostgreSQL

All database operations are performed against Supabase Cloud.

---

# Technology Stack

- Supabase Cloud
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security (RLS)
- Supabase CLI migrations

Application layer:

- Deno
- Hono
- TypeScript

---

# Architecture

```text
Backend Application

Deno + Hono API
        |
        |
        ↓
Supabase Cloud

├── PostgreSQL Database
├── Authentication
├── Storage
└── Row Level Security
```

---

# Supabase Environment Strategy

The project uses separate environments:

| Environment | Purpose                        |
| ----------- | ------------------------------ |
| Development | Shared development and testing |
| Production  | Live application environment   |

Development and production must use separate Supabase projects.

---

# Create Supabase Cloud Project

Open:

```text
https://supabase.com/dashboard
```

Create a new project.

Example:

```text
Project Name:
sbims-dev

Region:
Singapore

Database Password:
Generate secure password
```

Wait until:

```text
Project Status: ACTIVE
```

---

# Configure Database Security

Recommended settings:

```text
Data API
Enabled

Automatically expose new tables
Disabled

Row Level Security (RLS)
Enabled
```

Reason:

- API access requires Data API support.
- Tables should not automatically become publicly accessible.
- RLS protects database records.

---

# Install Supabase CLI

Supabase CLI is required only for database maintainers.

Install:

```bash
npm install -g supabase
```

Verify:

```bash
supabase --version
```

---

# Authenticate Supabase CLI

Login:

```bash
supabase login
```

Check available projects:

```bash
supabase projects list
```

![Project List](https://drive.google.com/uc?id=1np1UzxCqECJ3E0HJnEkuikvPgLdZf18p)

---

# Retrieve Project Reference ID

The project reference ID can be found:

Supabase Dashboard:

```text
Project Settings
→ General
→ Reference ID
```

or:

```bash
supabase projects list
```

Example:

```text
REFERENCE ID:

abcdefghijklmnop
```

---

# Link Local Repository

Inside the repository:

```bash
supabase link --project-ref PROJECT_REFERENCE_ID
```

Example:

```bash
supabase link --project-ref abcdefghijklmnop
```

This connects the local Supabase CLI configuration to the cloud project.

![Project Linking](https://drive.google.com/uc?id=1aZOEAem1GKp6EqTHh1FS-8HDdUKiZ-ZZ)

---

# Initialize Supabase Configuration

For a new repository:

```bash
supabase init
```

Creates:

```text
supabase/

├── config.toml
└── migrations/
```

For an existing repository:

Do not run `supabase init` if the `supabase/` directory already exists.

---

# Environment Configuration

Application credentials are stored separately from source code.

Example:

```env
SUPABASE_URL=https://abcdefghijklmnop.supabase.co

SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx

SUPABASE_SECRET_KEY=sb_secret_xxxxx

ENVIRONMENT=development
```

Never commit:

```text
.env
```

The service role key must remain backend-only.

---

# Retrieve API Credentials

From Supabase Dashboard:

```text
Project Settings
→ API
→ API Keys
```

Required values:

```env
SUPABASE_URL

SUPABASE_PUBLISHABLE_KEY

SUPABASE_SECRET_KEY
```

![Rerieve API Keys](https://drive.google.com/uc?id=1vL7XasUgylOo20sIQanb9sBCAcBybpCq)

---

# Initial Database Schema Snapshot

The first database snapshot is generated from the Supabase Cloud database.

The Supabase CLI connects to the linked remote project, but some database commands may require
Docker because the CLI creates temporary local containers (such as a shadow database) during schema
comparison and migration operations.

Docker is not used as the application database. The application continues to use Supabase Cloud.

## Generate Initial Schema Snapshot

Ensure Docker Desktop is running before executing:

````bash
# at the project root
mkdir -p supabase/migrations

supabase db dump --linked --schema public > supabase/migrations/00000000000000_initial.sql

---

# Database Migration Management

Database schema changes must always be managed through migrations.

Migration files are stored:

```text
supabase/migrations/
````

---

# Create Migration

Create a new migration:

```bash
supabase migration new migration_name
```

Example:

```bash
supabase migration new create_profiles_table
```

---

# Apply Migration

Deploy migration changes:

```bash
supabase db push
```

---

# Check Migration Status

```bash
supabase migration list
```

---

# Existing Database Documentation

This section documents the current database implementation.

## Tables

Document all tables:

| Table    | Purpose                  | RLS Enabled |
| -------- | ------------------------ | ----------- |
| profiles | User profile information | Yes         |
|          |                          |             |

---

## Authentication

Document:

- Authentication provider
- User roles
- Custom claims
- Auth triggers

Example:

```text
Supabase Auth

Provider:
Email authentication

User metadata:
Stored in profiles table
```

---

## Storage

Document:

| Bucket | Purpose | Access |
| ------ | ------- | ------ |
|        |         |        |

---

## Database Functions

Document:

| Function | Purpose |
| -------- | ------- |
|          |         |

---

## Database Policies

Document RLS policies:

| Table | Policy | Description |
| ----- | ------ | ----------- |
|       |        |             |

---

# Database Change Workflow

Before modifying production:

1. Create migration.
2. Test against development database.
3. Review migration SQL.
4. Apply migration.
5. Commit migration file.

Workflow:

```text
Create Migration
        |
        ↓
Test on Development
        |
        ↓
supabase db push
        |
        ↓
Commit Migration
```

---

# Supabase CLI Command Reference

| Command                             | Purpose                               |
| ----------------------------------- | ------------------------------------- |
| `supabase login`                    | Authenticate CLI                      |
| `supabase projects list`            | List projects                         |
| `supabase projects api-keys REF ID` | List API Keys                         |
| `supabase link --project-ref ID`    | Link project                          |
| `supabase migration new NAME`       | Create migration                      |
| `supabase migration list`           | View migrations                       |
| `supabase db push`                  | Apply migrations                      |
| `supabase db pull`.                 | Generate migration from remote schema |
| `supabase migration new init`       | Create migrations directory           |

---

# Maintenance Rules

- Never modify production manually without a migration.
- Never commit credentials.
- Keep migration files in version control.
- Keep development and production databases separate.
- Document new tables, policies, functions, and storage buckets.
