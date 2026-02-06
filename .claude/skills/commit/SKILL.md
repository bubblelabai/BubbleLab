---
name: commit
description: Stage and commit changes following conventional commits. Auto-bumps package versions before committing.
disable-model-invocation: false
argument-hint: [commit message or leave blank to auto-generate]
---

# Commit Skill (OSS Repo)

Create a well-formed conventional commit with automatic version bumping.

## Step 1: Analyze Changes

Run these commands in parallel:

```
git status
git diff --staged
git diff
git log --oneline -5
```

## Step 2: Bump Package Versions

**Always run the version bump before committing:**

```bash
pnpm run bump-versions
```

This increments the patch version of all publishable packages (bubble-core, bubble-runtime, shared-schemas, etc.).

Stage the bumped package.json files along with your other changes.

## Step 3: Stage Files

Stage relevant files. Be selective:

- **DO NOT** stage `.env`, credentials, or secret files
- **DO NOT** stage unrelated changes
- Prefer `git add <specific-files>` over `git add -A`
- **DO** include the bumped `packages/*/package.json` files

## Step 4: Write Commit Message

Follow **conventional commits** format:

```
type(scope): concise description

[optional body]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Types:** `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `enhance`
**Scope:** Optional, use for specific modules (e.g., `feat(confluence): ...`, `fix(google-drive): ...`)

Rules:

- Description is lowercase, no period at end
- Focus on the "why" not the "what"
- Keep first line under 72 characters
- If the user provided a message via `$ARGUMENTS`, use it (adjusting format if needed)

## Step 5: Commit

Use a HEREDOC for proper formatting:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

**IMPORTANT:**

- NEVER amend existing commits unless explicitly asked
- NEVER use `--no-verify` unless explicitly asked
- NEVER push unless explicitly asked
- If a pre-commit hook fails, fix the issue and create a NEW commit

## Step 6: Verify & Remind

Run `git status` after committing to confirm success.

Remind the user:

1. Run `pnpm run build:core` to rebuild packages with new versions
2. If the Pro repo uses linked packages, changes will be picked up automatically
3. To publish: follow the publish workflow
