# Contributing to Yojimbo

Thanks for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/yojimbo.git`
3. Install dependencies: `npm install`
4. Set up the database: `make db-migrate`
5. Start development: `make dev`

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- Claude Code CLI installed

### Project Structure

```
├── client/          # React frontend (Vite)
├── server/          # Express backend
├── shared/          # Shared types and utilities
└── e2e/             # Playwright E2E tests
```

### Available Commands

```bash
make dev            # Start both client and server
make test           # Run all tests
make lint           # Run linting
make build          # Production build
```

## Making Changes

### Branch Naming

- `feat/description` - New features
- `fix/description` - Bug fixes
- `chore/description` - Maintenance tasks
- `docs/description` - Documentation updates

### Commit Messages

Write clear, concise commit messages:

```
feat: Add instance status polling
fix: Resolve terminal reconnection issue
chore: Update dependencies
docs: Improve setup instructions
```

### Pull Requests

1. Create a branch from `main`
2. Make your changes
3. Run tests: `make test`
4. Run linting: `make lint`
5. Push and open a PR against `main`

PRs should:
- Have a clear title and description
- Pass all CI checks
- Include tests for new functionality

## Code Style

- TypeScript throughout
- ESLint + Prettier for formatting
- Run `make lint` before committing

## Testing

- Unit tests: `npm run test:unit`
- E2E tests: `npm run test:e2e`
- All tests: `make test`

## Reporting Issues

When reporting bugs, please include:
- Steps to reproduce
- Expected vs actual behavior
- Node.js and npm versions
- OS and browser (if applicable)

## Questions?

Open an issue for questions or discussion.
