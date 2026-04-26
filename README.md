<h1 align="center">Core API</h1>

<p align="center">
  Backend built with NestJS. While primarily designed for <a href="https://github.com/Jchnc/core-web">core-web</a>, it is framework-agnostic and can be used with any compatible client. Includes full authentication, 2FA, Google OAuth, role management, and transactional email out of the box.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT" />
  <img src="https://img.shields.io/badge/Google%20OAuth-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google OAuth" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D24-brightgreen?style=flat-square" alt="Node" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-orange?style=flat-square" alt="PRs Welcome" />
  <img src="https://img.shields.io/badge/code_style-prettier-ff69b4?style=flat-square" alt="Prettier" />
  <img src="https://img.shields.io/badge/commits-conventional-fe5196?style=flat-square&logo=conventionalcommits" alt="Conventional Commits" />
</p>

---

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Feature Overview](#feature-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Docker](#docker)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [CI / CD](#ci--cd)
- [Git Conventions](#git-conventions)
- [License](#license)

---

## Why This Exists

After repeatedly implementing the same auth stack, I built a reusable, production-ready backend that can be used across projects.

Most starter backends only handle login and registration. This one includes password recovery, 2FA, trusted devices, Google OAuth, RBAC, request tracing, health checks, Docker, and CI out of the box.

Clone it, configure your `.env`, and start building.

---

## Feature Overview

| Category          | Feature                       | Details                                                                      |
| ----------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| **Auth**          | Email + Password Registration | Validated DTOs, welcome email on signup                                      |
|                   | Login / Logout                | JWT access + refresh token pair, httpOnly cookies                            |
|                   | Token Refresh & Rotation      | Automatic refresh with token rotation to prevent replay attacks              |
|                   | Session Verification          | Lightweight session check without rotating tokens                            |
| **OAuth**         | Google Sign-In                | Full OAuth2 flow via Passport, register or link existing accounts            |
|                   | Set Password for OAuth Users  | OAuth-only users can set a password later for 2FA eligibility                |
| **2FA**           | Email-Based OTP               | Time-limited verification codes sent via email                               |
|                   | Trusted Devices               | Cookie-based device recognition to skip 2FA on known browsers                |
|                   | Rate-Limited Attempts         | Max attempts + TTL to prevent brute-forcing codes                            |
|                   | Password Confirmation         | Enabling/disabling 2FA requires password confirmation                        |
| **Password**      | Argon2 Hashing                | Configurable memory, time cost, and parallelism                              |
|                   | Forgot / Reset Password       | Secure, time-sensitive reset tokens delivered via email                      |
| **Users**         | CRUD + Pagination             | Cursor-based paginated user listing, update, soft-delete                     |
|                   | Role-Based Access (RBAC)      | `@Roles()` decorator, admin-only routes enforced globally                    |
| **Security**      | Helmet                        | HTTP header hardening                                                        |
|                   | CORS                          | Locked to your frontend URL                                                  |
|                   | Throttling                    | Global + per-endpoint rate limiting via `@nestjs/throttler`                  |
|                   | Input Validation              | Strict whitelisting with `class-validator` + `class-transformer`             |
|                   | Request Tracing               | `X-Request-Id` header propagated through logs and error responses            |
| **Email**         | Transactional Mail            | Nodemailer + Handlebars templates (welcome, reset, 2FA code)                 |
| **Observability** | Structured Logging            | Request/response logging interceptor with timing and request IDs             |
|                   | Health Checks                 | Liveness (`/health`) and readiness (`/readiness`) probes via Terminus        |
| **Database**      | Prisma ORM                    | Type-safe queries, migrations, multi-DB support (MySQL, PostgreSQL, MariaDB) |
| **DevOps**        | Docker                        | Multi-stage Dockerfile, non-root runtime, built-in healthcheck               |
|                   | Docker Compose                | One-command local stack (API + MySQL)                                        |
|                   | GitHub Actions CI             | Lint → Format → Build → Test → Coverage upload on every push/PR              |
| **DX**            | Swagger UI                    | Auto-generated interactive docs at `/api/docs`                               |
|                   | Husky + Commitlint            | Pre-commit hooks enforce linting and conventional commits                    |
|                   | Prettier + ESLint             | Consistent formatting and strict type-safe linting                           |

---

## Tech Stack

| Layer            | Technology                         |
| ---------------- | ---------------------------------- |
| Framework        | NestJS 11                          |
| Language         | TypeScript 5                       |
| ORM              | Prisma 7                           |
| Auth             | Passport (JWT, Google OAuth2)      |
| Hashing          | Argon2                             |
| Email            | Nodemailer + Handlebars            |
| Validation       | class-validator, class-transformer |
| Docs             | Swagger / OpenAPI                  |
| Testing          | Jest, Supertest                    |
| CI               | GitHub Actions                     |
| Containerization | Docker, Docker Compose             |

---

## Project Structure

```
src/
├── main.ts                   # Bootstrap, global pipes, CORS, Swagger
├── app.module.ts             # Root module
├── auth/
│   ├── auth.controller.ts    # All auth endpoints
│   ├── auth.service.ts       # Core auth logic (login, register, OAuth, 2FA)
│   ├── two-factor.service.ts
│   ├── services/
│   │   ├── hashing.service.ts
│   │   ├── password.service.ts
│   │   ├── token.service.ts
│   │   └── token-cleanup.service.ts
│   ├── strategies/           # Passport strategies (JWT access, refresh, Google)
│   ├── guards/               # Auth guards + RBAC
│   ├── dto/                  # Request/response validation schemas
│   └── types/                # JWT payload types, OAuth profile types
├── users/
│   ├── users.controller.ts   # CRUD, role management, pagination
│   ├── users.service.ts
│   └── users.repository.ts   # Prisma data access
├── mail/
│   ├── mail.service.ts       # Email dispatch
│   └── templates/            # Handlebars: welcome, reset-password, 2fa-code
├── health/                   # Liveness + readiness probes
├── common/
│   ├── decorators/           # @CurrentUser, @Public, @Roles
│   ├── filters/              # Global HTTP exception filter
│   ├── interceptors/         # Logging, response transform
│   └── middleware/           # X-Request-Id injection
├── config/                   # Typed env validation, modular config files
├── prisma/                   # PrismaService
└── generated/                # Auto-generated Prisma client
```

---

## Getting Started

### Prerequisites

- **Node.js** v24+
- A relational database (MySQL, PostgreSQL, or MariaDB).
- (Optional) Docker & Docker Compose for containerized setup.

### 1. Clone and install

```bash
git clone https://github.com/Jchnc/core-api.git
cd core-api
npm install
```

> **Note:** `npm install` automatically runs `husky` to set up git hooks.

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your values. See [Environment Variables](#environment-variables) below for the full reference.

### 3. Set up the database

```bash
# Generate the Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

> **Tip:** Run `npm run db:studio` anytime to open Prisma Studio (a visual database browser).

### 4. Start developing

```bash
npm run start:dev
```

The API starts on `http://localhost:3000` by default. Swagger docs are available at `http://localhost:3000/api/docs`.

---

## Environment Variables

Copy `.env.example` and fill in each value. The app validates all variables at startup, missing or invalid values will crash immediately with a clear error message, so you'll know exactly what to fix.

| Variable                   | Required | Default       | Description                                  |
| -------------------------- | -------- | ------------- | -------------------------------------------- |
| `NODE_ENV`                 | ✅       | `development` | `development`, `production`, or `test`       |
| `PORT`                     | ✅       | `3000`        | Server port                                  |
| `DATABASE_URL`             | ✅       | —             | Database connection string                   |
| `JWT_ACCESS_SECRET`        | ✅       | —             | Secret for signing access tokens             |
| `JWT_ACCESS_EXPIRES_IN`    | ✅       | —             | Access token lifetime (e.g. `15m`)           |
| `JWT_REFRESH_SECRET`       | ✅       | —             | Secret for signing refresh tokens            |
| `JWT_REFRESH_EXPIRES_IN`   | ✅       | —             | Refresh token lifetime (e.g. `30d`)          |
| `PASSWORD_RESET_TOKEN_TTL` | ✅       | —             | Reset token TTL in seconds (e.g. `3600`)     |
| `FRONTEND_URL`             | ✅       | —             | Your frontend URL (for CORS and email links) |
| `GOOGLE_CLIENT_ID`         | ✅       | —             | Google OAuth client ID                       |
| `GOOGLE_CLIENT_SECRET`     | ✅       | —             | Google OAuth client secret                   |
| `GOOGLE_CALLBACK_URL`      | ✅       | —             | OAuth callback URL                           |
| `MAIL_HOST`                | ✅       | —             | SMTP host (e.g. `smtp.gmail.com`)            |
| `MAIL_PORT`                | ✅       | —             | SMTP port (e.g. `587`)                       |
| `MAIL_USER`                | ✅       | —             | SMTP username                                |
| `MAIL_PASS`                | ✅       | —             | SMTP password / app password                 |
| `MAIL_FROM`                | ✅       | —             | Sender address for outgoing email            |
| `ARGON2_MEMORY_COST`       | —        | `65536`       | Argon2 memory usage in KB                    |
| `ARGON2_TIME_COST`         | —        | `3`           | Argon2 iterations                            |
| `ARGON2_PARALLELISM`       | —        | `4`           | Argon2 parallelism degree                    |
| `TWO_FACTOR_CODE_TTL`      | —        | `600`         | 2FA code lifetime in seconds                 |
| `TWO_FACTOR_MAX_ATTEMPTS`  | —        | `5`           | Max wrong 2FA attempts before invalidation   |
| `TRUSTED_DEVICE_TTL_DAYS`  | —        | `30`          | How long a trusted device cookie lasts       |

> **Tip:** Generate strong JWT secrets with `openssl rand -base64 64`.

> **Warning:** Never commit `.env` to version control. The `.gitignore` already excludes it.

---

## Running the App

```bash
# Development (hot-reload)
npm run start:dev

# Debug mode
npm run start:debug

# Production build
npm run build
npm run start:prod
```

---

## Docker

The project ships with a multi-stage `Dockerfile` and a `docker-compose.yml` for local development.

### Quick start with Docker Compose

```bash
# Spin up API + MySQL
docker compose up -d

# Run migrations inside the container
docker compose exec api npx prisma migrate deploy
```

This gives you:

- **`core-api`** on port `3000` (configurable via `PORT`)
- **`core-db`** (MySQL 8.4) on port `3306`
- Persistent volume for database data
- Health checks on both services

### Build the image standalone

```bash
docker build -t core-api .
docker run -p 3000:3000 --env-file .env core-api
```

The Dockerfile runs as a non-root user and includes a built-in healthcheck against `/api/v1/health`.

---

## API Endpoints

All routes are prefixed with `/api/v1`. Below is a summary (full interactive docs are in Swagger when the app is running).

### Auth (`/api/v1/auth`)

| Method | Path               | Auth          | Description                        |
| ------ | ------------------ | ------------- | ---------------------------------- |
| `POST` | `/register`        | Public        | Create a new account               |
| `POST` | `/login`           | Public        | Login with email + password        |
| `POST` | `/logout`          | Refresh Token | Invalidate refresh token           |
| `POST` | `/refresh`         | Refresh Token | Rotate tokens                      |
| `POST` | `/session`         | Refresh Token | Verify session (no rotation)       |
| `GET`  | `/me`              | Bearer        | Get current user                   |
| `POST` | `/forgot-password` | Public        | Request password reset email       |
| `POST` | `/reset-password`  | Public        | Reset password with token          |
| `POST` | `/set-password`    | Bearer        | Set password (OAuth-only accounts) |
| `GET`  | `/google`          | Public        | Start Google OAuth flow            |
| `GET`  | `/google/callback` | Public        | Google OAuth callback              |
| `POST` | `/2fa/verify`      | Public        | Verify 2FA code                    |
| `POST` | `/2fa/enable`      | Bearer        | Enable 2FA (requires password)     |
| `POST` | `/2fa/disable`     | Bearer        | Disable 2FA (requires password)    |

### Users (`/api/v1/users`)

| Method   | Path        | Auth   | Description                    |
| -------- | ----------- | ------ | ------------------------------ |
| `GET`    | `/`         | Admin  | List users (cursor pagination) |
| `GET`    | `/:id`      | Bearer | Get user by ID (admin or self) |
| `PATCH`  | `/:id`      | Bearer | Update user (admin or self)    |
| `PATCH`  | `/:id/role` | Admin  | Change user role               |
| `DELETE` | `/:id`      | Admin  | Soft-delete a user             |

### Health

| Method | Path                | Auth   | Description                   |
| ------ | ------------------- | ------ | ----------------------------- |
| `GET`  | `/api/v1/health`    | Public | Liveness probe                |
| `GET`  | `/api/v1/readiness` | Public | Readiness probe (DB + memory) |

---

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# End-to-end tests (needs .env.test configured)
npm run test:e2e
```

The CI pipeline runs `test:cov` on every push and uploads the coverage report as a build artifact.

---

## CI / CD

GitHub Actions runs on every push and pull request to `main` and `develop`:

1. **Install** — `npm ci` with cache
2. **Generate** — Prisma client
3. **Format** — Prettier check
4. **Lint** — ESLint (strict, zero warnings)
5. **Build** — Full TypeScript compilation
6. **Test** — Unit tests with coverage
7. **Upload** — Coverage report artifact (retained 7 days)

---

## Git Conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Husky + Commitlint enforce this on every commit, non-conforming messages will be rejected automatically.

```
✅  feat: add google oauth integration
✅  fix(auth): resolve token expiration edge case
❌  Added auth stuff  →  rejected by git hook
```

---

## License

[MIT](LICENSE)

**Jean Christopher Navarro Castillo**
