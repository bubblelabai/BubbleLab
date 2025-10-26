# Conventional Commits Guide

A guide to writing clear, consistent commit messages using the Conventional Commits specification.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: Required - describes the category of change
- **scope**: Optional - describes what part of the codebase is affected
- **subject**: Required - short description of the change
- **body**: Optional - detailed explanation
- **footer**: Optional - breaking changes, issue references

## Commit Types

### Primary Types

| Type       | Description                             | Example                                   |
| ---------- | --------------------------------------- | ----------------------------------------- |
| `feat`     | A new feature                           | `feat: add user authentication`           |
| `fix`      | A bug fix                               | `fix: resolve login timeout issue`        |
| `docs`     | Documentation only changes              | `docs: update API usage examples`         |
| `style`    | Code style/formatting (no logic change) | `style: format code with prettier`        |
| `refactor` | Code restructuring (no feature/fix)     | `refactor: simplify payment logic`        |
| `perf`     | Performance improvements                | `perf: optimize database queries`         |
| `test`     | Adding or updating tests                | `test: add unit tests for auth module`    |
| `chore`    | Maintenance tasks                       | `chore: update dependencies`              |
| `build`    | Build system or dependencies            | `build: upgrade webpack to v5`            |
| `ci`       | CI/CD configuration changes             | `ci: add GitHub Actions workflow`         |
| `revert`   | Reverting a previous commit             | `revert: revert "feat: add beta feature"` |

## Error Handling Commits

When adding error handling, choose the type based on context:

### Use `fix:` when

- Fixing a bug by adding missing error handling
- Resolving crashes or unexpected behavior

```
fix: add error handling for null pointer exception
fix: catch network timeout errors in API client
```

### Use `feat:` when

- Adding error handling as a new capability
- Implementing a new error handling system

```
feat: add comprehensive error handling middleware
feat: implement retry logic with exponential backoff
```

### Use `refactor:` when

- Improving existing error handling
- Restructuring error handling code

```
refactor: improve error handling in payment flow
refactor: consolidate error handling logic
```

## Scope Examples

Scopes help identify which part of the codebase changed:

```
feat(auth): add OAuth2 integration
fix(api): handle rate limit errors
docs(readme): add installation instructions
refactor(database): optimize query performance
test(utils): add validation helper tests
```

## Writing Good Commit Messages

### Subject Line Rules

1. **Use imperative mood**: "add" not "added" or "adds"
2. **Don't capitalize first letter**: `feat: add feature` not `feat: Add feature`
3. **No period at the end**: `fix: resolve bug` not `fix: resolve bug.`
4. **Keep it under 50 characters** when possible
5. **Be specific and descriptive**

### Good Examples

```
feat: add email verification on signup
fix: prevent duplicate form submissions
docs: add architecture decision records
refactor: extract validation into separate module
perf: lazy load images on dashboard
```

### Bad Examples

```
feat: updated stuff
fix: fixed bug
docs: changes
refactor: refactored code
chore: misc updates
```

## Using the Body

Add a body when the subject line isn't enough:

```
feat: add password reset functionality

Implements a secure password reset flow using email tokens.
Tokens expire after 1 hour and can only be used once.
Includes rate limiting to prevent abuse.

Closes #123
```

## Breaking Changes

Mark breaking changes with `!` or in footer:

```
feat!: remove deprecated API endpoints

BREAKING CHANGE: The /v1/users endpoint has been removed.
Use /v2/users instead.
```

## Issue References

Link commits to issues in the footer:

```
fix: resolve memory leak in data processing

Fixes #456
Related to #789
```

## Complete Examples

### Simple Feature

```
feat(auth): add two-factor authentication
```

### Bug Fix with Details

```
fix(api): handle timeout errors in user service

Added try-catch blocks and proper error responses for
network timeout scenarios. Returns 504 Gateway Timeout
with retry-after header.

Fixes #234
```

### Breaking Change

```
feat(api)!: redesign REST API endpoints

BREAKING CHANGE: All API endpoints now use /api/v2 prefix.
The v1 endpoints are no longer supported.

Migration guide: docs/migration-v2.md

Closes #567
```

### Refactor with Context

```
refactor(payments): improve error handling

Consolidated error handling logic into a centralized
error handler. Added specific error types for different
payment failures (declined, insufficient funds, etc).

This improves code maintainability and provides better
error messages to users.
```

## Quick Reference

**Most Common Pattern:**

```
<type>: <what you did in imperative mood>
```

**With Scope:**

```
<type>(<scope>): <what you did>
```

**With Breaking Change:**

```
<type>!: <what you did>
```

## Tools

- **Commitizen**: Interactive commit message tool
- **Husky + Commitlint**: Enforce commit conventions
- **Conventional Changelog**: Auto-generate changelogs

## Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [How to Write a Git Commit Message](https://chris.beams.io/posts/git-commit/)
