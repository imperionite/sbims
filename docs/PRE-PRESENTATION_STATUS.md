# SBIMS Backend API: Pre-Presentation Status Report

- **Project:** Serverless-Based Internship Management System for Higher Education Institutions
- **System Component:** Serverless Backend API
- **Status:** Functional prototype / integration and stabilization phase

## Overall Backend Status

The SBIMS backend has progressed from initial domain implementation into the **functional prototype
and stabilization phase**.

The backend is implemented as a modular API using **Deno, TypeScript, Hono, Supabase/PostgreSQL, and
serverless deployment tooling**. The API separates authentication, business logic, data access,
validation, authorization, and system services into dedicated modules.

The current API exposes the major system domains required by the prototype:

- Authentication
- User and role management
- Students
- HTE/company management
- Internships
- Attendance
- Evaluations
- Documents
- Reports
- Audit logs
- Health/performance endpoints

The API route registry currently connects these modules under the versioned API structure.

## Implemented Backend Architecture

The current backend follows a headless/API-driven architecture:

**React Frontend → HTTP API → Hono Services → Supabase/PostgreSQL**

The backend is responsible for:

- Authentication and token verification
- Role-based authorization
- Request validation
- Internship business rules
- Database operations
- Attendance validation
- Evaluation lifecycle rules
- Document upload/review operations
- Audit logging
- Report generation
- API-level error handling

The backend is designed for serverless deployment and currently includes Cloudflare/Wrangler
deployment configuration and environment-based configuration.

## Database and Domain Foundation

The database has undergone multiple domain revisions and now includes migrations covering:

- Authentication/profile foundation
- Student profiles
- HTE profiles
- Internship assignments
- Required internship hours
- Attendance
- Evaluations
- Documents
- Student/internship domain revisions
- HTE supervisor uniqueness
- Audit logs
- Internship periods
- Evaluation lifecycle revisions
- Document revisions

The current internship domain uses the lifecycle:

**pending → active → completed**

The database design also treats internships as historical records, allowing multiple completed
internship records while restricting a student to at most one pending or active internship.

This is important for the prototype because the system is no longer modeled as a single permanent
internship record per student.

## Authentication and Authorization

Authentication is implemented through Supabase Auth and backend authentication middleware.

The backend verifies bearer tokens before protected operations and exposes role-based access control
for the defined application roles:

- Administrator
- Internship Coordinator
- Faculty Adviser
- Student
- HTE Supervisor

The API applies role restrictions at the route level and additional resource-level checks inside
services where necessary.

## Internship Management

The Internship module is functionally implemented.

Current capabilities include:

- Creating internship assignments
- Retrieving internship records
- Listing internships
- Retrieving the student's operational internship
- Updating HTE assignment
- Updating faculty adviser assignment
- Updating internship dates
- Updating required hours
- Changing internship lifecycle status
- Preventing invalid lifecycle transitions

The current lifecycle rules are:

```text
pending → active → completed
```

Invalid transitions such as:

```text
pending → completed
completed → active
```

are rejected.

The backend also enforces the rule that a student cannot have another pending/active internship
while an operational internship already exists.

## Attendance Management

Attendance functionality is implemented with:

- Student attendance creation
- Attendance retrieval
- Attendance validation/rejection
- Internship-specific attendance records
- Rendered-hours calculation
- Required-hours monitoring

The database enforces one attendance record per internship per date and validates time ranges.

Students can create attendance for their own active internship, while coordinators have management
access.

This attendance functionality is also used by the evaluation eligibility workflow.

## Evaluation Management

The Evaluation module has reached the **functional lifecycle stage**.

The system supports:

- HTE Supervisor evaluations
- Faculty Adviser evaluations
- Draft evaluations
- Evaluation submission
- Duplicate evaluation prevention
- Evaluator assignment authorization
- Internship eligibility validation
- Required-hours validation
- Retrieval of submitted evaluations
- Student evaluation history
- Completed-internship evaluation history

