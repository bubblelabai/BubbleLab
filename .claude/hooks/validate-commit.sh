#!/bin/bash
# PreToolUse hook: validates conventional commit format before git commit runs
# Receives tool input as JSON on stdin

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
if ! echo "$COMMAND" | grep -q 'git commit'; then
  exit 0
fi

# Extract commit message - try HEREDOC first, then -m flag
MSG=""
if echo "$COMMAND" | grep -q "cat <<"; then
  MSG=$(echo "$COMMAND" | sed -n "/cat <<['\"]\\{0,1\\}EOF/,/EOF/p" | grep -v 'cat <<' | grep -v '^[[:space:]]*EOF' | head -1)
else
  MSG=$(echo "$COMMAND" | sed -n "s/.*-m ['\"]\\([^'\"]*\\)['\"].*/\\1/p" | head -1)
fi

# If we couldn't extract a message, allow it
if [ -z "$MSG" ]; then
  exit 0
fi

# Get first line trimmed
FIRST_LINE=$(echo "$MSG" | head -1 | sed 's/^[[:space:]]*//')

# Validate conventional commit format
if ! echo "$FIRST_LINE" | grep -qE '^(feat|fix|chore|refactor|docs|test|perf|enhance|ci|build|style|revert)(\([a-zA-Z0-9_/-]+\))?: .+'; then
  jq -n '{
    "decision": "block",
    "reason": "Commit message must follow conventional commits: type(scope): description. Valid types: feat, fix, chore, refactor, docs, test, perf, enhance"
  }'
  exit 0
fi

# Check first line length
if [ ${#FIRST_LINE} -gt 72 ]; then
  jq -n '{
    "decision": "block",
    "reason": "Commit message first line exceeds 72 characters. Please shorten it."
  }'
  exit 0
fi

# All good
exit 0
