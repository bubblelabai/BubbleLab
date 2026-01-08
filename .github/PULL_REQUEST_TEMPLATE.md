## Summary

<!-- Provide a short summary of your changes and the motivation behind them. -->

## Related Issues

<!-- List any related issues, e.g. Fixes #123 or Closes #456 -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactor
- [ ] New Bubble Integration
- [ ] Other (please describe):

## Checklist

- [ ] My code follows the code style of this project
- [ ] I have added appropriate tests for my changes
- [ ] I have run `pnpm check` and all tests pass
- [ ] I have tested my changes locally
- [ ] I have linked relevant issues

## Screenshots (Required)

<!-- Add screenshots showing the full result in BubbleLab. This is mandatory for all PRs. -->

## For New Bubble Integrations

> 📋 **Integration Flow Tests:** When creating a new bubble, you must write an integration flow test that exercises all operations end-to-end in realistic scenarios—including edge cases. This flow should be runnable in bubble studio and return structured results tracking each operation's success/failure with details. See `packages/bubble-core/src/bubbles/service-bubble/google-sheets/google-sheets.integration.flow.ts` for a complete reference implementation.
>
> ⚠️ If your integration requires API credits for testing, please reach out to the team for test credentials.

- [ ] Integration flow test (`.integration.flow.ts`) covers all operations
- [ ] Screenshots showing full test results in Bubble Studio attached above

## Additional Context

<!-- Add any other context or information about the PR here -->