Evaluation responses use internal keys:

```text
criterion_1
criterion_2
...
criterion_8
```

while the frontend presents human-readable criterion labels.

The current evaluation workflow separates creating a draft from submitting a final evaluation. Final
submission checks the internship period, required hours, and attendance/rendered-hours eligibility.

## Document Management

The Documents module is implemented with a private Supabase Storage bucket.

The backend supports:

- Document upload
- Document retrieval
- Internship-specific document listing
- Document approval
- Document rejection
- Document deletion
- Review metadata
- Private storage access

A significant recent improvement is the handling of private document files.

The database stores the `storage_path`; it does not permanently store a public URL. The backend
generates signed URLs when authorized users retrieve documents.

The current prototype therefore supports the intended flow:

```text
Private Storage
      ↓
Backend authorization
      ↓
Short-lived signed URL
      ↓
React frontend
      ↓
View/download document
```

The document storage bucket is intentionally private and access is controlled by the backend.

## Audit Logging

Audit logging is implemented as a dedicated backend module and database table.

The audit system records important successful actions such as:

- Login/logout
- Password changes
- User creation/update
- Role changes
- Internship creation/update/status changes
- Adviser/supervisor assignment
- Attendance actions
- Evaluation actions
- Document actions
- Report generation

The audit service records the authenticated actor, action, resource, resource ID, details, IP
address when available, and timestamp.

The audit endpoint is intentionally read-only from the API perspective; application audit records
are written by the backend service.

## Security and Data Access

The backend/database currently uses several security controls:

- Supabase authentication
- Bearer-token verification
- Role-based API authorization
- PostgreSQL Row Level Security
- Service-role access for protected backend operations
- Private document storage
- Signed document URLs
- Input validation using Zod
- Audit logging
- Rate-limiting infrastructure

The database migrations explicitly enable RLS for protected domain tables, including attendance and
audit logging.

## Testing Status

Testing is currently in the **stabilization stage**, rather than being considered completely
finished.

Recent testing has identified several test-contract mismatches caused by domain revisions.

## Prototype Readiness Assessment

The backend can reasonably be described as:

> **Functionally implemented and undergoing final integration/stabilization for prototype
> presentation.**

It should **not yet be described as production-complete**.

For the capstone presentation, the stronger and more accurate position is that the backend already
demonstrates the project's core technical objectives:

- Serverless API architecture
- Modular backend design
- Managed PostgreSQL database
- Authentication
- Role-based access control
- Domain-specific business rules
- Attendance tracking
- Evaluation workflows
- Private document storage
- Signed file access
- Audit logging
- Reporting
- Automated unit/integration testing

The remaining work is primarily **contract alignment, integration verification, test stabilization,
and prototype polish**, rather than building the entire backend from scratch.

### Live Deployment Infrastructure

To support the project's architectural goals, the backend utilizes a dual-deployment strategy:

- **Primary Production API (Deno Deploy):** Serves as the main active backend hosting the functional
  prototype, fully integrated with Supabase/PostgreSQL.
  - **Base URL:** `https://api.sbims.me/api/v1`
- **POC Multi-Cloud API (Cloudflare Workers):** Serves as a live Proof-of-Concept (POC)
  demonstrating framework portability (Hono/TypeScript) and zero-vendor-lock-in across serverless
  providers.
  - **Base URL:** `https://cf.sbims.me/api/v1`
- **Health Check Endpoint:** GET [/api/v1/health](https://api.sbims.me/api/v1/health)
- **Performance Check Endpoint:** GET
  [/api/v1/performance](https://api.sbims.me/api/v1/performance/compute)

## Current Status

The backend status can be summarized as:

> **The backend has reached a functional prototype stage. The major serverless API modules, database
> domains, authentication, authorization, business rules, document storage, evaluation workflows,
> attendance processing, reporting, and audit logging have been implemented. Current development is
> focused on integration testing, API contract alignment, frontend-backend verification, and
> stabilization before prototype presentation.**
