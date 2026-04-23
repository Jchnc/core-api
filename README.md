<h1 align="center">🚀 Core API</h1>

<p align="center">
  A scalable, robust backend API built with NestJS, featuring JWT authentication, Prisma ORM, and modern development workflows.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens" alt="JWT" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions" alt="GitHub Actions" />
</p>

## 📌 Overview

Solid foundation for scalable server-side applications, enforcing clean code, testing capabilities, and robust continuous integration.

### ✨ Current Features

- **Advanced Authentication:** Complete auth lifecycle featuring JWT, secure HTTP-only cookies, and robust password hashing (`bcrypt`).
- **Mailing Service:** Integrated email support using `Nodemailer` and `Handlebars` templates (e.g., Welcome Emails, Forgot/Reset Password flows).
- **Database Integration:** Scalable `Prisma ORM` setup natively adapted for relational databases with robust migration management.
- **Security & Protection:** Built-in defenses with `Helmet`, Rate Limiting (`Throttler`), and strict DTO validation (`class-validator`).
- **API Documentation:** Interactive and auto-generated `Swagger UI` available out-of-the-box.
- **Type-Safe Configuration:** Centralized environment variable management using `@nestjs/config`.
- **Code Quality:** Strictly enforced using `ESLint`, `Prettier`, `Husky` hooks, and `Commitlint`.
- **Continuous Integration:** Automated linting, building, and unit testing workflows via GitHub Actions.

## 🚀 Getting Started (Local Development)

Follow these sequential steps to get the project up and running in your local environment.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v24 or above)
- A running relational database (e.g., PostgreSQL, MySQL, or MariaDB)

### 2. Install Dependencies

Clone the repository and install the required npm packages.

```bash
$ npm install
```

_(Note: `npm install` will automatically trigger `npm run prepare` to set up Husky git hooks)._

### 3. Environment Configuration

Copy the example environment file and configure your local credentials (like `DATABASE_URL` and JWT secrets).

```bash
$ cp .env.example .env
```

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

The API should now be running. You can verify it by checking the Swagger documentation.

---

## 📦 Building for Production

When preparing the application for a production environment, use the following sequence:

### 1. Clean Install

Install dependencies cleanly based on the `package-lock.json`.

```bash
$ npm ci
```

### 2. Prepare Database

Generate the Prisma types and safely deploy migrations without resetting the database.

```bash
$ npm run db:generate
$ npm run db:migrate:prod
```

### 3. Compile and Run

Build the optimized production bundle and start the server.

```bash
$ npm run build
$ npm run start:prod
```

## 🧪 Testing

```bash
# unit tests
$ npm run test

# test coverage
$ npm run test:cov

# e2e tests
$ npm run test:e2e
```

## 📝 API Documentation

Once the application is running, you can access the Swagger API documentation by navigating to your local server (usually `http://localhost:3000/api` depending on your environment config).

## 🤝 Git & Workflow

This project follows [Conventional Commits](https://www.conventionalcommits.org/). When you make commits, `husky` and `commitlint` will ensure your commit messages are properly formatted (e.g., `feat: add new user route`, `fix: correct login bug`). Linting and formatting are also automatically validated.

## 👨‍💻 Author

**Jean Christopher Navarro Castillo**

## 📄 License

This project is [MIT licensed](LICENSE).
