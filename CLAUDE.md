Refer to langchain/ai agent documentation: https://langchain-ai.github.io/langgraphjs/llms-txt-overview/
Do not use `any` as type, if you ever feel the need, read the documentation or consult me for what is right. We are enforcing @typescript-eslint/no-explicit-any
Always use google gemini 2.5 flash model for testing
Always use pnpm or npm

# Testing Guidelines

## Writing Tests for nodex api

- **Write simple, focused tests first**: Create small, single-purpose tests that verify one specific behavior at a time. Start with the simplest possible test case before adding complexity, ask me for permission before writing the test.
- **Test setup uses Bun**: The project uses `// @ts-expect-error - Bun test types` at the top of test files and imports from `'bun:test'` for the testing framework. Tests are located in `src/services/` or similar directories.
- **Run tests with pnpm**: Use `pnpm run test <test-file-path>` to run specific tests (e.g., `pnpm run test src/services/credential-validation.test.ts`). The test runner automatically sets up the test database and environment.
