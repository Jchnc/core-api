<h1 align="center">🚀 Core API</h1>

<p align="center">
  A scalable, robust, and highly secure enterprise-grade backend API built with NestJS. Features advanced JWT authentication, Google OAuth2, centralized role-based access, Prisma ORM, and comprehensive email workflows.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens" alt="JWT" />
  <img src="https://img.shields.io/badge/OAuth2-007ACC?style=for-the-badge&logo=oauth2&logoColor=white" alt="OAuth2" />
  <img src="https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white" alt="MariaDB" />
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions" alt="GitHub Actions" />
</p>

## 🚀 Compatibility

This backend project is fully compatible and designed to work seamlessly with the backend project [core-web](https://github.com/Jchnc/core-web).

## 📌 Overview

Solid, production-ready foundation for scalable server-side applications. It strictly adheres to SOLID principles, enforces clean code through aggressive linting, provides robust continuous integration workflows, and implements top-tier security standards by default.

---

## ✨ Enterprise Features

### 🔐 Advanced Authentication & Authorization

- **Complete Auth Lifecycle:** Registration, Login, Logout, and Token Refresh logic out-of-the-box.
- **Social Login:** Native integration with **Google OAuth2** using Passport strategies.
- **Secure Sessions:** JWT rotation strategy, `httpOnly` secure cookies for refresh tokens to mitigate XSS.
- **Password Security:** Salted and hashed passwords using `argon2` to prevent brute-force attacks.
- **Role-Based Access Control (RBAC):** Customizable `@Roles()` and `@CurrentUser()` decorators mapping to admin/user privileges.

### 🛡 Security & Protection

- **Rate Limiting:** Built-in defenses with `@nestjs/throttler` to prevent DDOS and brute-force endpoints.
- **Data Validation:** Strict DTO schema validation and payload transformation using `class-validator` and `class-transformer`.
- **HTTP Hardening:** Cross-Site Request Forgery and malicious header protections via `Helmet`.
- **CORS Setup:** Configurable Cross-Origin Resource Sharing bound to authorized frontend URLs.

### ✉️ Mailing & Notifications

- **Transactional Emails:** Integrated `Nodemailer` wrapper using `@nestjs-modules/mailer`.
- **Dynamic Templating:** Email templates rendered seamlessly via `Handlebars` (e.g., Welcome Emails, Password Recovery).
- **Secure Password Reset:** Time-sensitive token generation and automated password recovery links.

### 💾 Database & ORM

- **Prisma ORM:** Highly scalable, type-safe database access for relational databases (MySQL, PostgreSQL, MariaDB).
- **Migration Management:** Automated, safe, and reproducible schema migrations.
- **Repository Pattern:** Clean separation of concerns by isolating database logic inside dedicated Repository classes.

### 🛠 Architecture & Dev Experience

- **Swagger UI:** Auto-generated, interactive Open API documentation.
- **Type-Safe Configuration:** Strongly typed and validated `.env` configuration via `@nestjs/config`.
- **Code Quality:** Strictly enforced using `ESLint`, `Prettier`, `Husky` pre-commit hooks, and `Commitlint`.

---

## 🏗️ Project Structure

The codebase is organized in a modular architecture to enforce separation of concerns:

```text
src/
├── app.module.ts         # Root module configuration
├── main.ts               # Application bootstrap and global middleware setup
├── auth/                 # Authentication, OAuth, and JWT handling
├── common/               # Global interceptors, filters, and custom decorators
├── config/               # Environment variables schemas and validation
├── generated/            # Auto-generated assets (e.g. Prisma client outputs)
├── mail/                 # Email templates and mailer service integration
├── prisma/               # Database connection management
└── users/                # User management, RBAC logic, and Repository
```

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v24 or above)
- A running relational database (e.g., MySQL, PostgreSQL, MariaDB)
- OpenSSL (optional, for generating secure JWT secrets)

### 2. Install Dependencies

Clone the repository and install the required npm packages.

```bash
$ npm install
```

_(Note: `npm install` automatically triggers `npm run prepare` to set up Husky git hooks)._

### 3. Environment Configuration

Copy the example environment file:

```bash
$ cp .env.example .env
```

### 🔑 Critical Environment Variables

Configure your local `.env` file. The following variables are **mandatory** for the application to start and operate securely:

#### 1. Core Infrastructure (Essential)

- `DATABASE_URL`: Connection string for the database (e.g., `postgresql://user:password@localhost:5432/db`).
- `NODE_ENV`: Application environment (`development`, `production`, `test`).
- `PORT`: The port the server will listen on (default: `3000`).

#### 2. Security & Authentication (High Priority)

- `JWT_ACCESS_SECRET`: Long random string to sign access tokens.
- `JWT_REFRESH_SECRET`: Long random string to sign refresh tokens.
- `ARGON2_MEMORY_COST`: Memory usage for hashing (default: `65536`).
- `ARGON2_TIME_COST`: Iterations for hashing (default: `3`).
- `ARGON2_PARALLELISM`: Degree of parallelism (default: `4`).

#### 3. Third-Party Integrations

- `GOOGLE_CLIENT_ID`: OAuth2 client ID from Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: OAuth2 client secret.
- `MAIL_USER` / `MAIL_PASS`: SMTP credentials for transactional emails.

---

**Note:** Never commit your `.env` file to version control. Use `.env.example` as a template.

### 4. Database Setup

Generate the Prisma Client types and apply the database migrations to your local database.

```bash
$ npm run db:generate
$ npm run db:migrate
```

_(Tip: You can use `$ npm run db:studio` at any time to open a visual UI for your database)._

### 5. Start the Server

Run the application in development mode with hot-reloading enabled.

```bash
$ npm run start:dev
```

The API should now be running! Verify it by visiting the local Swagger documentation.

---

## 📦 Building for Production

When deploying the application, use the following sequence for a safe build:

```bash
# 1. Clean installation of dependencies
$ npm ci

# 2. Generate Prisma types & safely deploy migrations (without resetting the DB)
$ npm run db:generate
$ npm run db:migrate:prod

# 3. Build optimized production bundle
$ npm run build

# 4. Start the production server
$ npm run start:prod
```

---

## 🧪 Testing

The repository includes a robust suite for unit and end-to-end testing:

```bash
# Run unit tests
$ npm run test

# Run tests and generate coverage report
$ npm run test:cov

# Run E2E tests (requires a separate .env.test configuration)
$ npm run test:e2e
```

---

## 📝 API Documentation

Once the application is running, navigate to the Swagger UI to interact with the endpoints dynamically:

**Local URL:** `http://localhost:3000/api/docs` _(default)_

---

## 🤝 Git & Workflow

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) for automated release generation and clean history.

When committing, `husky` and `commitlint` will validate your messages:

- ✅ `feat: add google oauth integration`
- ✅ `fix: resolve token expiration bug in auth service`
- ❌ `Added auth` _(Will be rejected by Git hooks)_

---

## 👨‍💻 Author

**Jean Christopher Navarro Castillo**

## 📄 License

This project is licensed under the [MIT License](LICENSE).
